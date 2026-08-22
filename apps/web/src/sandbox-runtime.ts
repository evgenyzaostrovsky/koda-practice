export type MountedFile = {
  logicalPath: string;
  version: string;
  buffer?: ArrayBuffer;
};
export type SandboxResult = {
  ok: boolean;
  stdout: string;
  stderr?: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  errorType?: string;
  message?: string;
  traceback?: string;
  plots: string[];
  analysis?: { methods: string[]; stages: string[] };
  executionMs?: number;
  totalRunMs?: number;
  pythonTiming?: Record<string, number>;
  workerTiming?: {
    receivedEpochMs: number;
    runtimeReadyAt: number;
    filesystemMs: number;
    beforePythonAt: number;
    afterPythonAt: number;
    postMessageEpochMs: number;
    workerId: string;
    runtimeGeneration: string;
  };
  mainTiming?: { postMessageEpochMs: number; receivedEpochMs: number };
  result?: {
    kind: "dataframe" | "series" | "value";
    columns?: string[];
    index?: string[];
    data?: unknown[][];
    truncated?: boolean;
    shape?: number[];
    value?: string;
  } | null;
};
export type RuntimeMetrics = {
  workerCreatedMs: number;
  pyodideReadyMs: number;
  packagesReadyMs: number;
};
export type RuntimePhase = "booting" | "packages" | "ready" | "running" | "failed" | "terminated";
const WORKER_PROTOCOL_VERSION = "10";
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: number;
  timeoutMs?: number;
  postMessageAt: number;
  fileLoader?: (paths: string[]) => Promise<MountedFile[]>;
  code?: string;
  files?: MountedFile[];
};

export class SandboxRuntime {
  private worker: Worker;
  private readyPromise: Promise<{ version: string; metrics: RuntimeMetrics }>;
  private readyResolve!: (value: { version: string; metrics: RuntimeMetrics }) => void;
  private readyReject!: (error: Error) => void;
  private pending = new Map<string, Pending>();
  private fatalListener?: (message: string) => void;
  private statusListener?: (phase: RuntimePhase, detail: string) => void;
  private terminated = false;
  private runActive = false;

  constructor(
    onFatal?: (message: string) => void,
    onStatus?: (phase: RuntimePhase, detail: string) => void,
  ) {
    this.fatalListener = onFatal;
    this.statusListener = onStatus;
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.worker = new Worker(`/sandbox-worker.js?v=${WORKER_PROTOCOL_VERSION}`);
    this.worker.onmessage = (event) => {
      if (this.terminated) return;
      const message = event.data;
      if (message.type === "status") {
        const pending = message.requestId ? this.pending.get(message.requestId) : undefined;
        if (message.phase === "running" && pending?.timeoutMs && !pending.timer) {
          pending.timer = window.setTimeout(() => {
            this.pending.delete(message.requestId);
            this.terminate();
            pending.reject(new Error(`Выполнение остановлено: превышен лимит ${pending.timeoutMs! / 1000} секунд. Среда перезапущена.`));
          }, pending.timeoutMs);
        }
        this.statusListener?.(message.phase, message.detail);
        return;
      }
      if (message.type === "ready") {
        this.statusListener?.("ready", "Python готов");
        this.readyResolve({ version: message.version, metrics: message.metrics });
        return;
      }
      if (message.type === "needs-files") {
        const pending = this.pending.get(message.requestId);
        if (!pending?.fileLoader || !pending.code || !pending.files) return;
        if (pending.timer) {
          window.clearTimeout(pending.timer);
          pending.timer = undefined;
        }
        void pending.fileLoader(message.paths).then((loaded) => {
          if (this.terminated || !this.pending.has(message.requestId)) return;
          const loadedByPath = new Map(loaded.map((file) => [file.logicalPath, file]));
          const files = pending.files!.map((file) => loadedByPath.get(file.logicalPath) ?? file);
          const transfers = loaded.flatMap((file) => file.buffer ? [file.buffer] : []);
          this.worker.postMessage({ type: "run", requestId: message.requestId, code: pending.code, files }, transfers);
        }).catch((error) => {
          this.pending.delete(message.requestId);
          pending.reject(error instanceof Error ? error : new Error(String(error)));
        });
        return;
      }
      if (message.type === "result" || message.type === "inspection" || message.type === "fatal") {
        const pending = this.pending.get(message.requestId);
        if (pending) {
          if (pending.timer) window.clearTimeout(pending.timer);
          this.pending.delete(message.requestId);
          if (message.type === "result") {
            message.payload.mainTiming = {
              postMessageEpochMs: pending.postMessageAt,
              receivedEpochMs: Date.now(),
            };
          }
          message.type === "fatal"
            ? pending.reject(new Error(message.message))
            : pending.resolve(message.payload as unknown);
        } else if (message.type === "fatal") {
          const error = new Error(message.message);
          this.readyReject(error);
          this.fatalListener?.(message.message);
        }
      }
    };
    this.worker.onerror = (event) => {
      const message = event.message || "Python Worker завершился с ошибкой";
      const error = new Error(message);
      this.readyReject(error);
      for (const pending of this.pending.values()) {
        if (pending.timer) window.clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      this.fatalListener?.(message);
    };
  }

  ready() {
    return this.readyPromise;
  }

  private request<T>(type: "run", payload: object, transfers: Transferable[] = [], timeoutMs?: number, extra?: Partial<Pending>) {
    const requestId = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutMs,
        postMessageAt: Date.now(),
        ...extra,
      });
      this.worker.postMessage({ type, requestId, ...payload }, transfers);
    });
  }

  async run(
    code: string,
    files: MountedFile[],
    fileLoader: (paths: string[]) => Promise<MountedFile[]>,
    timeoutMs = 15000,
  ) {
    if (this.runActive) throw new Error("Код уже выполняется");
    this.runActive = true;
    try {
      await this.ready();
      const transfers = files.flatMap((file) => (file.buffer ? [file.buffer] : []));
      return await this.request<SandboxResult>("run", { code, files }, transfers, timeoutMs, { code, files, fileLoader });
    } finally {
      // The worker posts its result immediately before its async message
      // handler unwinds. Yield one macrotask so a rapid repeat Run cannot enter
      // Pyodide while that handler is still completing.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      this.runActive = false;
    }
  }

  terminate() {
    if (this.terminated) return;
    this.terminated = true;
    this.statusListener?.("terminated", "Среда остановлена");
    this.worker.terminate();
    const error = new Error("Выполнение остановлено");
    this.readyReject(error);
    for (const pending of this.pending.values()) {
      if (pending.timer) window.clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

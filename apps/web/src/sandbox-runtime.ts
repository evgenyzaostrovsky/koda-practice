export type MountedFile = {
  logicalPath: string;
  version: string;
  buffer?: ArrayBuffer;
};
export type SandboxResult = {
  ok: boolean;
  stdout: string;
  stdoutTruncated?: boolean;
  errorType?: string;
  message?: string;
  traceback?: string;
  plots: string[];
  executionMs?: number;
  totalRunMs?: number;
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
const WORKER_PROTOCOL_VERSION = "2";
type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: number;
  timeoutMs?: number;
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
      if (message.type === "result" || message.type === "inspection" || message.type === "fatal") {
        const pending = this.pending.get(message.requestId);
        if (pending) {
          if (pending.timer) window.clearTimeout(pending.timer);
          this.pending.delete(message.requestId);
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
    this.worker.onerror = () => this.fatalListener?.("Python Worker завершился с ошибкой");
  }

  ready() {
    return this.readyPromise;
  }

  private request<T>(type: "inspect" | "run", payload: object, transfers: Transferable[] = [], timeoutMs?: number) {
    const requestId = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeoutMs });
      this.worker.postMessage({ type, requestId, ...payload }, transfers);
    });
  }

  async inspect(code: string) {
    await this.ready();
    return this.request<{ imports: string[]; datasets: string[] }>("inspect", { code });
  }

  async run(code: string, files: MountedFile[], timeoutMs = 15000) {
    await this.ready();
    const transfers = files.flatMap((file) => (file.buffer ? [file.buffer] : []));
    return this.request<SandboxResult>("run", { code, files }, transfers, timeoutMs);
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

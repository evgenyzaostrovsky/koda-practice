export type MountedFile = { logicalPath: string; version: string; buffer?: ArrayBuffer };
export type SandboxResult = {
  ok: boolean;
  stdout: string;
  errorType?: string;
  message?: string;
  traceback?: string;
  plots: string[];
  result?: { kind: "dataframe" | "series" | "value"; columns?: string[]; index?: string[]; data?: unknown[][]; truncated?: boolean; shape?: number[]; value?: string } | null;
};

export class SandboxRuntime {
  private worker: Worker;
  private readyPromise: Promise<string>;
  private readyResolve!: (version: string) => void;
  private pending = new Map<string, { resolve: (value: SandboxResult) => void; reject: (error: Error) => void; timer: number }>();
  private fatalListener?: (message: string) => void;

  constructor(onFatal?: (message: string) => void) {
    this.fatalListener = onFatal;
    this.readyPromise = new Promise((resolve) => (this.readyResolve = resolve));
    this.worker = new Worker("/sandbox-worker.js");
    this.worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "ready") this.readyResolve(message.version);
      if (message.type === "result" || message.type === "fatal") {
        const pending = this.pending.get(message.requestId);
        if (pending) {
          window.clearTimeout(pending.timer);
          this.pending.delete(message.requestId);
          message.type === "result" ? pending.resolve(message.payload) : pending.reject(new Error(message.message));
        } else if (message.type === "fatal") this.fatalListener?.(message.message);
      }
    };
  }
  ready() { return this.readyPromise; }
  async run(code: string, files: MountedFile[], timeoutMs = 15000) {
    await this.ready();
    const requestId = crypto.randomUUID();
    const transfers = files.flatMap((file) => (file.buffer ? [file.buffer] : []));
    return new Promise<SandboxResult>((resolve, reject) => {
      const timer = window.setTimeout(() => { this.terminate(); reject(new Error("Выполнение остановлено: превышен лимит 15 секунд")); }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      this.worker.postMessage({ type: "run", requestId, code, files }, transfers);
    });
  }
  terminate() {
    this.worker.terminate();
    for (const pending of this.pending.values()) { window.clearTimeout(pending.timer); pending.reject(new Error("Выполнение остановлено")); }
    this.pending.clear();
  }
}

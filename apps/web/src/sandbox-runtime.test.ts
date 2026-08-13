import { beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxRuntime } from "./sandbox-runtime";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  emit(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}

describe("SandboxRuntime lifecycle", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("request") });
  });

  it("uses one worker for initialization and sequential runs", async () => {
    const runtime = new SandboxRuntime();
    const worker = FakeWorker.instances[0];
    expect(FakeWorker.instances).toHaveLength(1);
    worker.emit({ type: "ready", version: "0.27.7", metrics: { workerCreatedMs: 1, pyodideReadyMs: 2, packagesReadyMs: 3 } });
    await runtime.ready();
    const first = runtime.run("a = 10", []);
    await Promise.resolve();
    const firstId = worker.postMessage.mock.calls.at(-1)?.[0].requestId;
    worker.emit({ type: "result", requestId: firstId, payload: { ok: true, stdout: "", plots: [] } });
    await first;
    const second = runtime.run("a + 5", []);
    await Promise.resolve();
    const secondId = worker.postMessage.mock.calls.at(-1)?.[0].requestId;
    worker.emit({ type: "result", requestId: secondId, payload: { ok: true, stdout: "", plots: [], result: { kind: "value", value: "15" } } });
    expect((await second).result?.value).toBe("15");
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("ignores messages after termination", async () => {
    const fatal = vi.fn();
    const runtime = new SandboxRuntime(fatal);
    const worker = FakeWorker.instances[0];
    const rejected = expect(runtime.ready()).rejects.toThrow("Выполнение остановлено");
    runtime.terminate();
    await rejected;
    worker.emit({ type: "fatal", message: "stale" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(fatal).not.toHaveBeenCalled();
  });

  it("starts the timeout only when Python execution begins", async () => {
    vi.useFakeTimers();
    const runtime = new SandboxRuntime();
    const worker = FakeWorker.instances[0];
    worker.emit({ type: "ready", version: "0.27.7", metrics: { workerCreatedMs: 1, pyodideReadyMs: 2, packagesReadyMs: 3 } });
    const result = runtime.run("while True: pass", [], 1000);
    const rejection = expect(result).rejects.toThrow("превышен лимит");
    await Promise.resolve();
    const requestId = worker.postMessage.mock.calls.at(-1)?.[0].requestId;
    await vi.advanceTimersByTimeAsync(2000);
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.emit({ type: "status", phase: "running", detail: "Выполнение…", requestId });
    await vi.advanceTimersByTimeAsync(1001);
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

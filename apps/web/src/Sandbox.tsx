import Editor from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Copy,
  FileUp,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, apiResponse } from "./api";
import { getAccessToken } from "./auth";
import {
  SandboxRuntime,
  type RuntimeMetrics,
  type SandboxResult,
} from "./sandbox-runtime";
import { emitAchievementEvent } from "./achievements/engine";

export type SandboxFile = {
  id: string;
  name: string;
  logicalPath: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  version: string;
};
const STARTER = `import pandas as pd

# Загрузите CSV и прочитайте его через pd.read_csv()
`;
const STORAGE_KEY = "koda:sandbox-code:v1";
const filesQuery = () => api<SandboxFile[]>("/sandbox/files");
const bytes = (size: number) =>
  size < 1024
    ? `${size} Б`
    : size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} КБ`
      : `${(size / 1024 / 1024).toFixed(1)} МБ`;

function uploadCsv(
  file: File,
  onProgress: (value: number) => void,
): Promise<SandboxFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/sandbox/files");
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) =>
      event.lengthComputable &&
      onProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onerror = () =>
      reject(new Error("Соединение прервано во время загрузки"));
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.detail || "Не удалось загрузить файл"));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function Sandbox() {
  const {
    data: files = [],
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["sandbox-files"], queryFn: filesQuery });
  const [code, setCode] = useState(
      () => localStorage.getItem(STORAGE_KEY) ?? STARTER,
    ),
    [result, setResult] = useState<SandboxResult | null>(null),
    [runtimeState, setRuntimeState] = useState<
      "loading" | "ready" | "running" | "error"
    >("loading"),
    [message, setMessage] = useState("Подготовка Python…"),
    [runtimeMetrics, setRuntimeMetrics] = useState<RuntimeMetrics | null>(null),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [mobileTab, setMobileTab] = useState<"files" | "code" | "result">("code"),
    [copied, setCopied] = useState("");
  const runtime = useRef<SandboxRuntime | null>(null),
    runtimeId = useRef(crypto.randomUUID()),
    running = useRef(false),
    input = useRef<HTMLInputElement>(null),
    outputPanel = useRef<HTMLDivElement>(null);
  const createRuntime = () => {
    runtimeId.current = crypto.randomUUID();
    setRuntimeState("loading");
    setMessage("Подготовка Python…");
    setRuntimeMetrics(null);
    const next = new SandboxRuntime((text) => {
      if (runtime.current === next) {
        setRuntimeState("error");
        setMessage(text);
      }
    }, (phase, detail) => {
      if (runtime.current !== next) return;
      if (running.current) {
        if (phase === "packages" || phase === "running") setMessage(detail);
        return;
      }
      if (phase === "booting" || phase === "packages") setRuntimeState("loading");
      setMessage(detail);
    });
    runtime.current = next;
    next
      .ready()
      .then(({ version, metrics }) => {
        if (runtime.current === next) {
          setRuntimeMetrics(metrics);
          setRuntimeState("ready");
          setMessage(`Python готов · Pyodide ${version}`);
        }
      })
      .catch((e) => {
        setRuntimeState("error");
        setMessage(e.message);
      });
  };
  useEffect(() => {
    createRuntime();
    return () => runtime.current?.terminate();
  }, []);
  useEffect(() => localStorage.setItem(STORAGE_KEY, code), [code]);
  const selectFiles = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      setUploadProgress(0);
      try {
        const uploaded = await uploadCsv(file, setUploadProgress);
        emitAchievementEvent(
          "csv_uploaded",
          { fileId: uploaded.id, name: uploaded.name },
          uploaded.id,
        );
        await refetch();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
        setRuntimeState("error");
      } finally {
        setUploadProgress(null);
      }
    }
  };
  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1200);
  };
  const rename = async (file: SandboxFile) => {
    const name = prompt("Новое имя CSV", file.name);
    if (!name || name === file.name) return;
    try {
      await api(`/sandbox/files/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const remove = async (file: SandboxFile) => {
    if (!confirm(`Удалить ${file.name}?`)) return;
    try {
      await api(`/sandbox/files/${file.id}`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const run = async () => {
    if (!runtime.current || running.current) return;
    const activeRuntime = runtime.current;
    const clickAt = performance.now();
    running.current = true;
    setRuntimeState("running");
    setMessage(runtimeState === "loading" ? "Ожидаем готовность Python…" : "Выполнение…");
    try {
      const requestPreparedAt = performance.now();
      const latest = files;
      const mountedFiles = latest.map((file) => ({
        logicalPath: file.logicalPath,
        version: file.version,
      }));
      const filesReadyAt = performance.now();
      const loadFiles = async (paths: string[]) =>
        Promise.all(paths.map(async (path) => {
          const file = latest.find((candidate) => candidate.logicalPath === path);
          if (!file) throw new Error(`Файл ${path} не найден`);
          const response = await apiResponse(
            `/sandbox/files/${file.id}/content`,
          );
          return {
            logicalPath: file.logicalPath,
            version: file.version,
            buffer: await response.arrayBuffer(),
          };
        }));
      setMessage("Выполнение…");
      const output = await activeRuntime.run(code, mountedFiles, loadFiles);
      const resultReceivedAt = performance.now();
      if (runtime.current !== activeRuntime) return;
      setResult(output);
      setMobileTab("result");
      setRuntimeState("ready");
      const executionMs = output.executionMs ?? output.totalRunMs;
      setMessage(executionMs === undefined ? "Выполнено" : `Выполнено за ${Math.max(1, Math.round(executionMs))} мс`);
      requestAnimationFrame(() => outputPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      if (import.meta.env.DEV) {
        requestAnimationFrame(() => {
          const renderedAt = performance.now();
          const py = output.pythonTiming ?? {};
          const worker = output.workerTiming;
          const main = output.mainTiming;
          const rows = {
            "main → worker": worker && main ? worker.receivedEpochMs - main.postMessageEpochMs : 0,
            "runtime wait": requestPreparedAt - clickAt,
            "file preparation": filesReadyAt - requestPreparedAt,
            "worker run request": resultReceivedAt - filesReadyAt,
            bootstrap: (py.pythonStart ?? 0) - (py.bootstrapStart ?? 0),
            "python execution": (py.pythonEnd ?? 0) - (py.pythonStart ?? 0),
            "result/repr": (py.resultEnd ?? 0) - (py.resultStart ?? 0),
            stdout: (py.stdoutEnd ?? 0) - (py.stdoutStart ?? 0),
            plots: (py.plotsEnd ?? 0) - (py.plotsStart ?? 0),
            filesystem: worker?.filesystemMs ?? 0,
            "worker → main": worker && main ? main.receivedEpochMs - worker.postMessageEpochMs : 0,
            "React/render": renderedAt - resultReceivedAt,
            TOTAL: renderedAt - clickAt,
          };
          console.groupCollapsed("Sandbox run timing");
          console.table(rows);
          console.info("Sandbox timing data", JSON.stringify(rows));
          console.info({
            workerId: worker?.workerId,
            runtimeGeneration: worker?.runtimeGeneration,
            requestId: runtimeId.current,
          });
          console.groupEnd();
        });
      }
      const achievementRuntimeId = runtimeId.current;
      const recordAchievement = async () => {
        const sideEffectStarted = performance.now();
        const normalized = code.replace(/\s+/g, " ").trim();
        const hash = await crypto.subtle
          .digest("SHA-256", new TextEncoder().encode(normalized))
          .then((x) =>
            Array.from(new Uint8Array(x))
              .map((n) => n.toString(16).padStart(2, "0"))
              .join(""),
          );
        if (output.ok) {
          emitAchievementEvent("sandbox_run_succeeded", {
            codeHash: hash,
            runtimeId: achievementRuntimeId,
            ownDataset: latest.length > 0,
            fileIds: latest.map((file) => file.id),
            resultKind: output.result?.kind,
            plotCount: output.plots?.length ?? 0,
            methods: output.analysis?.methods ?? [],
            analysisStages: output.analysis?.stages ?? [],
            originTaskId:
              localStorage.getItem("koda:achievement-stuck-task") ?? undefined,
          }, hash);
          if (latest.length && output.analysis?.methods.includes("read_csv"))
            emitAchievementEvent("own_dataframe_created", { fileCount: latest.length }, hash);
          if (output.plots?.length)
            emitAchievementEvent("chart_created", { count: output.plots.length }, hash);
        } else {
          emitAchievementEvent("sandbox_run_failed", {
            codeHash: hash,
            runtimeId: achievementRuntimeId,
            errorType: output.errorType,
          }, `${achievementRuntimeId}:${hash}`);
        }
        if (import.meta.env.DEV)
          console.info("Sandbox achievement side effects", JSON.stringify({
            durationMs: performance.now() - sideEffectStarted,
          }));
      };
      // Persisting achievements is not part of Python execution. Let React commit
      // the real worker result first, then process progress without extending Run.
      requestAnimationFrame(() => void recordAchievement());
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      if (runtime.current === activeRuntime) {
        activeRuntime.terminate();
        createRuntime();
        setMessage(text);
      }
    } finally {
      running.current = false;
    }
  };
  const restart = () => {
    runtime.current?.terminate();
    running.current = false;
    setResult(null);
    createRuntime();
  };
  const stop = () => {
    runtime.current?.terminate();
    running.current = false;
    setResult(null);
    createRuntime();
    setMessage("Выполнение остановлено. Запускается чистая среда…");
  };
  const keyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      run();
    }
  };
  return (
    <section className="sandbox-page" onKeyDownCapture={keyDown}>
      <header className="sandbox-head">
        <div>
          <small>СВОБОДНАЯ ПРАКТИКА</small>
          <h1>Песочница</h1>
        </div>
        <span className={`sandbox-runtime ${runtimeState}`}>
          {runtimeState === "running" || runtimeState === "loading" ? <RefreshCw className="spin" /> : null}
          {message}
          {import.meta.env.DEV && runtimeMetrics ? (
            <small title="Диагностика cold start">
              boot {Math.round(runtimeMetrics.packagesReadyMs)} мс
            </small>
          ) : null}
        </span>
      </header>
      <nav className="sandbox-mobile-tabs">
        {(
          [
            ["files", "Файлы"],
            ["code", "Код"],
            ["result", "Результат"],
          ] as const
        ).map(([id, label]) => (
          <button
            className={mobileTab === id ? "active" : ""}
            onClick={() => setMobileTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="sandbox-grid">
        <aside className={`sandbox-files mobile-${mobileTab}`}>
          <div className="sandbox-panel-title">
            <b>Файлы</b>
            <span>
              {bytes(files.reduce((n, f) => n + f.sizeBytes, 0))} / 100 МБ
            </span>
          </div>
          <div
            className="sandbox-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              selectFiles(e.dataTransfer.files);
            }}
            onClick={() => input.current?.click()}
          >
            <FileUp />
            <b>
              {uploadProgress === null
                ? "Загрузить CSV"
                : `Загрузка ${uploadProgress}%`}
            </b>
            <span>До 20 МБ на файл</span>
            {uploadProgress !== null && (
              <i>
                <em style={{ width: `${uploadProgress}%` }} />
              </i>
            )}
            <input
              ref={input}
              hidden
              type="file"
              accept=".csv"
              multiple
              onChange={(e) => e.target.files && selectFiles(e.target.files)}
            />
          </div>
          {isLoading ? (
            <p className="sandbox-empty">Загрузка списка…</p>
          ) : error ? (
            <p className="sandbox-error">{(error as Error).message}</p>
          ) : files.length === 0 ? (
            <p className="sandbox-empty">
              Загрузите CSV. Он появится в Python по пути{" "}
              <code>/datasets/имя.csv</code>.
            </p>
          ) : (
            <div className="sandbox-file-list">
              {files.map((file) => (
                <article key={file.id}>
                  <b>{file.name}</b>
                  <small>{bytes(file.sizeBytes)}</small>
                  <code>{file.logicalPath}</code>
                  <div>
                    <button onClick={() => copy(file.logicalPath, file.id)}>
                      {copied === file.id ? <Check /> : <Copy />} Путь
                    </button>
                    <button
                      onClick={() =>
                        copy(
                          `pd.read_csv(${JSON.stringify(file.logicalPath)})`,
                          `example-${file.id}`,
                        )
                      }
                    >
                      <Copy /> Импорт
                    </button>
                    <button onClick={() => rename(file)}>Переименовать</button>
                    <button className="danger" onClick={() => remove(file)}>
                      <Trash2 /> Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
        <div className={`sandbox-code mobile-${mobileTab}`}>
          <div className="sandbox-toolbar">
            <span>solution.py</span>
            <div>
              <button onClick={() => setCode(STARTER)}>
                <RotateCcw />
                Сбросить код
              </button>
              {runtimeState === "running" ? (
                <button onClick={stop}>
                  <Square />
                  Остановить
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={false}
                  onClick={run}
                >
                  <Play />
                  Запустить
                </button>
              )}
              <button onClick={restart}>
                <RefreshCw />
                Перезапустить среду
              </button>
            </div>
          </div>
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              automaticLayout: true,
              padding: { top: 14 },
            }}
          />
        </div>
        <div className={`sandbox-output mobile-${mobileTab}`} ref={outputPanel}>
          <div className="sandbox-panel-title">
            <b>Результат</b>
            <button onClick={() => setResult(null)}>Очистить</button>
          </div>
          {!result ? (
            <p className="sandbox-empty">
              Здесь появятся stdout, последнее выражение и графики.
            </p>
          ) : (
            <SandboxOutput value={result} />
          )}
        </div>
      </div>
    </section>
  );
}

function SandboxOutput({ value }: { value: SandboxResult }) {
  return (
    <div className="sandbox-result">
      {value.stdout && <pre className="sandbox-stdout">{value.stdout}</pre>}
      {!value.ok && (
        <div className="sandbox-traceback">
          <b>
            {value.errorType}: {value.message}
          </b>
          <pre>{value.traceback}</pre>
        </div>
      )}
      {value.result?.kind === "value" && (
        <pre className="sandbox-value">{value.result.value}</pre>
      )}
      {(value.result?.kind === "dataframe" ||
        value.result?.kind === "series") && (
        <div>
          <div className="sandbox-table-meta">
            {value.result.shape?.join(" × ")}
            {value.result.truncated ? " · показан сокращённый результат" : ""}
          </div>
          <div className="sandbox-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {value.result.columns?.map((column, index) => (
                    <th key={index}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.result.data?.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <th>{value.result?.index?.[rowIndex]}</th>
                    {row.map((cell, index) => (
                      <td key={index}>{String(cell ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {value.plots?.map((plot, index) => (
        <img
          className="sandbox-plot"
          src={plot}
          alt={`График ${index + 1}`}
          key={index}
        />
      ))}
    </div>
  );
}

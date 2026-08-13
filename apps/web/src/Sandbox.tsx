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
import { SandboxRuntime, type SandboxResult } from "./sandbox-runtime";
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
    [message, setMessage] = useState("Загружаем Python…"),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [mobileTab, setMobileTab] = useState<"files" | "code" | "result">("code"),
    [copied, setCopied] = useState("");
  const runtime = useRef<SandboxRuntime | null>(null),
    runtimeId = useRef(crypto.randomUUID()),
    mounted = useRef(new Map<string, string>()),
    input = useRef<HTMLInputElement>(null);
  const createRuntime = () => {
    runtimeId.current = crypto.randomUUID();
    setRuntimeState("loading");
    setMessage("Загружаем Python и библиотеки…");
    const next = new SandboxRuntime((text) => {
      setRuntimeState("error");
      setMessage(text);
    });
    runtime.current = next;
    mounted.current.clear();
    next
      .ready()
      .then((version) => {
        if (runtime.current === next) {
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
    if (!runtime.current || runtimeState === "loading") return;
    setRuntimeState("running");
    setMessage("Синхронизируем файлы и выполняем код…");
    try {
      const latest = (await refetch()).data ?? files;
      const mountedFiles = [];
      const nextMounted = new Map<string, string>();
      for (const file of latest) {
        const signature = `${file.logicalPath}:${file.version}`;
        nextMounted.set(file.id, signature);
        if (mounted.current.get(file.id) !== signature) {
          const response = await apiResponse(
            `/sandbox/files/${file.id}/content`,
          );
          mountedFiles.push({
            logicalPath: file.logicalPath,
            version: file.version,
            buffer: await response.arrayBuffer(),
          });
        } else
          mountedFiles.push({
            logicalPath: file.logicalPath,
            version: file.version,
          });
      }
      const output = await runtime.current.run(code, mountedFiles);
      mounted.current = nextMounted;
      setResult(output);
      setMobileTab("result");
      setRuntimeState("ready");
      setMessage("Python готов");
      const normalized = code.replace(/\s+/g, " ").trim(),
        hash = await crypto.subtle
          .digest("SHA-256", new TextEncoder().encode(normalized))
          .then((x) =>
            Array.from(new Uint8Array(x))
              .map((n) => n.toString(16).padStart(2, "0"))
              .join(""),
          );
      if (output.ok) {
        emitAchievementEvent(
          "sandbox_run_succeeded",
          {
            codeHash: hash,
            runtimeId: runtimeId.current,
            ownDataset: latest.length > 0,
            fileIds: latest.map((file) => file.id),
            resultKind: output.result?.kind,
            plotCount: output.plots?.length ?? 0,
          },
          hash,
        );
        if (latest.length && /pd\.read_csv\s*\(/.test(code))
          emitAchievementEvent(
            "own_dataframe_created",
            { fileCount: latest.length },
            hash,
          );
        if (output.plots?.length)
          emitAchievementEvent(
            "chart_created",
            { count: output.plots.length },
            hash,
          );
      } else {
        emitAchievementEvent(
          "sandbox_run_failed",
          {
            codeHash: hash,
            runtimeId: runtimeId.current,
            errorType: output.errorType,
          },
          `${runtimeId.current}:${hash}`,
        );
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      runtime.current?.terminate();
      createRuntime();
      setMessage(text);
    }
  };
  const restart = () => {
    runtime.current?.terminate();
    setResult(null);
    createRuntime();
  };
  const stop = () => {
    runtime.current?.terminate();
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
    <section className="sandbox-page" onKeyDown={keyDown}>
      <header className="sandbox-head">
        <div>
          <small>СВОБОДНАЯ ПРАКТИКА</small>
          <h1>Песочница</h1>
        </div>
        <span className={`sandbox-runtime ${runtimeState}`}>
          {runtimeState === "running" ? <RefreshCw className="spin" /> : null}
          {message}
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
                  disabled={runtimeState === "loading"}
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
        <div className={`sandbox-output mobile-${mobileTab}`}>
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

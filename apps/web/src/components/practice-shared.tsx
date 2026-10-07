import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronRight, Clock3, Copy, Flame, Maximize2, Minimize2, RotateCcw, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { progressQ } from "../queries";
import type { RunResult } from "../types";
export function Header({
  title,
  crumb = "pandas",
}: {
  title: string;
  crumb?: string;
}) {
  const { data: p } = useQuery({ queryKey: ["progress"], queryFn: progressQ });
  return (
    <header>
      <div>
        <small>
          {crumb} <ChevronRight size={12} /> {title}
        </small>
        <h1>{title}</h1>
      </div>
      <div className="metrics">
        <span>
          <Flame /> серия <b>{p?.activity.length ?? 0}</b>
        </span>
        <span>
          <Trophy /> <b>{p?.xp ?? 0}</b> XP
        </span>
      </div>
    </header>
  );
}

export function Card({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="icon">{icon}</div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="topic-code">
      <div>
        <span>{label}</span>
        <button onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}

export function DataPreview({ dataset }: { dataset: Record<string, unknown> }) {
  const frames = useMemo(() => {
    const out: Array<[string, Record<string, unknown[]>]> = [];
    for(const [k, v] of Object.entries(dataset)) {
      if(k === "variables" && v && typeof v === "object") {
        for(const [vk, vv] of Object.entries(v as Record<string, unknown>))
          if(vv && typeof vv === "object" && !Array.isArray(vv))
            out.push([vk, vv as Record<string, unknown[]>]);
      } else if(k === "series" && v && typeof v === "object") {
        for(const [vk, vv] of Object.entries(
          v as Record<string, { data?: unknown[] }>,
        ))
          out.push([vk, { value: vv.data ?? [] }]);
      } else if(
        !["files"].includes(k) &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      )
        out.push([k, v as Record<string, unknown[]>]);
    }
    return out;
  }, [dataset]);
  const [active, setActive] = useState(0),
    [expanded, setExpanded] = useState(false);
  useEffect(() => setActive(0), [dataset]);
  if(!frames.length)
    return (
      <div className="data-empty">
        Для этой задачи входная таблица не требуется.
      </div>
    );
  const [name, obj] = frames[Math.min(active, frames.length - 1)],
    cols = Object.keys(obj),
    n = Math.max(
      0,
      ...cols.map((c) => (Array.isArray(obj[c]) ? obj[c].length : 0)),
    );
  const dtype = (values: unknown[]) =>
    values.every((x) => x == null || typeof x === "number")
      ? "number"
      : values.every((x) => x == null || typeof x === "boolean")
        ? "bool"
        : "string";
  return (
    <div className={`data-block ${expanded ? "expanded" : ""}`}>
      <div className="data-toolbar">
        <div className="data-tabs">
          {frames.map(([x], i) => (
            <button
              className={i === active ? "active" : ""}
              onClick={() => setActive(i)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <button className="expand-data" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Minimize2 /> : <Maximize2 />}
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      </div>
      <div className="table-wrap input-table">
        <table>
          <thead>
            <tr>
              <th>
                #<small>index</small>
              </th>
              {cols.map((c) => (
                <th key={c}>
                  {c}
                  <small>{dtype(obj[c] as unknown[])}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }, (_, i) => (
              <tr key={i}>
                <td>{i}</td>
                {cols.map((c) => (
                  <td key={c}>{String((obj[c] as unknown[])?.[i] ?? "NaN")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResultPreview({
  result,
}: {
  result: NonNullable<RunResult["result"]>;
}) {
  if(result.kind === "dataframe") {
    const rows = result.data as unknown[][];
    return (
      <div className="table-wrap result-table">
        <table>
          <thead>
            <tr>
              {result.columns?.map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.slice(0, 12).map((row, i) => (
              <tr key={i}>
                {row.map((x, j) => (
                  <td key={j}>{String(x)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if(result.kind === "series")
    return (
      <div className="series-preview">
        {(result.data as unknown[])?.map((x, i) => (
          <div key={i}>
            <span>{result.index?.[i] ?? i}</span>
            <b>{String(x)}</b>
          </div>
        ))}
      </div>
    );
  if(result.kind === "plot")
    return (
      <div className="feedback success compact">
        <Check />
        <div>
          <h3>График создан</h3>
          <p>Runner обнаружил объект визуализации.</p>
        </div>
      </div>
    );
  return <pre>{JSON.stringify(result.data, null, 2)}</pre>;
}

export function ResultView({ r }: { r: RunResult }) {
  if(!r.ok || r.passed === false) {
    const x = r.explanation;
    return (
      <div className="feedback error detailed">
        <AlertTriangle />
        <div>
          <h3>{x?.title || "Ошибка проверки"}</h3>
          <p>{x?.what || r.error}</p>
          {x?.where && <pre className="error-location">{x.where}</pre>}
          {x?.python_error && (
            <p>
              <b>Python:</b> {x.python_error}
            </p>
          )}
          {x?.expected && x?.actual && (
            <div className="compare">
              <span>
                <small>Ожидалось</small>
                <code>{x.expected}</code>
              </span>
              <span>
                <small>Получено</small>
                <code>{x.actual}</code>
              </span>
            </div>
          )}
          {x?.difference && <p className="difference">{x.difference}</p>}
          <b>Следующий шаг</b>
          <pre className="error-check">{x?.check}</pre>
          {x?.hint && <em>{x.hint}</em>}
          <small>{r.execution_ms} мс</small>
        </div>
      </div>
    );
  }
  if(!r.result)
    return <div className="empty">Запустите код, чтобы увидеть результат.</div>;
  const shape =
    r.result.kind === "dataframe"
      ? `${(r.result.data as unknown[][])?.length || 0} × ${r.result.columns?.length || 0}`
      : r.result.kind === "series"
        ? `${(r.result.data as unknown[])?.length || 0}`
        : "—";
  return (
    <div className="run-output">
      {r.stdout && (
        <div className="stdout">
          <b>stdout</b>
          <pre>{r.stdout}</pre>
        </div>
      )}
      <div className="result-meta">
        <span>
          Тип <b>{r.result.kind}</b>
        </span>
        <span>
          Shape <b>{shape}</b>
        </span>
        <span>
          Время <b>{r.execution_ms} мс</b>
        </span>
      </div>
      <ResultPreview result={r.result} />
    </div>
  );
}

export function QueryError({
  retry,
  pending,
  focus = false,
}: {
  retry: () => void;
  pending: boolean;
  focus?: boolean;
}) {
  return (
    <div className={`query-error ${focus ? "focus-error" : ""}`}>
      <AlertTriangle />
      <h2>Не удалось подключиться к KODA API</h2>
      <p>
        Проверьте, что backend запущен командой <code>npm run dev</code>, затем
        повторите запрос.
      </p>
      <button onClick={retry} disabled={pending}>
        {pending ? <Clock3 /> : <RotateCcw />}
        {pending ? "Подключаемся…" : "Повторить"}
      </button>
      <Link to="/catalog">Вернуться в каталог</Link>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading">
      <Clock3 /> Загрузка…
    </div>
  );
}

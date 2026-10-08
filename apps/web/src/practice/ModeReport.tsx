import type { RunResult } from "../types";

function ReportValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length && value.every(row => row && typeof row === "object" && !Array.isArray(row))) {
      const rows = value as Record<string, unknown>[];
      const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
      return <div className="table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}><ReportValue value={row[column]} /></td>)}</tr>)}</tbody></table></div>;
    }
    return <span>{value.map(item => String(item ?? "—")).join(", ") || "Нет значений"}</span>;
  }
  if (value && typeof value === "object") return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key}</dt><dd><ReportValue value={item} /></dd></div>)}</dl>;
  return <span>{String(value ?? "—")}</span>;
}
export function ModeReport({ result }: { result: RunResult }) {
  const data = result.result?.data as Record<string, unknown> | undefined;
  const rows = data && Array.isArray(data.values) ? data.values as Record<string, unknown>[] : [];
  const chart = (data?.visual === "bar" || data?.visual === "line") && rows.length && rows.every(row => typeof row.value === "number");
  const maximum = Math.max(1, ...rows.map(row => Number(row.value)));
  return <div className="mode-report" aria-label="Предпросмотр учебного отчёта"><p>Учебный результат · {result.execution_ms} мс</p>{Boolean(chart) && <figure><figcaption>{data?.visual === "line" ? "Динамика показателя" : "Сравнение показателя"}</figcaption>{data?.visual === "line" ? <svg role="img" aria-label="Динамика показателя; точные значения в таблице ниже" viewBox="0 0 400 130"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={rows.map((row, index) => `${10 + index * 380 / Math.max(1, rows.length - 1)},${120 - Number(row.value) / maximum * 110}`).join(" ")} /></svg> : <div className="mode-bars">{rows.map((row, index) => <div key={index}><span>{Object.entries(row).filter(([key]) => key !== "value").map(([, value]) => String(value)).join(" · ")}</span><meter min={0} max={maximum} value={Number(row.value)} aria-label={`Значение ${index + 1}`} /><b>{String(row.value)}</b></div>)}</div>}</figure>}<ReportValue value={data} /></div>;
}

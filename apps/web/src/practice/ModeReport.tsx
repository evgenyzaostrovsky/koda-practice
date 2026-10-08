import type { RunResult } from "../types";

const labels: Record<string, string> = { revenue: "Выручка", orders_count: "Заказы", orders: "Заказы", average_order: "Средний чек", delivery_average: "Средняя доставка", rating_average: "Средняя оценка", slow_delivery: "Доставка дольше трёх дней", cancellations: "Отмены", cancel_pct: "Доля отмен", city: "Город", category: "Категория", channel: "Канал", status: "Статус", month: "Месяц", period: "Период", value: "Значение", filters: "Фильтры", selection: "Выбор на диаграмме", checks: "Проверки", rows: "Строки", columns: "Поля", missing: "Пропуски", duplicate_orders: "Повторные номера", order_ids: "Номера заказов", calculated: "Расчётная выручка", difference: "Расхождение", values: "Данные диаграммы", types: "Типы данных", id: "Проверка", evidence: "Расчётное подтверждение" };
const title = (key: string) => labels[key] ?? key;
Object.assign(labels, { average: "Средний чек", cancelled: "Отмены", cancel_share: "Доля отмен", rating: "Средняя оценка", growth: "Изменение выручки", previous_revenue: "Выручка предыдущего месяца", totals: "Общие показатели", unique_orders: "Уникальность заказов", missing_rating: "Пропуски оценок", relationships: "Связи модели", city_filters: "Фильтры городов", channel_filters: "Фильтры каналов", status_filters: "Фильтры статусов", clear_filters: "Восстановление после очистки", city_reconciliation: "Сверка сумм городов", category_reconciliation: "Сверка сумм категорий" });
Object.assign(labels, { order_id: "Номер заказа", revenue_calculated: "Расчётная выручка", check: "Проверка строки", revenue_total: "Общая расчётная выручка" });
function FormattedOrders({ data, dataset }: { data: Record<string, unknown>; dataset?: Record<string, unknown> }) {
  const variables = dataset?.variables as Record<string, unknown> | undefined;
  const candidate = dataset?.orders ?? variables?.orders ?? variables?.df;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return <ReportValue value={data} />;
  const columns = Object.entries(candidate).filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
  const ids = columns.find(([key]) => key === "order_id")?.[1];
  if (!ids) return <ReportValue value={data} />;
  const highlighted = new Set((data.highlighted_orders as unknown[]).map(String));
  return <div className="table-wrap" role="region" aria-label="Прокручиваемая таблица заказов" tabIndex={0}><table aria-label="Заказы с условным форматированием"><thead><tr>{columns.map(([key]) => <th key={key}>{title(key)}</th>)}<th>Условное форматирование</th></tr></thead><tbody>{ids.map((id, index) => {
    const matched = highlighted.has(String(id));
    return <tr key={String(id)} className={matched && data.scope === "rows" ? "mode-highlighted-row" : undefined} data-format-style={matched ? String(data.style) : undefined}>{columns.map(([key, values]) => <td key={key}><ReportValue value={values[index]} /></td>)}<td>{matched ? "Выделено правилом" : "Без выделения"}</td></tr>;
  })}</tbody></table></div>;
}
function CalculatedOrders({ data }: { data: Record<string, unknown> }) {
  const ids = data.order_ids as unknown[];
  const columns = Object.entries(data.columns as Record<string, unknown>).filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
  return <><div className="table-wrap"><table aria-label="Расчёт и проверка выручки по заказам"><thead><tr><th>Номер заказа</th>{columns.map(([key]) => <th key={key}>{title(key)}</th>)}</tr></thead><tbody>{ids.map((id, index) => <tr key={String(id)}><td>{String(id)}</td>{columns.map(([key, values]) => <td key={key}><ReportValue value={values[index]} /></td>)}</tr>)}</tbody></table></div><p>Общая расчётная выручка: <ReportValue value={data.revenue_total} /></p></>;
}
function ReportValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length && value.every(row => row && typeof row === "object" && !Array.isArray(row))) {
      const rows = value as Record<string, unknown>[];
      const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
      return <div className="table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{title(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}><ReportValue value={row[column]} /></td>)}</tr>)}</tbody></table></div>;
    }
    return <span>{value.map(item => String(item ?? "—")).join(", ") || "Нет значений"}</span>;
  }
  if (value && typeof value === "object") return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{title(key)}</dt><dd><ReportValue value={item} /></dd></div>)}</dl>;
  return <span>{typeof value === "boolean" ? value ? "Да" : "Нет" : typeof value === "string" ? title(value) : String(value ?? "—")}</span>;
}
type Selection = { field: string; value: string | null };
function Chart({ name, rows, fullRows, line, selection, disabled, onSelect }: { name: string; rows: Record<string, unknown>[]; fullRows?: Record<string, unknown>[]; line: boolean; selection?: Selection; disabled: boolean; onSelect?: (field: string, value: string) => void }) {
  const numericRows = (items: Record<string, unknown>[]) => items.map((row): Record<string, unknown> => ({ ...row, value: row.value ?? row.revenue })).filter(row => typeof row.value === "number");
  const numeric = numericRows(rows);
  const targets = fullRows?.length ? numericRows(fullRows) : numeric;
  const maximum = Math.max(1, ...numeric.map(row => Number(row.value)));
  return <figure><figcaption>{title(name)}</figcaption>{line && numeric.length > 0 && <svg role="img" aria-label={`${title(name)}: точные значения в таблице ниже`} viewBox="0 0 400 130"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={numeric.map((row, index) => `${10 + index * 380 / Math.max(1, numeric.length - 1)},${120 - Number(row.value) / maximum * 110}`).join(" ")} /></svg>}{!line && <div className="mode-bars">{targets.map((target, index) => {
    const field = ["city", "category"].find(key => typeof target[key] === "string");
    const row = field ? numeric.find(item => item[field] === target[field]) : numeric[index];
    const label = Object.entries(target).filter(([key]) => key !== "value").map(([, value]) => String(value)).join(" · ");
    return <div key={index}>{field && onSelect ? <button type="button" disabled={disabled} aria-pressed={selection?.field === field && selection.value === String(target[field])} onClick={() => onSelect(field, String(target[field]))}>{label}</button> : <span>{label}</span>}<meter min={0} max={maximum} value={Number(row?.value ?? 0)} aria-label={`${label}: ${row?.value ?? 0}`} /><b>{String(row?.value ?? 0)}</b></div>;
  })}</div>}<ReportValue value={rows} /></figure>;
}
export function ModeReport({ result, code, dataset, disabled = false, onPreview }: { result: RunResult; code?: string; dataset?: Record<string, unknown>; disabled?: boolean; onPreview?: (code: string) => void }) {
  const raw = result.result?.data;
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : undefined;
  let config: Record<string, unknown> = {};
  try { const parsed: unknown = JSON.parse(code ?? "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) config = parsed as Record<string, unknown>; } catch { /* ModeControls shows invalid draft recovery. */ }
  const selection = config.selection as Selection | null | undefined;
  const record = (next: Record<string, unknown>, event: Record<string, unknown>) => onPreview?.(JSON.stringify({ ...next, interaction_events: [...(Array.isArray(config.interaction_events) ? config.interaction_events : []), event].slice(-100) }));
  const applySelection = (field: string, value: string) => {
    const nextValue = selection?.field === field && selection.value === value ? null : value;
    record({ ...config, selection: { field, value: nextValue } }, { type: "select", field, value });
  };
  const visuals = data?.visuals && typeof data.visuals === "object" ? data.visuals as Record<string, unknown> : {};
  const reportConfig = config.report && typeof config.report === "object" ? config.report as Record<string, unknown> : config;
  const options = data?.visual_options && typeof data.visual_options === "object" ? data.visual_options as Record<string, unknown> : {};
  const slicers = config.operation === "checklist" ? Object.keys(options).filter(key => ["city", "channel", "status", "category"].includes(key)) : Array.isArray(reportConfig.slicers) ? reportConfig.slicers as string[] : [];
  const filters = config.filters && typeof config.filters === "object" ? config.filters as Record<string, unknown> : reportConfig.filters && typeof reportConfig.filters === "object" ? reportConfig.filters as Record<string, unknown> : {};
  const fullVisuals = data?.full_visuals && typeof data.full_visuals === "object" ? data.full_visuals as Record<string, unknown> : {};
  const formats = data?.formats && typeof data.formats === "object" ? data.formats as Record<string, unknown> : {};
  const configuration = data?.configuration && typeof data.configuration === "object" ? data.configuration as Record<string, unknown> : reportConfig;
  const formatValue = (name: string, value: unknown) => typeof value === "number" ? value.toLocaleString("ru-RU", formats[name] === "currency" ? { style: "currency", currency: "RUB", maximumFractionDigits: 2 } : formats[name] === "percent" ? { style: "percent", maximumFractionDigits: 1 } : { maximumFractionDigits: 2 }) : String(value ?? "—");
  const hasReport = Boolean(data?.cards || Object.keys(visuals).length);
  const legacyRows = Array.isArray(data?.values) ? data.values as Record<string, unknown>[] : [];
  return <div className="mode-report" aria-label="Предпросмотр учебного отчёта" aria-live="polite"><p>Учебный результат · {result.execution_ms} мс</p>{hasReport && <>
    {onPreview && <div className="mode-report-slicers">{slicers.map(field => Array.isArray(options[field]) && <fieldset key={field}><legend>{title(field)}</legend>{(options[field] as unknown[]).map(option => {
      const value = String(option);
      const selected = Array.isArray(filters[field]) ? filters[field] as string[] : filters[field] ? [String(filters[field])] : [];
      return <label key={value}><input type="checkbox" disabled={disabled} checked={selected.includes(value)} onChange={event => {
        const values = event.target.checked ? [...selected, value] : selected.filter(item => item !== value);
        record({ ...config, filters: { ...filters, [field]: values } }, { type: "filter", field, values });
      }} />{value}</label>;
    })}</fieldset>)}</div>}
    {onPreview && <div className="mode-report-actions"><p>{selection?.value ? `Выбрано: ${title(selection.field)} — ${selection.value}. Повторный клик снимет выбор.` : "Выберите город или категорию на диаграмме для исследования отчёта."}</p><button type="button" disabled={disabled} onClick={() => record({ ...config, filters: {}, selection: null }, { type: "clear" })}>Очистить фильтры и выбор</button></div>}
    {data?.cards && typeof data.cards === "object" ? <div className="mode-kpis">{Object.entries(data.cards).map(([name, value]) => <div key={name}><span>{title(name)}</span><strong>{formatValue(name, value)}</strong></div>)}</div> : null}
    {configuration.layout === "table-with-total" ? <><ReportValue value={data?.values} /><h4>Общий итог</h4><ReportValue value={data?.total} /></> : Object.entries(visuals).map(([name, value]) => Array.isArray(value) ? <Chart key={name} name={name} rows={value as Record<string, unknown>[]} fullRows={Array.isArray(fullVisuals[name]) ? fullVisuals[name] as Record<string, unknown>[] : undefined} line={name === "month" || name === "period"} selection={selection ?? undefined} disabled={disabled} onSelect={onPreview ? applySelection : undefined} /> : <ReportValue key={name} value={value} />)}
    {data?.checks ? <ReportValue value={data.checks} /> : null}
  </>}{!hasReport && <>{data && Array.isArray(data.highlighted_orders) ? <FormattedOrders data={data} dataset={dataset} /> : data && Array.isArray(data.order_ids) && data.columns && typeof data.columns === "object" && !Array.isArray(data.columns) ? <CalculatedOrders data={data} /> : ["bar", "horizontal-bar", "line"].includes(String(data?.visual)) && legacyRows.length ? <Chart name={String(data?.title ?? "values")} rows={legacyRows} line={data?.visual === "line"} selection={selection ?? undefined} disabled={disabled} onSelect={onPreview ? applySelection : undefined} /> : <ReportValue value={raw} />}</>}</div>;
}

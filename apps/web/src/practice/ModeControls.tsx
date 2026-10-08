import type { Exercise } from "../types";
import "./mode-controls.css";

function readPath(value: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined, value);
}
function writePath(value: Record<string, unknown>, key: string, next: unknown) {
  const parts = key.split(".");
  let node = value;
  parts.slice(0, -1).forEach((part, index) => {
    if (!node[part] || typeof node[part] !== "object") node[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    node = node[part] as Record<string, unknown>;
  });
  node[parts[parts.length - 1]] = next;
}
export function ModeControls({ exercise, code, onChange, disabled }: { exercise: Exercise; code: string; onChange: (value: string) => void; disabled: boolean }) {
  const spec = exercise.response_spec;
  if (!spec) return <p role="alert">Настройки этой задачи недоступны. Вернитесь в каталог и откройте задачу снова.</p>;
  let values: Record<string, unknown>;
  let invalid = false;
  try {
    const parsed: unknown = JSON.parse(code);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    values = parsed as Record<string, unknown>;
  } catch { values = structuredClone(spec.initial); invalid = true; }
  const update = (key: string, value: unknown) => {
    const next = structuredClone(values);
    writePath(next, key, value);
    onChange(JSON.stringify(next));
  };
  return <div className="mode-controls">
    <p className="mode-note">Учебный симулятор: поддерживаются настройки этой задачи. Это практика отдельных приёмов, а не полная среда {exercise.exercise_mode === "excel" ? "Microsoft Excel" : "Power BI"}.</p>
    {invalid && <p role="alert">Сохранённые настройки не удалось прочитать. Нажмите «Сбросить решение», чтобы восстановить исходные настройки.</p>}
    <fieldset disabled={disabled || invalid}>
      <legend>Ваше решение</legend>
      {spec.fields.map(field => {
        const id = `mode-${field.key}`;
        const value = readPath(values, field.key) ?? field.default;
        if (field.type === "checkbox") return <label key={id} className="mode-checkbox"><input id={id} type="checkbox" checked={Boolean(value)} onChange={event => update(field.key, event.target.checked)} />{field.label}</label>;
        if (field.type === "multiselect") return <fieldset key={id} className="mode-options"><legend>{field.label}</legend>{field.options?.map(option => <label key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={event => update(field.key, event.target.checked ? [...(Array.isArray(value) ? value : []), option] : (Array.isArray(value) ? value : []).filter(item => item !== option))} />{option}</label>)}</fieldset>;
        return <div className="mode-field" key={id}><label htmlFor={id}>{field.label}</label>{field.type === "select" ? <select id={id} value={String(value ?? "")} onChange={event => update(field.key, event.target.value)}><option value="">Выберите…</option>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input id={id} type={field.type === "number" ? "number" : "text"} value={String(value ?? "")} spellCheck={false} onChange={event => update(field.key, field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />}</div>;
      })}
    </fieldset>
  </div>;
}

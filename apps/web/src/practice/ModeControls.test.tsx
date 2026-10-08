import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "../types";
import { ModeControls } from "./ModeControls";
afterEach(cleanup);
const exercise = { id: "report-test", difficulty: 1, title: "Отчёт", instructions: "", learning_objective: "", completion_summary: "", setup_code: "", starter_code: "", theory_article_id: "theory", knowledge_unit_id: "unit", dataset: {}, hints: [], is_control: false, xp: 15, exercise_mode: "power-bi", response_spec: { initial: { operation: "insights", claims: [{ metric: "revenue", value: 0 }] }, fields: [{ key: "claims.0.value", label: "Выручка", type: "number" }] } } as Exercise;
describe("Native simulator controls", () => {
  it("serializes numeric nested edits while preserving operation and array structure", () => {
    const onChange = vi.fn();
    render(<ModeControls exercise={exercise} code={JSON.stringify(exercise.response_spec!.initial)} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByLabelText("Выручка"), { target: { value: "120" } });
    expect(JSON.parse(onChange.mock.calls[0][0])).toEqual({ operation: "insights", claims: [{ metric: "revenue", value: 120 }] });
  });
  it("keeps invalid saved data visible as an error and requires reset", () => {
    render(<ModeControls exercise={exercise} code="broken" onChange={vi.fn()} disabled={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Сохранённые настройки");
    expect(screen.getByLabelText("Выручка")).toBeDisabled();
  });
});

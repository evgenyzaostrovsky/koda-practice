import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModeReport } from "./ModeReport";
import type { RunResult } from "../types";

afterEach(cleanup);
const output = (data: unknown): RunResult => ({ ok: true, execution_ms: 1, result: { kind: "scalar", data } });
describe("Excel result rendering", () => {
  it("highlights the complete returned order rows without tinting paid or returned orders", () => {
    render(<ModeReport result={output({ highlighted_orders: [1011, 1025], style: "light-red", scope: "rows" })} dataset={{ orders: { order_id: [1001, 1011, 1025, 1030], status: ["Оплачен", "Отменён", "Отменён", "Возврат"], revenue: [100, 200, 300, 400] } }} />);
    const table = screen.getByRole("table", { name: "Заказы с условным форматированием" });
    expect(table.querySelectorAll(".mode-highlighted-row")).toHaveLength(2);
    for (const id of [1011, 1025]) {
      const row = within(table).getByText(String(id)).closest("tr")!;
      expect(row).toHaveClass("mode-highlighted-row");
      expect(row).toHaveAttribute("data-format-style", "light-red");
      expect(within(row).getByText("Выделено правилом")).toBeInTheDocument();
    }
    for (const id of [1001, 1030]) expect(within(table).getByText(String(id)).closest("tr")).not.toHaveClass("mode-highlighted-row");
  });
  it("uses the prepared variables preview when the dataset is nested", () => {
    render(<ModeReport result={output({ highlighted_orders: [1011], style: "light-red", scope: "rows" })} dataset={{ variables: { orders: { order_id: [1011], status: ["Отменён"] } } }} />);
    expect(screen.getByText("1011").closest("tr")).toHaveClass("mode-highlighted-row");
  });
  it("aligns calculated values and row checks to their order IDs", () => {
    render(<ModeReport result={output({ order_ids: [1001, 1002], columns: { revenue_calculated: [190, 200], check: ["ОК", "Ошибка"] }, revenue_total: 390 })} />);
    const table = screen.getByRole("table", { name: "Расчёт и проверка выручки по заказам" });
    const first = within(table).getByText("1001").closest("tr")!;
    const second = within(table).getByText("1002").closest("tr")!;
    expect(within(first).getByText("190")).toBeInTheDocument();
    expect(within(first).getByText("ОК")).toBeInTheDocument();
    expect(within(second).getByText("200")).toBeInTheDocument();
    expect(within(second).getByText("Ошибка")).toBeInTheDocument();
  });
});

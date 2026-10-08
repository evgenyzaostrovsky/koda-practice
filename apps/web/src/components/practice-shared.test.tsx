import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultPreview } from "./practice-shared";
import type { RunResult } from "../types";

afterEach(cleanup);
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSuoAAAAASUVORK5CYII=";
const plot: NonNullable<RunResult["result"]> = { kind: "plot", image: png, title: "Выручка городов", xlabel: "Город", ylabel: "Рубли" };

describe("practice plot preview", () => {
  it("renders the actual PNG with a meaningful accessible label and bounded width", () => {
    render(<ResultPreview result={plot} />);
    const image = screen.getByRole("img", { name: "Выручка городов — Город — Рубли" });
    expect(image).toHaveAttribute("src", png);
    expect(image).toHaveStyle({ maxWidth: "100%", height: "auto" });
    expect(screen.queryByText("Runner обнаружил объект визуализации.")).not.toBeInTheDocument();
  });

  it("shows the computed category conclusion and exact named means beside the chart", () => {
    render(<ResultPreview result={{ ...plot, insight: { best_category: "Техника", means: { Техника: 4.75, Дом: 3.5 } } }} />);
    expect(screen.getByText("Техника", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/Техника: 4,75; Дом: 3,5/)).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it.each([undefined, "https://example.com/chart.png", "data:image/svg+xml,<svg/>", "javascript:alert(1)"])("preserves a safe legacy fallback for unavailable or unsupported image %s", image => {
    render(<ResultPreview result={{ kind: "plot", image }} />);
    expect(screen.getByRole("heading", { name: "График создан" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps dataframe preview values intact", () => {
    render(<ResultPreview result={{ kind: "dataframe", columns: ["city", "revenue"], data: [["Москва", 123]] }} />);
    expect(screen.getByRole("columnheader", { name: "revenue" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "123" })).toBeInTheDocument();
  });
});

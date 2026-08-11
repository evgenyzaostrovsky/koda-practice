import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeArticle, KnowledgeIndex } from "./Knowledge";

const unit = {
  id: "ku-groupby",
  slug: "groupby",
  topicId: "10",
  title: "Группировка",
  description: "Группировка и агрегация данных",
  category: "pandas",
  concepts: ["groupby"],
  methods: ["groupby", "sum"],
  functions: [],
  attributes: [],
  operators: [],
  keywords: ["группировка", "groupby"],
  cheatSheet: {
    entries: [
      {
        id: "cheat-groupby-001",
        group: "Группировка",
        name: ".groupby().sum()",
        kind: "pattern",
        description: "Суммирует значения внутри каждой группы.",
        example: "orders.groupby('region').sum()",
        documentationUrl:
          "https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.groupby.html",
      },
    ],
  },
  article: {
    lead: "Подробное объяснение группировки",
    sections: [
      {
        id: "method-1",
        title: "groupby",
        paragraphs: ["Метод разделяет данные."],
        covers: ["cheat-groupby-001"],
        syntax: "df.groupby('city')",
        examples: [
          {
            code: "orders.groupby('region').sum()",
            result: "Суммы по регионам",
            explanation: "Группирует строки",
          },
        ],
        errors: [],
        nuances: [],
      },
    ],
    summary: "Группировка освоена",
  },
  documentationLinks: [],
  relatedTaskIds: ["groupby-001"],
  version: 1,
};
const progress = {
  solved: 0,
  solved_ids: [],
  total: 200,
  attempts: 0,
  first_try_accuracy: 0,
  independent_rate: 0,
  hints_used: 0,
  xp: 0,
  due: 0,
  modules: [],
  activity: [],
  recent_errors: [],
};
vi.mock("./api", () => ({
  api: vi.fn((path: string) =>
    Promise.resolve(
      path === "/knowledge" ? [unit] : path === "/progress" ? progress : unit,
    ),
  ),
}));
const wrap = (ui: React.ReactNode, route = "/knowledge") =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe("knowledge base", () => {
  beforeEach(() => localStorage.clear());
  it("searches real material and filters libraries", async () => {
    wrap(<KnowledgeIndex />);
    expect(await screen.findByText("Группировка")).toBeInTheDocument();
    fireEvent.change(
      screen.getByPlaceholderText("Тема, метод, функция или ключевое слово"),
      { target: { value: "groupby" } },
    );
    expect(screen.getByText("Группировка")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "NumPy" }));
    expect(
      screen.getByText("Материалы по этому запросу не найдены."),
    ).toBeInTheDocument();
  });
  it("switches reading modes without navigation and remembers the choice", async () => {
    wrap(
      <Routes>
        <Route path="/knowledge/:articleSlug" element={<KnowledgeArticle />} />
      </Routes>,
      "/knowledge/groupby",
    );
    expect(await screen.findByText(".groupby().sum()")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Статья" }));
    expect(
      screen.getByText("Подробное объяснение группировки"),
    ).toBeInTheDocument();
    expect(localStorage.getItem("koda:knowledge-mode")).toBe("article");
  });
  it("searches and copies compact cheat-sheet entries", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    wrap(
      <Routes>
        <Route path="/knowledge/:articleSlug" element={<KnowledgeArticle />} />
      </Routes>,
      "/knowledge/groupby",
    );
    await screen.findByText(".groupby().sum()");
    fireEvent.change(screen.getByLabelText("Поиск по шпаргалке"), {
      target: { value: "суммирует" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Копировать пример: .groupby().sum()",
      }),
    );
    expect(writeText).toHaveBeenCalledWith("orders.groupby('region').sum()");
  });
});

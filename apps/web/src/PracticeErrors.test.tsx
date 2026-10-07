import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const apiMock = vi.fn();
vi.mock("./api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));
vi.mock("@monaco-editor/react", () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <textarea aria-label="Редактор Python" value={value} onChange={(event) => onChange(event.target.value)} /> }));

const exercise = { id: "start-001", difficulty: 1, title: "Тест", instructions: "Верните 42", learning_objective: "Тест", completion_summary: "Готово", setup_code: "", starter_code: "result = None", theory_article_id: "theory", knowledge_unit_id: "unit", dataset: {}, hints: [], is_control: false, xp: 15 };
const modules = [{ id: 1, slug: "start", title: "Старт", description: "", order: 1, topics: [{ id: 1, slug: "start", title: "Старт", summary: "", theory: "", syntax: "", example: "", mistakes: [], methods: [], exercises: [exercise] }] }];
const valid = { ok: true, execution_ms: 4, result: { kind: "scalar", data: 42 } };

function renderPractice() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={["/practice/start-001"]}><App /></MemoryRouter></QueryClientProvider>);
}

describe("Practice rejected actions", () => {
  beforeEach(() => { localStorage.clear(); apiMock.mockReset().mockImplementation((path: string) => path === "/exercises/start-001" ? Promise.resolve(exercise) : path === "/modules" ? Promise.resolve(modules) : path === "/progress" ? Promise.resolve({ solved: 0, solved_ids: [], total: 200, attempts: 0, first_try_accuracy: 0, independent_rate: 0, hints_used: 0, xp: 0, due: 0, modules: [], activity: [], recent_errors: [] }) : Promise.resolve({})); });
  afterEach(cleanup);

  for (const [label, endpoint] of [["Запустить", "/executions/run"], ["Проверить", "/attempts/submit"]] as const) {
    it(`shows and retries a rejected ${label} while preserving code and prior result`, async () => {
      renderPractice();
      const editor = await screen.findByLabelText("Редактор Python");
      fireEvent.change(editor, { target: { value: "result = 42" } });
      apiMock.mockImplementationOnce(() => Promise.resolve(valid));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
      expect(await screen.findByText("42")).toBeInTheDocument();
      apiMock.mockImplementationOnce(() => Promise.reject(new Error("Сеть недоступна")));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Сеть недоступна");
      expect(screen.getByText("Предыдущий результат")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect((screen.getByLabelText("Редактор Python") as HTMLTextAreaElement).value).toBe("result = 42");
      apiMock.mockImplementationOnce(() => Promise.resolve(valid));
      fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
      await waitFor(() => expect(apiMock.mock.calls.filter(([path]) => path === endpoint)).toHaveLength(3));
      expect((screen.getByLabelText("Редактор Python") as HTMLTextAreaElement).value).toBe("result = 42");
    });
  }
});

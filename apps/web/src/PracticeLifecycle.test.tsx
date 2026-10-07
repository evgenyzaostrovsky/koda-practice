import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { loadTaskState, saveTaskState, setStorageUser } from "./task-storage";
import { setCloudUser } from "./cloud-sync";

const apiMock = vi.fn();
vi.mock("./api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));
vi.mock("@monaco-editor/react", () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <textarea aria-label="Редактор Python" value={value} onChange={(event) => onChange(event.target.value)} /> }));
const exercises = [1, 2].map(n => ({ id: `start-00${n}`, difficulty: 1, title: `Задача ${n}`, instructions: "Верните число", learning_objective: "Тест", completion_summary: "Готово", setup_code: "", starter_code: `result = ${n}`, theory_article_id: "theory", knowledge_unit_id: "unit", dataset: {}, hints: [], is_control: false, xp: 15 }));
const modules = [{ id: 1, slug: "start", title: "Старт", description: "", order: 1, topics: [{ id: 1, slug: "start", title: "Старт", summary: "", theory: "", syntax: "", example: "", mistakes: [], methods: [], exercises }] }];
function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/practice/start-002')}>QA next route</button><button onClick={() => navigate('/catalog')}>QA leave route</button><button onClick={() => navigate('/practice/start-001')}>QA return route</button></>;
}
function renderPractice() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={["/practice/start-001"]}><Navigation /><App /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  localStorage.clear(); setStorageUser(null); setCloudUser(null);
  apiMock.mockReset().mockImplementation((path: string) => {
    if (path.startsWith('/exercises/')) return Promise.resolve(exercises.find(e => path === `/exercises/${e.id}`));
    if (path === '/modules') return Promise.resolve(modules);
    if (path === '/progress') return Promise.resolve({ solved: 0, solved_ids: [], total: 2, attempts: 0, first_try_accuracy: 0, independent_rate: 0, hints_used: 0, xp: 0, due: 0, modules: [], activity: [], recent_errors: [] });
    return Promise.resolve({});
  });
});
afterEach(() => { cleanup(); setCloudUser(null); setStorageUser(null); });
describe('Practice route lifecycle', () => {
  it('preserves the newest draft when leaving before the autosave delay', async () => {
    renderPractice();
    const editor = await screen.findByLabelText('Редактор Python');
    fireEvent.change(editor, { target: { value: 'result = 98765' } });
    fireEvent.click(screen.getByText('QA leave route'));
    fireEvent.click(screen.getByText('QA return route'));
    await waitFor(() => expect((screen.getByLabelText('Редактор Python') as HTMLTextAreaElement).value).toBe('result = 98765'));
  });
  it('does not display or save task A late Run output in task B', async () => {
    let finish!: (value: unknown) => void;
    renderPractice();
    await screen.findByLabelText('Редактор Python');
    apiMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /^Запустить/ }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    fireEvent.click(screen.getByText('QA next route'));
    await waitFor(() => expect((screen.getByLabelText('Редактор Python') as HTMLTextAreaElement).value).toBe('result = 2'));
    await act(async () => { finish({ ok: true, execution_ms: 1, result: { kind: 'scalar', data: 98765 } }); await new Promise(resolve => setTimeout(resolve, 450)); });
    expect(screen.queryByText('98765')).not.toBeInTheDocument();
    expect(loadTaskState('start-002')?.lastRunResult ?? null).toBeNull();
  });
  it('keeps edits made while a Run is pending when its response arrives', async () => {
    let finish!: (value: unknown) => void;
    renderPractice();
    const editor = await screen.findByLabelText('Редактор Python');
    fireEvent.change(editor, { target: { value: 'result = 41' } });
    apiMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /^Запустить/ }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    fireEvent.change(editor, { target: { value: 'result = 42' } });
    await act(async () => { finish({ ok: true, execution_ms: 1, result: { kind: 'scalar', data: 41 } }); });
    expect((editor as HTMLTextAreaElement).value).toBe('result = 42');
    expect(loadTaskState('start-001')?.code).toBe('result = 42');
    expect(apiMock.mock.calls.find(([path]) => path === '/executions/run')?.[1].body).toBe(JSON.stringify({ exercise_id: 'start-001', code: 'result = 41' }));
  });
  it('does not save a late response into a newly active account', async () => {
    let finish!: (value: unknown) => void;
    setStorageUser('A'); setCloudUser({ id: 'A' } as never);
    renderPractice();
    await screen.findByLabelText('Редактор Python');
    apiMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /^Запустить/ }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    setStorageUser('B'); setCloudUser({ id: 'B' } as never);
    await act(async () => { finish({ ok: true, execution_ms: 1, result: { kind: 'scalar', data: 98765 } }); });
    expect(loadTaskState('start-001')).toBeUndefined();
    expect(screen.queryByText('98765')).not.toBeInTheDocument();
  });
  it('reset restores starter code without erasing completion evidence', async () => {
    saveTaskState('start-001', { code: 'result = 42', status: 'completed', attempts: 7, completedAt: '2026-10-05T12:00:00Z' });
    renderPractice();
    await screen.findByLabelText('Редактор Python');
    fireEvent.click(screen.getByRole('button', { name: /Сбросить решение/ }));
    expect(loadTaskState('start-001')).toMatchObject({ code: 'result = 1', status: 'completed', attempts: 7, completedAt: '2026-10-05T12:00:00Z' });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
const { upsert, update } = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { from: () => ({ upsert, update }) } }));
import { importCloudTask, saveCloudTask, setCloudUser } from "./cloud-sync";

const draft = { taskId: "start-001", code: "new draft", status: "draft" as const, attempts: 0, lastRunResult: null, completedAt: null, updatedAt: new Date().toISOString() };
function existingRow(persisted: Record<string, unknown>) {
  upsert.mockImplementation(async (patch, options) => { if (!options?.ignoreDuplicates) Object.assign(persisted, Array.isArray(patch) ? patch[0] : patch); return { error: null }; });
  update.mockImplementation((patch) => ({ eq: (column: string, value: string) => ({ eq: async (otherColumn: string, otherValue: string) => {
    expect({ [column]: value, [otherColumn]: otherValue }).toEqual({ user_id: "qa-account", task_id: "start-001" });
    Object.assign(persisted, patch); return { error: null };
  } }) }));
  setCloudUser({ id: "qa-account" } as never);
}

afterEach(() => { setCloudUser(null); vi.clearAllMocks(); });
describe("draft synchronization preserves authoritative learning evidence", () => {
  it("does not reset opened hints when code is autosaved", async () => {
    const persisted = { hints_opened: 3, code: "old draft" };
    existingRow(persisted);
    await saveCloudTask(draft);
    expect(persisted.code).toBe("new draft");
    expect(persisted.hints_opened).toBe(3);
  });
  it("does not downgrade completed status, attempts or completion time with a stale draft", async () => {
    const persisted = { status: "completed", attempts_count: 7, hints_opened: 2, completed_at: "2026-10-05T12:00:00Z", code: "checked solution" };
    existingRow(persisted);
    await saveCloudTask(draft);
    expect(persisted).toEqual({ status: "completed", attempts_count: 7, hints_opened: 2, completed_at: "2026-10-05T12:00:00Z", code: "new draft", last_run_status: null, last_run_result: null, updated_at: draft.updatedAt });
  });
  it("explicit legacy import preserves existing account progress on conflict", async () => {
    const persisted = { status: "completed", attempts_count: 7, hints_opened: 2, completed_at: "2026-10-05T12:00:00Z", code: "account code" };
    existingRow(persisted);
    await importCloudTask(draft);
    expect(persisted).toEqual({ status: "completed", attempts_count: 7, hints_opened: 2, completed_at: "2026-10-05T12:00:00Z", code: "account code" });
  });
  it("does not import account A's remaining legacy tasks after switching to B", async () => {
    setCloudUser({ id: 'B' } as never);
    await importCloudTask(draft, 'A');
    expect(upsert).not.toHaveBeenCalled();
  });
});

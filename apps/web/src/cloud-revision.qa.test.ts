import type { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cloudTaskKey, contentRevision } from './content-revision';
import { cancelCloudRevisionTasks, loadAttempts, loadCloudTasks, saveCloudTask, scheduleCloudTask, setCloudUser } from './cloud-sync';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }));
beforeEach(() => { mocks.from.mockReset(); setCloudUser(null); setCloudUser({ id: 'qa-user' } as User); });
afterEach(() => { setCloudUser(null); vi.useRealTimers(); });

it('filters archived history before applying the visible history limit across pages', async () => {
  const history = [
    ...Array.from({ length: 100 }, (_, index) => ({ id: `old-${index}`, task_id: 'reading-009' })),
    { id: 'current', task_id: cloudTaskKey('reading-009') },
    { id: 'other', task_id: 'reading-001' },
  ];
  const ranges: number[][] = [];
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain);
  chain.range.mockImplementation((start: number, end: number) => { ranges.push([start, end]); return Promise.resolve({ data: history.slice(start, end + 1), error: null }); });
  mocks.from.mockReturnValue(chain);
  const actual = await loadAttempts(2);
  expect(actual.map(row => row.id)).toEqual(['current', 'other']);
  expect(actual.map(row => row.task_id)).toEqual(['reading-009', 'reading-001']);
  expect(ranges).toEqual([[0, 99], [100, 199]]);
});

it('hydrates only current revision and unrelated cloud task evidence on a fresh device', async () => {
  const rows = ['reading-009', cloudTaskKey('reading-009'), 'reading-001', 'obsolete::reading-009'].map(task_id => ({ task_id, code: 'answer', status: 'completed', attempts_count: 1 }));
  const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
  mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
  const tasks = await loadCloudTasks();
  expect(tasks.map(task => task.taskId)).toEqual(['reading-009', 'reading-001']);
  expect(tasks[0].contentRevision).toBe(contentRevision.revision);
});

it('writes new evidence to revision-qualified keys and does not write stale evidence', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const finalEq = vi.fn().mockResolvedValue({ error: null });
  const firstEq = vi.fn().mockReturnValue({ eq: finalEq });
  const update = vi.fn().mockReturnValue({ eq: firstEq });
  mocks.from.mockReturnValue({ upsert, update });
  const task = { taskId: 'reading-009', code: 'answer', status: 'draft' as const, attempts: 0, completedAt: null, updatedAt: '2026-10-08', lastRunResult: null };
  await saveCloudTask(task);
  expect(upsert).not.toHaveBeenCalled();
  await saveCloudTask({ ...task, contentRevision: contentRevision.revision });
  expect(upsert.mock.calls[0][0][0].task_id).toBe(cloudTaskKey(task.taskId));
  expect(finalEq).toHaveBeenCalledWith('task_id', cloudTaskKey(task.taskId));
});

it('cancels pending affected autosaves while retaining unrelated autosaves', async () => {
  vi.useFakeTimers();
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const finalEq = vi.fn().mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ upsert, update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: finalEq }) }) });
  const base = { code: 'answer', status: 'draft' as const, attempts: 0, completedAt: null, updatedAt: '2026-10-08', lastRunResult: null };
  scheduleCloudTask({ ...base, taskId: 'reading-009', contentRevision: contentRevision.revision });
  scheduleCloudTask({ ...base, taskId: 'reading-001' });
  cancelCloudRevisionTasks();
  await vi.advanceTimersByTimeAsync(700);
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(upsert.mock.calls[0][0][0].task_id).toBe('reading-001');
});

it('does not issue the second patch after switching accounts during an in-flight save', async () => {
  let resolve!: (value: { error: null }) => void;
  const upsert = vi.fn().mockImplementation(() => new Promise<{ error: null }>(done => { resolve = done; }));
  const update = vi.fn();
  mocks.from.mockReturnValue({ upsert, update });
  const task = { taskId: 'reading-009', contentRevision: contentRevision.revision, code: 'answer', status: 'draft' as const, attempts: 0, completedAt: null, updatedAt: '2026-10-08', lastRunResult: null };
  const saving = saveCloudTask(task);
  setCloudUser({ id: 'different-user' } as User);
  resolve({ error: null });
  await saving;
  expect(update).not.toHaveBeenCalled();
});

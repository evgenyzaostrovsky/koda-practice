import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contentRevision, cloudTaskKey, publicCloudTaskId } from './content-revision';
import { applyScopedContentRevision, loadLastTask, loadTaskState, mergeCloudTaskStates, saveTaskState, setStorageUser } from './task-storage';

vi.mock('./cloud-sync', () => ({ cancelCloudRevisionTasks: vi.fn(), scheduleCloudTask: vi.fn() }));
const affected = 'reading-009';
const unaffected = 'reading-001';
const key = 'koda:task-state:v1:qa-user';
const marker = `koda:content-revision:${contentRevision.revision}:qa-user`;
const state = (taskId: string) => ({ taskId, code: 'saved answer', status: 'completed' as const, attempts: 4, lastRunResult: null, completedAt: '2026-10-01', updatedAt: '2026-10-01' });
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('scoped authored content revision independent QA', () => {
  it('archives affected answers before resetting and preserves unrelated code and progress', () => {
    localStorage.setItem(key, JSON.stringify({ version: 1, tasks: { [affected]: state(affected), [unaffected]: state(unaffected) } }));
    localStorage.setItem('koda:last-task:v1:qa-user', affected);
    setStorageUser('qa-user');
    expect(loadTaskState(affected)).toBeUndefined();
    expect(loadTaskState(unaffected)).toEqual(state(unaffected));
    expect(loadLastTask()).toBeNull();
    expect(JSON.parse(localStorage.getItem(`${marker}:archive`)!)).toMatchObject({ tasks: { [affected]: state(affected) }, lastTask: affected });
    saveTaskState(affected, { code: 'new answer', status: 'completed' });
    expect(applyScopedContentRevision()).toBe(false);
    expect(loadTaskState(affected)?.code).toBe('new answer');
  });

  it('never resurrects old device evidence, but hydrates current revision on a new device', () => {
    setStorageUser('qa-user');
    mergeCloudTaskStates([state(affected), state(unaffected)]);
    expect(loadTaskState(affected)).toBeUndefined();
    expect(loadTaskState(unaffected)?.status).toBe('completed');
    mergeCloudTaskStates([{ ...state(affected), contentRevision: contentRevision.revision }]);
    expect(loadTaskState(affected)?.status).toBe('completed');
    expect(publicCloudTaskId(affected)).toBeNull();
    expect(publicCloudTaskId(cloudTaskKey(affected))).toBe(affected);
    for (const id of contentRevision.retired_task_ids ?? []) expect(publicCloudTaskId(cloudTaskKey(id))).toBeNull();
  });

  it('keeps all original evidence when archive storage fails', () => {
    setStorageUser('qa-user');
    localStorage.removeItem(marker);
    const original = JSON.stringify({ version: 1, tasks: { [affected]: state(affected) } });
    localStorage.setItem(key, original);
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, storageKey, value) {
      if (storageKey === `${marker}:archive`) throw new Error('quota exhausted');
      originalSet.call(this, storageKey, value);
    });
    expect(() => applyScopedContentRevision()).toThrow('quota exhausted');
    expect(localStorage.getItem(key)).toBe(original);
    expect(localStorage.getItem(marker)).toBeNull();
  });

  it('retains the first archive when interruption occurs after deletion but before the marker', () => {
    setStorageUser('qa-user');
    localStorage.removeItem(marker);
    localStorage.setItem(key, JSON.stringify({ version: 1, tasks: { [affected]: state(affected) } }));
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, storageKey, value) {
      if (storageKey === marker) throw new Error('interrupted marker write');
      originalSet.call(this, storageKey, value);
    });
    expect(() => applyScopedContentRevision()).toThrow('interrupted marker write');
    const archived = JSON.parse(localStorage.getItem(`${marker}:archive`)!);
    expect(archived.tasks[affected]).toEqual(state(affected));
    vi.restoreAllMocks();
    expect(applyScopedContentRevision()).toBe(true);
    expect(JSON.parse(localStorage.getItem(`${marker}:archive`)!).tasks[affected]).toEqual(state(affected));
  });
});

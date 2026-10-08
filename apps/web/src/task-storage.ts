import type { RunResult } from './types';
import { cancelCloudRevisionTasks, scheduleCloudTask } from './cloud-sync';
import { contentRevision, currentTaskEvidence, isRevisionTask, revisionForTask } from './content-revision';

export const TASK_STORAGE_VERSION = 1;
const LEGACY_TASKS_KEY = `koda:task-state:v${TASK_STORAGE_VERSION}`;
const LEGACY_LAST_TASK_KEY = `koda:last-task:v${TASK_STORAGE_VERSION}`;
let storageUserId: string | null = null;
const tasksKey = () => storageUserId ? `${LEGACY_TASKS_KEY}:${storageUserId}` : LEGACY_TASKS_KEY;
const lastTaskKey = () => storageUserId ? `${LEGACY_LAST_TASK_KEY}:${storageUserId}` : LEGACY_LAST_TASK_KEY;
const revisionKey = () => `koda:content-revision:${contentRevision.revision}:${storageUserId ?? 'anonymous'}`;
export const setStorageUser = (userId: string | null) => { storageUserId = userId; applyScopedContentRevision(); };

export type TaskStatus = 'draft' | 'completed';
export type TaskState = { taskId: string; code: string; status: TaskStatus; attempts: number; lastRunResult: RunResult | null; completedAt: string | null; updatedAt: string; contentRevision?: string };
type TaskStore = { version: number; tasks: Record<string, TaskState> };
const emptyStore = (): TaskStore => ({ version: TASK_STORAGE_VERSION, tasks: {} });
function readStore(): TaskStore {
  try { const value = JSON.parse(localStorage.getItem(tasksKey()) || 'null') as TaskStore | null; return value?.version === TASK_STORAGE_VERSION && value.tasks ? value : emptyStore(); } catch { return emptyStore(); }
}
function writeStore(store: TaskStore) { localStorage.setItem(tasksKey(), JSON.stringify(store)); }

export function applyScopedContentRevision() {
  if (localStorage.getItem(revisionKey())) return false;
  cancelCloudRevisionTasks();
  const store = readStore();
  const archived = Object.fromEntries(Object.entries(store.tasks).filter(([id, task]) => isRevisionTask(id) && !currentTaskEvidence({ ...task, taskId: id })));
  const last = localStorage.getItem(lastTaskKey());
  const clearLast = Boolean(last && isRevisionTask(last) && (!store.tasks[last] || archived[last]));
  // Archive first. A quota/storage failure cannot leave evidence deleted without
  // its archive; retrying before the marker only repeats this scoped operation.
  const archiveKey = `${revisionKey()}:archive`;
  const existingArchive = JSON.parse(localStorage.getItem(archiveKey) || 'null') as { appliedAt: string; tasks: Record<string, TaskState>; lastTask: string | null } | null;
  const archivedTasks = { ...archived, ...existingArchive?.tasks };
  localStorage.setItem(archiveKey, JSON.stringify({ appliedAt: existingArchive?.appliedAt ?? new Date().toISOString(), tasks: archivedTasks, lastTask: existingArchive?.lastTask ?? (clearLast ? last : null) }));
  for (const id of Object.keys(archived)) delete store.tasks[id];
  writeStore(store);
  if (clearLast) localStorage.removeItem(lastTaskKey());
  if (Object.keys(archivedTasks).length || clearLast) localStorage.setItem(`${revisionKey()}:notice`, 'pending');
  localStorage.setItem(revisionKey(), 'applied');
  return true;
}
export const hasRevisionNotice = () => localStorage.getItem(`${revisionKey()}:notice`) === 'pending';
export const dismissRevisionNotice = () => localStorage.setItem(`${revisionKey()}:notice`, 'seen');

export function loadTaskState(taskId: string) { const task = readStore().tasks[taskId]; return task && currentTaskEvidence(task) ? task : undefined; }
export function saveTaskState(taskId: string, patch: Partial<Omit<TaskState, 'taskId' | 'updatedAt'>>) {
  const store = readStore(), previous = store.tasks[taskId];
  const base: TaskState = previous ?? { taskId, code: '', status: 'draft', attempts: 0, lastRunResult: null, completedAt: null, updatedAt: '' };
  const next: TaskState = { ...base, ...patch, taskId, updatedAt: new Date().toISOString(), contentRevision: revisionForTask(taskId) };
  store.tasks[taskId] = next; writeStore(store); scheduleCloudTask(next); return next;
}
export function resetTaskState(taskId: string) { const store = readStore(); delete store.tasks[taskId]; writeStore(store); }
export function saveLastTask(taskId: string) { localStorage.setItem(lastTaskKey(), taskId); }
export function loadLastTask() { return localStorage.getItem(lastTaskKey()); }
export function mergeCloudTaskStates(tasks: TaskState[]) {
  const store = readStore();
  for (const task of tasks) {
    if (!currentTaskEvidence(task)) continue;
    const local = store.tasks[task.taskId];
    if (!local || new Date(task.updatedAt) > new Date(local.updatedAt) || task.status === 'completed' && local.status !== 'completed') store.tasks[task.taskId] = task;
  }
  writeStore(store);
}
export function migrateLegacyTasks() {
  try { return Object.values((JSON.parse(localStorage.getItem(LEGACY_TASKS_KEY) || '{}') as TaskStore).tasks || {}).filter(currentTaskEvidence); } catch { return []; }
}
export function hasLegacyTasks() { return migrateLegacyTasks().length > 0; }

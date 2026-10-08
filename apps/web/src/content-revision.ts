import revisionText from './content-revision-manifest.json?raw';

type ContentRevision = { revision: string; affected_task_ids: string[]; retired_task_ids?: string[]; active_task_ids?: string[] };
export const contentRevision = JSON.parse(revisionText) as ContentRevision;
const affected = new Set(contentRevision.affected_task_ids);
const retired = new Set(contentRevision.retired_task_ids ?? []);
const active = contentRevision.active_task_ids ? new Set(contentRevision.active_task_ids) : null;
export const isRevisionTask = (id: string) => affected.has(id);
export const isRetiredTask = (id: string) => retired.has(id);
export const revisionForTask = (id: string) => affected.has(id) ? contentRevision.revision : undefined;
// This is an internal persistence key, never a public catalog or route identity.
export const cloudTaskKey = (id: string) => affected.has(id) ? `${contentRevision.revision}::${id}` : id;
export function publicCloudTaskId(key: string): string | null {
  const prefix = `${contentRevision.revision}::`;
  if (key.startsWith(prefix)) {
    const id = key.slice(prefix.length);
    return affected.has(id) && !retired.has(id) && (!active || active.has(id)) ? id : null;
  }
  return key.includes('::') || affected.has(key) || retired.has(key) || (active && !active.has(key)) ? null : key;
}
export const currentTaskEvidence = (task: { taskId: string; contentRevision?: string }) =>
  !retired.has(task.taskId) && (!affected.has(task.taskId) || task.contentRevision === contentRevision.revision);
export const revisionNotice = 'KODA Market обновлён по авторскому курсу. Прогресс изменённых заданий начат заново; прежние записи сохранены в архиве. Другие задания и полученные достижения сохранены.';

import { getCloudUser } from './cloud-sync';
import type { ExerciseMode, RunResult } from './types';

export type AttemptFeedback = { version: 1; mode: ExerciseMode; error: string | null; error_type: string | null; line: number | null; explanation: RunResult['explanation'] };
export type HistoryRecord = { id: string; task_id: string; passed: boolean; result_type: string; error_type: string | null; created_at: string; execution_ms: number; feedback: AttemptFeedback | null; code?: string; source?: 'practice-run' | 'sandbox-run' | 'system' };
export type RunFailure = { id: string; ownerId: string | null; task_id: string; code: string; mode: ExerciseMode; created_at: string; execution_ms: number; error: string; error_type: string; line?: number | null; explanation?: RunResult['explanation']; source: NonNullable<HistoryRecord['source']> };
export const currentJournalOwner = () => getCloudUser()?.id ?? null;
export const journalKey = (ownerId: string | null) => `koda:run-observations:v1:${ownerId ?? 'anonymous'}`;
export const sandboxCodeKey = (ownerId = currentJournalOwner()) => ownerId ? `koda:sandbox-code:v1:${ownerId}` : 'koda:sandbox-code:v1';
export function diagnosticKind(record: Pick<HistoryRecord, 'source' | 'error_type' | 'feedback'>): 'system' | 'validation' | 'runtime' {
  if (record.source === 'system' || /^(InternalError|RunnerError|WorkerError|EnvironmentError)$/i.test(record.error_type ?? '') || record.feedback?.explanation?.kind === 'internal_error') return 'system';
  return record.source ? 'runtime' : 'validation';
}
export function loadRunFailures(ownerId: string | null): HistoryRecord[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(journalKey(ownerId)) ?? '[]'); return Array.isArray(value) ? value.filter((x): x is HistoryRecord => typeof x?.id === 'string' && typeof x.code === 'string' && typeof x.created_at === 'string' && Boolean(x.source)).slice(0, 50) : []; } catch { return []; }
}
export function recordRunFailure(value: RunFailure): boolean {
  if (currentJournalOwner() !== value.ownerId) return false;
  const feedback: AttemptFeedback = { version: 1, mode: value.mode, error: value.error, error_type: value.error_type, line: value.line ?? null, explanation: value.explanation ?? null };
  const record: HistoryRecord = { id: value.id, task_id: value.task_id, code: value.code, passed: false, result_type: value.error_type, error_type: value.error_type, created_at: value.created_at, execution_ms: value.execution_ms, source: diagnosticKind({ source: value.source, error_type: value.error_type, feedback }) === 'system' ? 'system' : value.source, feedback };
  try { const records = [record, ...loadRunFailures(value.ownerId).filter(x => x.id !== record.id)].slice(0, 50); while (records.length > 1 && JSON.stringify(records).length > 1000000) records.pop(); localStorage.setItem(journalKey(value.ownerId), JSON.stringify(records)); window.dispatchEvent(new Event('koda-run-observations')); return true; } catch { window.dispatchEvent(new Event('koda-run-observation-failed')); return false; }
}
export const diagnosticSignature = (record: HistoryRecord) => `${record.task_id}|${record.feedback?.mode ?? 'unknown'}|${diagnosticKind(record)}|${record.error_type ?? record.result_type}|${record.feedback?.error ?? record.feedback?.explanation?.what ?? ''}`;
export function diagnosticDescription(record: HistoryRecord) {
  if (diagnosticKind(record) === 'system') return 'Выполнение не завершилось из-за сбоя среды или соединения. Это не означает, что решение неверно.';
  const explanation = record.feedback?.explanation;
  const type = record.error_type ?? record.result_type;
  if (/WrongMethod/i.test(type)) return 'Результат совпал с ожидаемым, но решение не использует приём, который проверяет эта задача. Сверьте способ решения с условием.';
  if (/WrongAnswer/i.test(type)) return explanation?.difference ? `Результат не совпал с ожидаемым. ${explanation.difference}` : 'Результат не совпал с ожидаемым. Сопоставьте результат с условием и проверьте промежуточные шаги.';
  if (record.feedback?.mode !== 'python') return record.feedback ? 'Сохранён фактический результат проверки. Сопоставьте сообщение с ответом и условием задания.' : 'Подробное сообщение этой старой попытки не сохранено.';
  if (/ZeroDivisionError/.test(type)) return 'Делитель оказался равен нулю. Проверьте значение знаменателя перед делением и обработайте случай, когда он равен нулю.';
  if (/KeyError/.test(record.error_type ?? '')) return 'Запрошенный ключ или столбец не найден. Проверьте имя и доступные столбцы.';
  if (/NameError/.test(record.error_type ?? '')) return 'Имя не определено в момент выполнения. Проверьте написание и порядок присваиваний.';
  if (/TypeError/.test(type)) return 'Операция получила несовместимый тип данных или неподходящие аргументы. Проверьте типы значений и способ вызова.';
  if (/ValueError/.test(type)) return 'Тип значения допустим, но само значение или его формат не подходит для операции. Проверьте содержимое входных данных.';
  if (/SyntaxError|IndentationError/.test(record.error_type ?? '')) return 'Python не смог разобрать код. Проверьте синтаксис и отступы в указанном месте.';
  return record.feedback ? `По одному типу ошибки нельзя достоверно установить причину. Сопоставьте сообщение с сохранённым кодом.${explanation?.difference ? ` ${explanation.difference}` : ''}` : 'У старой записи нет подробного сообщения. Код доступен, но причину ошибки восстановить достоверно нельзя.';
}
export function diagnosticGuidance(record: HistoryRecord): string[] {
  if (diagnosticKind(record) === 'system') return ['Дождитесь готовности среды или проверьте соединение.', 'Повторите запуск без изменения кода.', 'Если сбой повторится, сохраните сообщение для поддержки.'];
  const type = record.error_type ?? record.result_type, explanation = record.feedback?.explanation;
  if (/WrongAnswer|WrongMethod/i.test(type)) return [explanation?.check || 'Сопоставьте ответ и требуемый способ решения с условием.', explanation?.nudge || 'Проверьте промежуточный результат.', 'Внесите исправление и повторите проверку.'];
  if (record.feedback?.mode !== 'python') return [record.feedback?.mode === 'sql' ? 'Проверьте имена таблиц, столбцов и синтаксис запроса.' : record.feedback?.mode === 'excel' ? 'Проверьте значения полей, диапазоны и параметры формулы.' : record.feedback?.mode === 'power-bi' ? 'Проверьте выбранные поля, связи и параметры визуализации.' : 'Сопоставьте сообщение с сохранённым ответом.', 'Сверьте входные данные и условие задания.', 'Повторите проверку после изменения.'];
  if (/ZeroDivisionError/.test(type)) return ['Найдите деление в сохранённом коде и проверьте значение знаменателя.', 'Проверьте входные данные на нули и предусмотрите обработку нулевого делителя.', 'Запустите исправленный код снова.'];
  if (/KeyError/.test(type)) return ['Сверьте запрошенный ключ или столбец с фактическими именами.', 'Проверьте регистр, пробелы и способ обращения к данным.', 'Исправьте имя или обращение и запустите код снова.'];
  if (/NameError/.test(type)) return ['Найдите имя из сообщения в сохранённом коде.', 'Проверьте написание и что значение определено до использования.', 'Исправьте порядок выполнения и запустите код снова.'];
  if (/TypeError/.test(type)) return ['Проверьте типы значений в проблемной операции.', 'Сверьте переданные аргументы с допустимыми для этого вызова.', 'Исправьте операцию или тип данных и запустите код снова.'];
  if (/SyntaxError|IndentationError/.test(type)) return [record.feedback?.line ? `Проверьте сохранённую строку ${record.feedback.line} и соседние строки.` : 'Проверьте место, указанное в сообщении ошибки.', 'Сверьте скобки, кавычки, двоеточия и отступы.', 'После исправления синтаксиса запустите код снова.'];
  if (/ValueError/.test(type)) return ['Проверьте содержимое значения, которое передано операции.', 'Сверьте формат и допустимый диапазон входных данных.', 'Исправьте значение или его обработку и запустите код снова.'];
  return ['Сопоставьте фактическое сообщение с сохранённым кодом.', 'Проверьте значения и порядок выполнения рядом с ошибкой.', 'Внесите одно изменение и запустите код снова.'];
}

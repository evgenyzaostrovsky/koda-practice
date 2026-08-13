import type{User}from'@supabase/supabase-js';
import{supabase}from'./supabase';
import type{TaskState}from'./task-storage';

export type ProfileRecord={user_id:string;display_name:string;username:string|null;created_at:string;updated_at:string;last_active_at:string};
export type SolutionAttempt={id:string;task_id:string;code:string;passed:boolean;result_type:string;execution_ms:number;created_at:string};

export type SyncStatus='saved'|'saving'|'offline'|'error';
let user:User|null=null,status:SyncStatus='saved',listeners=new Set<(value:SyncStatus)=>void>(),timers=new Map<string,ReturnType<typeof setTimeout>>(),pending=new Map<string,TaskState>();
const setStatus=(value:SyncStatus)=>{status=value;listeners.forEach(fn=>fn(value))};
export const getCloudUser=()=>user;
export const watchSyncStatus=(fn:(value:SyncStatus)=>void)=>{listeners.add(fn);fn(status);return()=>listeners.delete(fn)};
export const setCloudUser=(value:User|null)=>{user=value};

function row(task:TaskState){return{user_id:user!.id,task_id:task.taskId,code:task.code,status:task.status==='completed'?'completed':task.code?'in_progress':'not_started',attempts_count:task.attempts,hints_opened:0,last_run_status:task.lastRunResult?.passed?'passed':task.lastRunResult?'failed':null,last_run_result:task.lastRunResult,completed_at:task.completedAt,updated_at:task.updatedAt}}
export async function saveCloudTask(task:TaskState){if(!supabase||!user)return;pending.set(task.taskId,task);setStatus('saving');const{error}=await supabase.from('task_progress').upsert(row(task),{onConflict:'user_id,task_id'});if(error){setStatus(navigator.onLine?'error':'offline');throw error}pending.delete(task.taskId);setStatus(pending.size?'saving':'saved')}
export function scheduleCloudTask(task:TaskState){if(!user)return;pending.set(task.taskId,task);clearTimeout(timers.get(task.taskId));timers.set(task.taskId,setTimeout(()=>saveCloudTask(task).catch(()=>{}),600))}
if(typeof window!=='undefined')window.addEventListener('online',()=>{for(const task of pending.values())saveCloudTask(task).catch(()=>{})});
export async function loadCloudTasks(){if(!supabase||!user)return[];const{data,error}=await supabase.from('task_progress').select('*');if(error)throw error;return(data||[]).map(x=>({taskId:x.task_id,code:x.code,status:x.status==='completed'?'completed':'draft',attempts:x.attempts_count,lastRunResult:x.last_run_result,completedAt:x.completed_at,updatedAt:x.updated_at})as TaskState)}
export async function loadProfile(){if(!supabase||!user)return null;const{data,error}=await supabase.from('profiles').select('*').single();if(error)throw error;return data as ProfileRecord}
export async function updateDisplayName(display_name:string){if(!supabase||!user)return;const{error}=await supabase.from('profiles').update({display_name,last_active_at:new Date().toISOString()}).eq('user_id',user.id);if(error)throw error}
export async function updateProfileIdentity(display_name:string,username:string){if(!supabase||!user)return;const{error}=await supabase.from('profiles').update({display_name,username,last_active_at:new Date().toISOString()}).eq('user_id',user.id);if(error)throw error}
export async function loadAttempts(limit=100){if(!supabase||!user)return[];const{data,error}=await supabase.from('solution_attempts').select('id,task_id,code,passed,result_type,execution_ms,created_at').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return(data||[])as SolutionAttempt[]}

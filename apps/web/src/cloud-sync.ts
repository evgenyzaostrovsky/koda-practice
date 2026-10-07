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
export const setCloudUser=(value:User|null)=>{if(user?.id!==value?.id){for(const timer of timers.values())clearTimeout(timer);timers.clear();pending.clear()}user=value};

function draftRow(task:TaskState,userId:string){return{user_id:userId,task_id:task.taskId,code:task.code,last_run_status:task.lastRunResult?.passed?'passed':task.lastRunResult?'failed':null,last_run_result:task.lastRunResult,updated_at:task.updatedAt}}
export async function saveCloudTask(task:TaskState,expectedUserId=user?.id){
 if(!supabase||!user||!expectedUserId||user.id!==expectedUserId)return;
 pending.set(task.taskId,task);setStatus('saving');
 // Insert defaults only for a new row; conflict-ignore cannot overwrite evidence.
 const initial=await supabase.from('task_progress').upsert([{...draftRow(task,expectedUserId),status:task.code?'in_progress':'not_started'}],{onConflict:'user_id,task_id',ignoreDuplicates:true,defaultToNull:false});
 if(user?.id!==expectedUserId)return;
 let error=initial.error;
 if(!error){
  const {user_id,task_id,...patch}=draftRow(task,expectedUserId);
  const updated=await supabase.from('task_progress').update(patch).eq('user_id',user_id).eq('task_id',task_id);
  error=updated.error;
 }
 if(user?.id!==expectedUserId)return;
 if(error){setStatus(navigator.onLine?'error':'offline');throw error}
 if(pending.get(task.taskId)===task)pending.delete(task.taskId);
 setStatus(pending.size?'saving':'saved');
}
// Explicit legacy import: existing account progress always wins on conflict.
export async function importCloudTask(task:TaskState,expectedUserId=user?.id){
 if(!supabase||!user||!expectedUserId||user.id!==expectedUserId)return;
 const {error}=await supabase.from('task_progress').upsert([{...draftRow(task,expectedUserId),status:task.status==='completed'?'completed':task.code?'in_progress':'not_started',attempts_count:task.attempts,completed_at:task.completedAt}],{onConflict:'user_id,task_id',ignoreDuplicates:true,defaultToNull:false});
 if(error)throw error;
}
export function scheduleCloudTask(task:TaskState){if(!user)return;const userId=user.id;pending.set(task.taskId,task);clearTimeout(timers.get(task.taskId));timers.set(task.taskId,setTimeout(()=>saveCloudTask(task,userId).catch(()=>{}),600))}
if(typeof window!=='undefined')window.addEventListener('online',()=>{for(const task of pending.values())saveCloudTask(task).catch(()=>{})});
export async function loadCloudTasks(){if(!supabase||!user)return[];const{data,error}=await supabase.from('task_progress').select('*');if(error)throw error;return(data||[]).map(x=>({taskId:x.task_id,code:x.code,status:x.status==='completed'?'completed':'draft',attempts:x.attempts_count,lastRunResult:x.last_run_result,completedAt:x.completed_at,updatedAt:x.updated_at})as TaskState)}
export async function loadProfile(){if(!supabase||!user)return null;const{data,error}=await supabase.from('profiles').select('*').single();if(error)throw error;return data as ProfileRecord}
export async function updateDisplayName(display_name:string){if(!supabase||!user)return;const{error}=await supabase.from('profiles').update({display_name,last_active_at:new Date().toISOString()}).eq('user_id',user.id);if(error)throw error}
export async function updateProfileIdentity(display_name:string,username:string){if(!supabase||!user)return;const{error}=await supabase.from('profiles').update({display_name,username,last_active_at:new Date().toISOString()}).eq('user_id',user.id);if(error)throw error}
export async function loadAttempts(limit=100){if(!supabase||!user)return[];const{data,error}=await supabase.from('solution_attempts').select('id,task_id,code,passed,result_type,execution_ms,created_at').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return(data||[])as SolutionAttempt[]}

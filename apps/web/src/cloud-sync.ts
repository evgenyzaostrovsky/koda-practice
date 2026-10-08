import type{User}from'@supabase/supabase-js';
import{supabase}from'./supabase';
import type{TaskState}from'./task-storage';
import { cloudTaskKey, currentTaskEvidence, isRevisionTask, publicCloudTaskId, revisionForTask } from './content-revision';
let generation = 0, revisionGeneration = 0;
export function cancelCloudRevisionTasks() {
 revisionGeneration++;
 for (const [id,timer] of timers) if (isRevisionTask(id)) { clearTimeout(timer); timers.delete(id); pending.delete(id); }
 for (const id of pending.keys()) if (isRevisionTask(id)) pending.delete(id);
 if (!pending.size) setStatus('saved');
}

export type ProfileRecord={user_id:string;display_name:string;username:string|null;created_at:string;updated_at:string;last_active_at:string};
export type SolutionAttempt={id:string;task_id:string;code:string;passed:boolean;result_type:string;execution_ms:number;created_at:string};

export type SyncStatus='saved'|'saving'|'offline'|'error';
let user:User|null=null,status:SyncStatus='saved',listeners=new Set<(value:SyncStatus)=>void>(),timers=new Map<string,ReturnType<typeof setTimeout>>(),pending=new Map<string,TaskState>();
const setStatus=(value:SyncStatus)=>{status=value;listeners.forEach(fn=>fn(value))};
export const getCloudUser=()=>user;
export const watchSyncStatus=(fn:(value:SyncStatus)=>void)=>{listeners.add(fn);fn(status);return()=>listeners.delete(fn)};
export const setCloudUser=(value:User|null)=>{if(user?.id!==value?.id){generation++;for(const timer of timers.values())clearTimeout(timer);timers.clear();pending.clear()}user=value};

function draftRow(task:TaskState,userId:string){return{user_id:userId,task_id:cloudTaskKey(task.taskId),code:task.code,last_run_status:task.lastRunResult?.passed?'passed':task.lastRunResult?'failed':null,last_run_result:task.lastRunResult,updated_at:task.updatedAt}}
export async function saveCloudTask(task:TaskState,expectedUserId=user?.id){
 if(!supabase||!user||!expectedUserId||user.id!==expectedUserId||!currentTaskEvidence(task))return;
 const expectedGeneration=generation,expectedRevisionGeneration=revisionGeneration;
 pending.set(task.taskId,task);setStatus('saving');
 // Insert defaults only for a new row; conflict-ignore cannot overwrite evidence.
 const initial=await supabase.from('task_progress').upsert([{...draftRow(task,expectedUserId),status:task.code?'in_progress':'not_started'}],{onConflict:'user_id,task_id',ignoreDuplicates:true,defaultToNull:false});
 if(user?.id!==expectedUserId||generation!==expectedGeneration||(isRevisionTask(task.taskId)&&revisionGeneration!==expectedRevisionGeneration))return;
 let error=initial.error;
 if(!error){
  const {user_id,task_id,...patch}=draftRow(task,expectedUserId);
  const updated=await supabase.from('task_progress').update(patch).eq('user_id',user_id).eq('task_id',task_id);
  error=updated.error;
 }
 if(user?.id!==expectedUserId||generation!==expectedGeneration||(isRevisionTask(task.taskId)&&revisionGeneration!==expectedRevisionGeneration))return;
 if(error){setStatus(navigator.onLine?'error':'offline');throw error}
 if(pending.get(task.taskId)===task)pending.delete(task.taskId);
 setStatus(pending.size?'saving':'saved');
}
// Explicit legacy import: existing account progress always wins on conflict.
export async function importCloudTask(task:TaskState,expectedUserId=user?.id){
 if(!supabase||!user||!expectedUserId||user.id!==expectedUserId||!currentTaskEvidence(task))return;
 const expectedGeneration=generation,expectedRevisionGeneration=revisionGeneration;
 const {error}=await supabase.from('task_progress').upsert([{...draftRow(task,expectedUserId),status:task.status==='completed'?'completed':task.code?'in_progress':'not_started',attempts_count:task.attempts,completed_at:task.completedAt}],{onConflict:'user_id,task_id',ignoreDuplicates:true,defaultToNull:false});
 if(user?.id!==expectedUserId||generation!==expectedGeneration||(isRevisionTask(task.taskId)&&revisionGeneration!==expectedRevisionGeneration))return;
 if(error)throw error;
}
export function scheduleCloudTask(task:TaskState){if(!user||!currentTaskEvidence(task))return;const userId=user.id;pending.set(task.taskId,task);clearTimeout(timers.get(task.taskId));timers.set(task.taskId,setTimeout(()=>saveCloudTask(task,userId).catch(()=>{}),600))}
if(typeof window!=='undefined')window.addEventListener('online',()=>{for(const task of pending.values())saveCloudTask(task).catch(()=>{})});
export async function loadCloudTasks(){
 if(!supabase||!user)return[];
 const userId=user.id,expectedGeneration=generation;
 const{data,error}=await supabase.from('task_progress').select('*').eq('user_id',userId);
 if(error)throw error;
 if(user?.id!==userId||generation!==expectedGeneration)return[];
 return(data||[]).flatMap(x=>{const taskId=publicCloudTaskId(x.task_id);return taskId?[{taskId,code:x.code,status:x.status==='completed'?'completed':'draft',attempts:x.attempts_count,lastRunResult:x.last_run_result,completedAt:x.completed_at,updatedAt:x.updated_at,contentRevision:revisionForTask(taskId)} as TaskState]:[]});
}
export async function loadProfile(){if(!supabase||!user)return null;const{data,error}=await supabase.from('profiles').select('*').single();if(error)throw error;return data as ProfileRecord}
export async function updateDisplayName(display_name:string){if(!supabase||!user)return;const{error}=await supabase.from('profiles').update({display_name,last_active_at:new Date().toISOString()}).eq('user_id',user.id);if(error)throw error}
export async function updateProfileIdentity(display_name:string,username:string){if(!supabase||!user)return;const{error}=await supabase.from('profiles').update({display_name,username,last_active_at:new Date().toISOString()}).eq('user_id',user.id);if(error)throw error}
export async function loadAttempts(limit=100){
 if(!supabase||!user)return[];
 const userId=user.id,expectedGeneration=generation,rows:SolutionAttempt[]=[];
 const pageSize=Math.max(100,Math.min(limit,500));
 // Filter archived revisions before applying the visible history limit, so
 // old affected evidence cannot crowd current/unrelated attempts out.
 for(let offset=0;rows.length<limit;offset+=pageSize){
  const{data,error}=await supabase.from('solution_attempts').select('id,task_id,code,passed,result_type,execution_ms,created_at').eq('user_id',userId).order('created_at',{ascending:false}).range(offset,offset+pageSize-1);
  if(error)throw error;
  if(user?.id!==userId||generation!==expectedGeneration)return[];
  for(const row of data||[]){const taskId=publicCloudTaskId(row.task_id);if(taskId)rows.push({...row,task_id:taskId} as SolutionAttempt);}
  if(!data||data.length<pageSize)break;
 }
 return rows.slice(0,limit);
}

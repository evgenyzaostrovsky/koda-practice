import type {RunResult} from './types';
import{scheduleCloudTask}from'./cloud-sync';

export const TASK_STORAGE_VERSION=1;
const LEGACY_TASKS_KEY=`koda:task-state:v${TASK_STORAGE_VERSION}`;
const LEGACY_LAST_TASK_KEY=`koda:last-task:v${TASK_STORAGE_VERSION}`;
let storageUserId:string|null=null;
const tasksKey=()=>storageUserId?`${LEGACY_TASKS_KEY}:${storageUserId}`:LEGACY_TASKS_KEY;
const lastTaskKey=()=>storageUserId?`${LEGACY_LAST_TASK_KEY}:${storageUserId}`:LEGACY_LAST_TASK_KEY;
export const setStorageUser=(userId:string|null)=>{storageUserId=userId};

export type TaskStatus='draft'|'completed';
export type TaskState={taskId:string;code:string;status:TaskStatus;attempts:number;lastRunResult:RunResult|null;completedAt:string|null;updatedAt:string};
type TaskStore={version:number;tasks:Record<string,TaskState>};

const emptyStore=():TaskStore=>({version:TASK_STORAGE_VERSION,tasks:{}});

function readStore():TaskStore{
 try{const value=JSON.parse(localStorage.getItem(tasksKey())||'null') as TaskStore|null;return value?.version===TASK_STORAGE_VERSION&&value.tasks?value:emptyStore()}catch{return emptyStore()}
}

function writeStore(store:TaskStore){localStorage.setItem(tasksKey(),JSON.stringify(store))}

export function loadTaskState(taskId:string){return readStore().tasks[taskId]}

export function saveTaskState(taskId:string,patch:Partial<Omit<TaskState,'taskId'|'updatedAt'>>){
 const store=readStore(),previous=store.tasks[taskId];
 const base:TaskState=previous??{taskId,code:'',status:'draft',attempts:0,lastRunResult:null,completedAt:null,updatedAt:''};
 const next:TaskState={...base,...patch,taskId,updatedAt:new Date().toISOString()};
 store.tasks[taskId]=next;writeStore(store);scheduleCloudTask(next);return next;
}

export function resetTaskState(taskId:string){const store=readStore();delete store.tasks[taskId];writeStore(store)}
export function saveLastTask(taskId:string){localStorage.setItem(lastTaskKey(),taskId)}
export function loadLastTask(){return localStorage.getItem(lastTaskKey())}
export function hasLegacyTasks(){try{return Object.keys((JSON.parse(localStorage.getItem(LEGACY_TASKS_KEY)||'{}') as TaskStore).tasks||{}).length>0}catch{return false}}
export function mergeCloudTaskStates(tasks:TaskState[]){const store=readStore();for(const task of tasks){const local=store.tasks[task.taskId];if(!local||new Date(task.updatedAt)>new Date(local.updatedAt)||task.status==='completed'&&local.status!=='completed')store.tasks[task.taskId]=task}writeStore(store)}
export function migrateLegacyTasks(){const legacy=localStorage.getItem(LEGACY_TASKS_KEY);if(!legacy)return[];try{return Object.values((JSON.parse(legacy)as TaskStore).tasks||{})}catch{return[]}}

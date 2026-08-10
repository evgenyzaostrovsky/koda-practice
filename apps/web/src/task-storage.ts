import type {RunResult} from './types';

export const TASK_STORAGE_VERSION=1;
const TASKS_KEY=`koda:task-state:v${TASK_STORAGE_VERSION}`;
const LAST_TASK_KEY=`koda:last-task:v${TASK_STORAGE_VERSION}`;

export type TaskStatus='draft'|'completed';
export type TaskState={taskId:string;code:string;status:TaskStatus;attempts:number;lastRunResult:RunResult|null;completedAt:string|null;updatedAt:string};
type TaskStore={version:number;tasks:Record<string,TaskState>};

const emptyStore=():TaskStore=>({version:TASK_STORAGE_VERSION,tasks:{}});

function readStore():TaskStore{
 try{const value=JSON.parse(localStorage.getItem(TASKS_KEY)||'null') as TaskStore|null;return value?.version===TASK_STORAGE_VERSION&&value.tasks?value:emptyStore()}catch{return emptyStore()}
}

function writeStore(store:TaskStore){localStorage.setItem(TASKS_KEY,JSON.stringify(store))}

export function loadTaskState(taskId:string){return readStore().tasks[taskId]}

export function saveTaskState(taskId:string,patch:Partial<Omit<TaskState,'taskId'|'updatedAt'>>){
 const store=readStore(),previous=store.tasks[taskId];
 const base:TaskState=previous??{taskId,code:'',status:'draft',attempts:0,lastRunResult:null,completedAt:null,updatedAt:''};
 const next:TaskState={...base,...patch,taskId,updatedAt:new Date().toISOString()};
 store.tasks[taskId]=next;writeStore(store);return next;
}

export function resetTaskState(taskId:string){const store=readStore();delete store.tasks[taskId];writeStore(store)}
export function saveLastTask(taskId:string){localStorage.setItem(LAST_TASK_KEY,taskId)}
export function loadLastTask(){return localStorage.getItem(LAST_TASK_KEY)}

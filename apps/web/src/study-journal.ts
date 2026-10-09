import type { AchievementEvent } from './achievements/types';
import { validStudyInterval } from './study-time';
const prefix=(userId:string|null)=>`koda:study-interval:v1:${userId??'anonymous'}:`;
const caches=new Map<string,Map<string,AchievementEvent>>();
export function readStudyJournal(userId:string|null){
 const scope=prefix(userId);let rows=caches.get(scope);
 if(!rows){rows=new Map();try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(scope))continue;try{const event=JSON.parse(localStorage.getItem(key)||'null') as AchievementEvent;if(event?.type==='study_interval_recorded'&&validStudyInterval(event.payload))rows.set(event.eventId,event);}catch{/* damaged row is not evidence */}}}catch{return [];}caches.set(scope,rows);}
 return [...rows.values()];
}
export function appendStudyJournal(userId:string|null,event:AchievementEvent){
 if(event.type!=='study_interval_recorded'||!validStudyInterval(event.payload))throw new Error('Invalid study evidence');
 const key=prefix(userId)+event.eventId;
 const existing=localStorage.getItem(key);if(existing)return;
 localStorage.setItem(key,JSON.stringify(event));
 const rows=caches.get(prefix(userId));if(rows)rows.set(event.eventId,event);
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key?.startsWith('koda:study-interval:v1:')){caches.clear();window.dispatchEvent(new Event('koda-study-updated'));}});

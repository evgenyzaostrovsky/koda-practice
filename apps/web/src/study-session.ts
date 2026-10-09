import { loadSnapshot, recordStudyInterval } from './achievements/engine';
import { measuredStudySeconds, studyTotals, validStudyInterval, type StudyInterval } from './study-time';

type Session={id:string;status:'running'|'paused'|'finished';elapsedMs:number;lastEnd:number};
export type StudySessionView={status:Session['status']|'idle';seconds:number;error:string|null;busy:boolean};
let account:string|null=null,session:Session|null=null,error:string|null=null,busy=false,mono=0,anchor=0,lastHeartbeat=0;
const owner=crypto.randomUUID(),listeners=new Set<()=>void>();
let releaseLock:(()=>void)|null=null,ticker:ReturnType<typeof setInterval>|null=null;
const scope=()=>account??'anonymous',key=()=>`koda:study-session:v1:${scope()}`,leaseKey=()=>`${key()}:owner`;
const notify=()=>{listeners.forEach(fn=>fn());window.dispatchEvent(new Event('koda-study-updated'));};
function lease(){try{return JSON.parse(localStorage.getItem(leaseKey())||'null') as {owner:string;until:number}|null;}catch{return null;}}
function persist(){localStorage.setItem(key(),JSON.stringify(session));}
function fail(){error='Не удалось сохранить время. Таймер приостановлен. Проверьте доступ к хранилищу и повторите.';if(session)session.status='paused';stopOwnership();notify();}
function stopOwnership(){if(ticker)clearInterval(ticker);ticker=null;releaseLock?.();releaseLock=null;try{if(lease()?.owner===owner)localStorage.removeItem(leaseKey());}catch{/* error already visible */}}
// Heartbeats confirm visibility every five seconds; durable intervals are at most
// sixty seconds apart. An abrupt crash can lose the unflushed minute only.
function flushInterval(elapsed:number){
 if(!session||elapsed<1)return;
 const interval:StudyInterval={id:crypto.randomUUID(),sessionId:session.id,start:new Date(anchor).toISOString(),end:new Date(anchor+elapsed).toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',schema:1};
 if(!recordStudyInterval(interval,account))throw new Error('Account changed');
 session.lastEnd=Date.parse(interval.end);session.elapsedMs+=session.lastEnd-Date.parse(interval.start);anchor=session.lastEnd;mono+=elapsed;
}
function checkpoint(flush=false){
 if(!session||session.status!=='running')return false;
 const claimed=lease();if(!claimed||claimed.owner!==owner){session.status='paused';stopOwnership();error='\u0422\u0430\u0439\u043c\u0435\u0440 \u043e\u0442\u043a\u0440\u044b\u0442 \u0432 \u0434\u0440\u0443\u0433\u043e\u0439 \u0432\u043a\u043b\u0430\u0434\u043a\u0435. \u0417\u0434\u0435\u0441\u044c \u043e\u043d \u043f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.';notify();return false;}
 const now=performance.now();
 // Do not credit an unobserved OS sleep or stalled heartbeat gap (>30s).
 if(now-lastHeartbeat>30000){flushInterval(Math.max(0,lastHeartbeat-mono));session.status='paused';stopOwnership();persist();error='\u041f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0435\u0440\u044b\u0432\u0430 \u0442\u0430\u0439\u043c\u0435\u0440 \u043f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d. \u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u0435, \u043a\u043e\u0433\u0434\u0430 \u0431\u0443\u0434\u0435\u0442\u0435 \u0433\u043e\u0442\u043e\u0432\u044b.';notify();return false;}
 lastHeartbeat=now;
 const elapsed=Math.max(0,now-mono);
 if(flush||elapsed>=60000)flushInterval(elapsed);
 localStorage.setItem(leaseKey(),JSON.stringify({owner,until:Date.now()+15000}));persist();notify();return true;
}
export function setStudySessionUser(userId:string|null,force=false){
 if(account===userId&&session&&!force)return;
 pauseStudySession();account=userId;session=null;error=null;
 try{
  const saved=JSON.parse(localStorage.getItem(key())||'null') as Session|null;
  const all=loadSnapshot().events.filter(event=>event.type==='study_interval_recorded'&&validStudyInterval(event.payload));
  const latest=all.reduce<StudyInterval|null>((found,event)=>{const interval=event.payload as StudyInterval;return !found||Date.parse(interval.end)>Date.parse(found.end)?interval:found;},null);
  const previous=saved&&typeof saved.id==='string'&&saved.id&&Number.isFinite(saved.lastEnd)&&saved.lastEnd>=0?saved:latest?{id:latest.sessionId,status:'paused' as const,elapsedMs:0,lastEnd:Date.parse(latest.end)}:null;
  if(previous){
   const evidence=all.filter(event=>event.payload.sessionId===previous.id);
   const lastEnd=Math.max(previous.lastEnd,...evidence.map(event=>Date.parse(String(event.payload.end))));
   // Restoration is read-only: an observing tab must never rewrite owner metadata.
   session={...previous,elapsedMs:measuredStudySeconds(evidence)*1000,lastEnd,status:previous.status==='finished'?'finished':'paused'};
  }
 }catch{fail();}
 notify();
}

export function studySessionView():StudySessionView{return{status:session?.status??'idle',seconds:(session?.elapsedMs??0)/1000+(session?.status==='running'?Math.max(0,Math.min(performance.now(),lastHeartbeat+30000)-mono)/1000:0),error,busy};}
export const subscribeStudySession=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export async function startStudySession(){
 if(busy||session?.status==='running'||document.hidden)return;busy=true;error=null;const expectedAccount=account;notify();
 const activate=(locked=false)=>{if(account!==expectedAccount||document.hidden)return false;const other=lease();if(!locked&&other&&other.owner!==owner&&other.until>Date.now()){error='Занятие уже запущено в другой вкладке.';return false;}
  if(!session||session.status==='finished')session={id:crypto.randomUUID(),status:'paused',elapsedMs:0,lastEnd:0};
  localStorage.setItem(leaseKey(),JSON.stringify({owner,until:Date.now()+15000}));if(lease()?.owner!==owner)return false;
  session.status='running';anchor=Math.max(Date.now(),session.lastEnd);mono=performance.now();lastHeartbeat=mono;persist();ticker=setInterval(()=>{try{if(document.hidden)pauseStudySession();else checkpoint();}catch{fail();}},5000);return true;};
 try{
  if(navigator.locks){await new Promise<void>((resolve,reject)=>{void navigator.locks.request(`koda-study:${scope()}`,{ifAvailable:true},async lock=>{if(!lock){error='Занятие уже запущено в другой вкладке.';resolve();return;}try{if(!activate(true)){resolve();return;}await new Promise<void>(release=>{releaseLock=release;resolve();});}catch(e){reject(e);}}).catch(reject);});}else activate();
 }catch{fail();}finally{busy=false;notify();}
}
export function pauseStudySession(){if(session?.status!=='running')return;try{if(!checkpoint(true))return;if(session)session.status='paused';persist();stopOwnership();notify();}catch{fail();}}
export function finishStudySession(){const claimed=lease();if(claimed&&claimed.owner!==owner&&claimed.until>Date.now()){error='Занятие продолжается в другой вкладке.';notify();return;}pauseStudySession();if(!session)return;try{session.status='finished';persist();error=null;notify();}catch{fail();}}
export function measuredStudyTotals(){return studyTotals(loadSnapshot().events);}
export function measuredStudyTotalSeconds(){return measuredStudySeconds(loadSnapshot().events);}
if(typeof window!=='undefined'){
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseStudySession();});
 window.addEventListener('pagehide',pauseStudySession);
 window.addEventListener('koda-study-sync-error',()=>{error='Не удалось синхронизировать время. Оно сохранено на этом устройстве; повторим при восстановлении связи.';notify();});
 window.addEventListener('koda-study-account-leaving',pauseStudySession);
 window.addEventListener('koda-study-account-changed',((e:CustomEvent<string|null>)=>setStudySessionUser(e.detail)) as EventListener);
 window.addEventListener('storage',e=>{if(e.key===leaseKey()&&session?.status==='running'&&lease()?.owner!==owner){session.status='paused';stopOwnership();error='Таймер продолжен в другой вкладке. Здесь он приостановлен.';notify();}if(e.key===key()&&session?.status!=='running'){setStudySessionUser(account,true);notify();}});
}

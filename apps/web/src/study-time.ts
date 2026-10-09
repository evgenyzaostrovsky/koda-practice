export type StudyInterval = { id: string; sessionId: string; start: string; end: string; timezone: string; schema: 1 };
type Evidence = { type: string; payload: Record<string, unknown> };
export function validStudyInterval(value: unknown): StudyInterval | null {
 if (!value || typeof value !== 'object') return null;
 const x=value as Record<string,unknown>;
 if(x.schema!==1||typeof x.id!=='string'||!x.id||typeof x.sessionId!=='string'||!x.sessionId||typeof x.start!=='string'||typeof x.end!=='string'||typeof x.timezone!=='string')return null;
 const start=Date.parse(x.start),end=Date.parse(x.end);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000||end>Date.now()+120000)return null;
 try{new Intl.DateTimeFormat('en',{timeZone:x.timezone}).format(start);}catch{return null;}
 return x as StudyInterval;
}
export function studyIntervalUnion(events: readonly Evidence[]): Array<[number,number]> {
 const seen=new Set<string>(),intervals:Array<[number,number]>=[];
 for(const event of events){if(event.type!=='study_interval_recorded')continue;const x=validStudyInterval(event.payload);if(!x||seen.has(x.id))continue;seen.add(x.id);intervals.push([Date.parse(x.start),Date.parse(x.end)]);}
 intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const merged:Array<[number,number]>=[];
 for(const [start,end] of intervals){const last=merged.at(-1);if(last&&start<=last[1])last[1]=Math.max(last[1],end);else merged.push([start,end]);}
 return merged;
}
export const measuredStudySeconds=(events:readonly Evidence[])=>studyIntervalUnion(events).reduce((n,[start,end])=>n+end-start,0)/1000;
function dateKey(time:number,timezone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(time);return ['year','month','day'].map(type=>parts.find(x=>x.type===type)!.value).join('-');}
export function studyTotals(events:readonly Evidence[],now=Date.now(),timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'){
 const daily:Record<string,number>={};
 for(const [start,end] of studyIntervalUnion(events)){
  let cursor=start;
  while(cursor<end){const day=dateKey(cursor,timezone);let next=end;
   if(dateKey(end-1,timezone)!==day){let lo=cursor,hi=Math.min(end,cursor+36*3600000);while(hi-lo>1){const mid=Math.floor((hi+lo)/2);if(dateKey(mid,timezone)===day)lo=mid;else hi=mid;}next=hi;}
   daily[day]=(daily[day]||0)+(next-cursor)/1000;cursor=next;
  }
 }
 const today=dateKey(now,timezone),calendar=new Date(today+'T12:00:00Z');const week=new Set(Array.from({length:7},(_,i)=>new Date(calendar.getTime()-i*86400000).toISOString().slice(0,10)));
 return {totalSeconds:Object.values(daily).reduce((a,b)=>a+b,0),todaySeconds:daily[today]||0,weekSeconds:Object.entries(daily).reduce((n,[day,seconds])=>n+(week.has(day)?seconds:0),0),daily};
}
export function formatStudyDuration(seconds:number){if(seconds<1)return '0 мин';if(seconds<60)return 'менее минуты';const minutes=Math.floor(seconds/60);return minutes>=60?`${Math.floor(minutes/60)} ч ${minutes%60} мин`:`${minutes} мин`;}

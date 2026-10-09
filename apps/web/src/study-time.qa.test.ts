import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measuredStudySeconds, studyTotals, validStudyInterval } from './study-time';
const evidence=(id:string,start:string,end:string,timezone='UTC')=>({type:'study_interval_recorded',payload:{id,sessionId:'manual-session',start,end,timezone,schema:1}});

beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));});
afterEach(()=>vi.useRealTimers());
describe('independent manual study evidence projection',()=>{
 it('counts overlapping tabs/devices as interval union and deduplicates replay regardless of order',()=>{
  const a=evidence('a','2026-10-09T10:00:00Z','2026-10-09T10:00:10Z');
  const b=evidence('b','2026-10-09T10:00:05Z','2026-10-09T10:00:15Z');
  const c=evidence('c','2026-10-09T10:00:30Z','2026-10-09T10:00:35Z');
  expect(measuredStudySeconds([a,b,c,a])).toBe(20);
  expect(measuredStudySeconds([c,b,a,b])).toBe(20);
 });
 it('does not reinterpret legacy sessions, task evidence or invalid intervals as measured time',()=>{
  const base=evidence('valid','2026-10-09T10:00:00Z','2026-10-09T10:00:10Z');
  const invalid=[{...base,type:'session_completed'},{...base,type:'task_solved'},...[
   {schema:2},{id:''},{sessionId:''},{start:'garbage'},{end:'2026-10-09T09:59:59Z'},{end:'2026-10-09T10:00:00Z'},{end:'2026-10-11T10:00:00Z'},{timezone:'Invalid/Zone'},
  ].map(change=>({...base,payload:{...base.payload,...change}}))];
  expect(measuredStudySeconds(invalid)).toBe(0);
  invalid.filter(x=>x.type==='study_interval_recorded').forEach(x=>expect(validStudyInterval(x.payload)).toBeNull());
 });
 it('cannot award a wholly future interval or a large future tail',()=>{
  const now=Date.now();for(const [start,end] of [[now+3600000,now+3601000],[now-1000,now+3600000]]){
   const x=evidence('future',new Date(start).toISOString(),new Date(end).toISOString());expect(validStudyInterval(x.payload)).toBeNull();expect(measuredStudySeconds([x])).toBe(0);
  }
 });
 it('retains fractional precision instead of rounding every checkpoint',()=>{
  const events=Array.from({length:10},(_,i)=>evidence(String(i),new Date(Date.UTC(2026,9,9,10,0,0,i*100)).toISOString(),new Date(Date.UTC(2026,9,9,10,0,0,(i+1)*100)).toISOString()));
  expect(measuredStudySeconds(events)).toBe(1);
 });
 it('splits a visible interval at account-local midnight',()=>{
  const x=evidence('crossing','2026-10-08T20:59:50Z','2026-10-08T21:00:20Z','Europe/Moscow');
  const result=studyTotals([x],Date.parse('2026-10-09T12:00:00Z'),'Europe/Moscow');
  expect(result.daily).toEqual({'2026-10-08':10,'2026-10-09':20});
  expect(result).toMatchObject({totalSeconds:30,todaySeconds:20,weekSeconds:30});
 });
 it('handles a 23-hour DST day without assuming 24-hour local days',()=>{
  const result=studyTotals([evidence('dst','2026-03-08T05:00:00Z','2026-03-09T04:00:00Z','America/New_York')],Date.parse('2026-03-09T12:00:00Z'),'America/New_York');
  expect(result.daily).toEqual({'2026-03-08':23*3600});
  expect(result.todaySeconds).toBe(0);
 });
 it('week means today and preceding six local calendar days while total keeps older evidence',()=>{
  const result=studyTotals([evidence('old','2026-10-02T10:00:00Z','2026-10-02T10:01:00Z'),evidence('edge','2026-10-03T10:00:00Z','2026-10-03T10:02:00Z'),evidence('today','2026-10-09T10:00:00Z','2026-10-09T10:03:00Z')],Date.parse('2026-10-09T12:00:00Z'),'UTC');
  expect(result).toMatchObject({totalSeconds:360,todaySeconds:180,weekSeconds:300});
 });
});

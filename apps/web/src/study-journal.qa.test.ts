import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeAchievementSession, evaluate, loadSnapshot, recordStudyInterval, setAchievementStorageUser } from './achievements/engine';
import fs from 'node:fs';
import { appendStudyJournal } from './study-journal';
import type { AchievementManifest } from './achievements/types';
import { measuredStudySeconds } from './study-time';
vi.mock('./achievements/cloud',()=>({scheduleAchievementCloudSave:vi.fn()}));
let sequence=0;
const interval=(id:string,seconds=10)=>({id,sessionId:'manual-session',start:'2026-10-09T10:00:00Z',end:new Date(Date.parse('2026-10-09T10:00:00Z')+seconds*1000).toISOString(),timezone:'UTC',schema:1 as const});
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));localStorage.clear();setAchievementStorageUser(`journal-qa-${++sequence}`);});
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
describe('independent durable study journal bridge',()=>{
 it('unlocks exactly at the measured threshold once without inferred-session backfill',()=>{
  const account=`journal-qa-${sequence}`;
  const manifest=JSON.parse(fs.readFileSync('public/achievements/manifest.json','utf8')) as AchievementManifest;
  recordStudyInterval(interval('before-threshold',899),account);expect(evaluate(manifest).snapshot.unlocked.study_first_immersion).toBeUndefined();
  const final={...interval('threshold'),start:'2026-10-09T10:14:59Z',end:'2026-10-09T10:15:00Z'};
  recordStudyInterval(final,account);const first=evaluate(manifest).snapshot.unlocked.study_first_immersion;expect(first).toBeDefined();
  recordStudyInterval(final,account);const second=evaluate(manifest).snapshot.unlocked.study_first_immersion;expect(second).toEqual(first);
  expect(Object.keys(evaluate(manifest).snapshot.unlocked).filter(id=>id==='study_first_immersion')).toHaveLength(1);
  sessionStorage.setItem('koda:achievement-session:v2',JSON.stringify({id:'manual-session',startedAt:'2026-10-09T09:00:00Z'}));completeAchievementSession();
  expect(loadSnapshot().events.some(event=>event.type==='session_completed')).toBe(false);
 });
 it('retains forty hours in the journal without duplicating all intervals into snapshot storage',()=>{
  const account=`journal-qa-${sequence}`;const start=Date.parse('2026-10-08T00:00:00Z');
  for(let index=0;index<2400;index++){
   const id=String(index).padStart(36,'0'),payload={...interval(id),sessionId:'s'.repeat(36),start:new Date(start+index*60000).toISOString(),end:new Date(start+(index+1)*60000).toISOString()};
   appendStudyJournal(account,{eventId:`study_interval_recorded:${id}`,type:'study_interval_recorded',payload,occurredAt:payload.end,localDate:'2026-10-09',version:1});
  }
  expect(measuredStudySeconds(loadSnapshot().events)).toBe(144000);
  const manifest=JSON.parse(fs.readFileSync('public/achievements/manifest.json','utf8')) as AchievementManifest;expect(evaluate(manifest).snapshot.unlocked.study_long_journey).toBeDefined();
  const stored=JSON.parse(localStorage.getItem(`koda:achievements:v1:${account}`)!);expect(stored.events.filter((event:{type:string})=>event.type==='study_interval_recorded')).toHaveLength(0);
  let bytes=0;for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index)!;bytes+=2*(key.length+localStorage.getItem(key)!.length);}expect(bytes).toBeLessThan(3*1024*1024);expect(loadSnapshot().events.filter(event=>event.type==='study_interval_recorded')).toHaveLength(2400);
 },15000);
 it('scopes evidence by account and rejects a stale account writer',()=>{
  const account=`journal-qa-${sequence}`;expect(recordStudyInterval(interval('a'),account)).toBe(true);expect(recordStudyInterval(interval('a'),account)).toBe(true);
  expect(measuredStudySeconds(loadSnapshot().events)).toBe(10);expect(JSON.parse(localStorage.getItem(`koda:achievements:v1:${account}`)!).events.filter((row:{type:string})=>row.type==='study_interval_recorded')).toHaveLength(0);
  setAchievementStorageUser('journal-other-'+sequence);expect(measuredStudySeconds(loadSnapshot().events)).toBe(0);expect(recordStudyInterval(interval('stale'),account)).toBe(false);
  setAchievementStorageUser(account);expect(loadSnapshot().events.filter(e=>e.type==='study_interval_recorded')).toHaveLength(1);
 });
 it('recovers durable intervals if whole snapshot metadata writing fails',()=>{
  const account=`journal-qa-${sequence}`;const original=Storage.prototype.setItem;
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(key===`koda:achievements:v1:${account}`)throw new Error('snapshot quota');return original.call(this,key,value);});
  expect(()=>recordStudyInterval(interval('durable'),account)).toThrow('snapshot quota');write.mockRestore();
  expect(measuredStudySeconds(loadSnapshot().events)).toBe(10);
  expect(recordStudyInterval(interval('durable'),account)).toBe(true);expect(measuredStudySeconds(loadSnapshot().events)).toBe(10);
 });
 it('cannot count an interval when the journal append itself fails',()=>{
  const account=`journal-qa-${sequence}`;const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('journal quota');});
  expect(()=>recordStudyInterval(interval('undurable'),account)).toThrow('journal quota');write.mockRestore();expect(measuredStudySeconds(loadSnapshot().events)).toBe(0);
 });
 it('migrates legacy task achievements without adopting anonymous manual time or its rewards',()=>{
  setAchievementStorageUser(null);recordStudyInterval(interval('anonymous'),null);
  const old=loadSnapshot();old.events.push({eventId:'task_solved:old',type:'task_solved',payload:{taskId:'start-001'},occurredAt:'2026-10-09T09:00:00Z',localDate:'2026-10-09',version:1});old.unlocked.first_task={unlockedAt:'2026-10-09',sourceEventId:'task_solved:old',xp:50,seen:true};old.unlocked.study_first_immersion={unlockedAt:'2026-10-09',sourceEventId:'study_interval_recorded:anonymous',xp:10,seen:true};localStorage.setItem('koda:achievements:v1',JSON.stringify(old));
  setAchievementStorageUser('fresh-account-'+sequence);const restored=loadSnapshot();expect(restored.events.some(e=>e.type==='task_solved')).toBe(true);expect(restored.unlocked.first_task).toBeDefined();expect(restored.unlocked.study_first_immersion).toBeUndefined();expect(measuredStudySeconds(restored.events)).toBe(0);
 });
});

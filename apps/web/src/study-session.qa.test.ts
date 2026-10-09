import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyInterval } from './study-time';
const state=vi.hoisted(()=>({events:[] as Array<{type:string;payload:StudyInterval}>,accounts:[] as Array<string|null>,current:null as string|null,fail:false}));
vi.mock('./achievements/engine',()=>({loadSnapshot:()=>({events:state.events.filter((_,index)=>state.accounts[index]===state.current)}),recordStudyInterval:(interval:StudyInterval,account:string|null)=>{if(state.fail)throw new Error('Storage unavailable');state.events.push({type:'study_interval_recorded',payload:interval});state.accounts.push(account);return true;}}));
import { finishStudySession, measuredStudyTotalSeconds, pauseStudySession, setStudySessionUser as rawSetStudySessionUser, startStudySession, studySessionView } from './study-session';
const setStudySessionUser=(user:string|null)=>{state.current=user;rawSetStudySessionUser(user);};
let scope=0;
beforeEach(()=>{pauseStudySession();localStorage.clear();state.events=[];state.accounts=[];state.fail=false;vi.useFakeTimers({toFake:['Date','setInterval','clearInterval','performance']});vi.setSystemTime(new Date('2026-10-09T10:00:00Z'));vi.stubGlobal('navigator',{locks:undefined});vi.spyOn(document,'hidden','get').mockReturnValue(false);setStudySessionUser(`qa-${++scope}`);});
afterEach(()=>{state.fail=false;pauseStudySession();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('independent manual timer lifecycle',()=>{
 it('counts only explicit running phases and Finish is idempotent',async()=>{
  await startStudySession();await vi.advanceTimersByTimeAsync(10000);pauseStudySession();
  expect(studySessionView()).toMatchObject({status:'paused',seconds:10,error:null});
  await vi.advanceTimersByTimeAsync(60000);expect(measuredStudyTotalSeconds()).toBe(10);
  await startStudySession();await vi.advanceTimersByTimeAsync(5000);finishStudySession();finishStudySession();
  expect(studySessionView()).toMatchObject({status:'finished',seconds:15,error:null});expect(measuredStudyTotalSeconds()).toBe(15);
 });
 it('hidden pauses once and returning visible does not silently resume',async()=>{
  await startStudySession();await vi.advanceTimersByTimeAsync(2500);
  vi.mocked(Object.getOwnPropertyDescriptor(document,'hidden')?.get!).mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));
  expect(studySessionView().status).toBe('paused');expect(measuredStudyTotalSeconds()).toBe(2.5);
  await vi.advanceTimersByTimeAsync(60000);vi.mocked(Object.getOwnPropertyDescriptor(document,'hidden')?.get!).mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
  expect(studySessionView().status).toBe('paused');expect(measuredStudyTotalSeconds()).toBe(2.5);
 });
 it('account switch checkpoints old account and restores each account paused',async()=>{
  setStudySessionUser('account-A');await startStudySession();await vi.advanceTimersByTimeAsync(3000);setStudySessionUser('account-B');
  expect(state.accounts).toEqual(['account-A']);expect(studySessionView()).toMatchObject({status:'idle',seconds:0});
  await vi.advanceTimersByTimeAsync(60000);setStudySessionUser('account-A');expect(studySessionView()).toMatchObject({status:'paused',seconds:3});
 });
 it('refuses to claim active ownership held by another tab',async()=>{
  localStorage.setItem(`koda:study-session:v1:qa-${scope}:owner`,JSON.stringify({owner:'other-tab',until:Date.now()+10000}));
  await startStudySession();expect(studySessionView().status).not.toBe('running');expect(studySessionView().error).toMatch(/другой вкладке/);expect(state.events).toHaveLength(0);
 });
 it('losing ownership cannot append a final overlapping interval',async()=>{
  await startStudySession();await vi.advanceTimersByTimeAsync(1000);
  const key=`koda:study-session:v1:qa-${scope}:owner`;localStorage.setItem(key,JSON.stringify({owner:'new-owner',until:Date.now()+10000}));window.dispatchEvent(new StorageEvent('storage',{key}));
  const saved=localStorage.getItem(`koda:study-session:v1:qa-${scope}`);finishStudySession();expect(state.events).toHaveLength(0);expect(studySessionView().status).toBe('paused');expect(localStorage.getItem(`koda:study-session:v1:qa-${scope}`)).toBe(saved);
 });
 it('restores session time from durable evidence after metadata persistence fails',async()=>{
  setStudySessionUser('crash-A');await startStudySession();await vi.advanceTimersByTimeAsync(1000);
  const original=Storage.prototype.setItem;
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(key==='koda:study-session:v1:crash-A')throw new Error('metadata quota');return original.call(this,key,value);});
  pauseStudySession();expect(measuredStudyTotalSeconds()).toBe(1);write.mockRestore();
  setStudySessionUser('crash-B');setStudySessionUser('crash-A');
  expect(studySessionView()).toMatchObject({status:'paused',seconds:1});
 });
 it('recovers durable latest session paused when session metadata is absent',async()=>{
  const account=`qa-${scope}`;await startStudySession();await vi.advanceTimersByTimeAsync(3000);pauseStudySession();localStorage.removeItem(`koda:study-session:v1:${account}`);
  setStudySessionUser('missing-other');setStudySessionUser(account);expect(studySessionView()).toMatchObject({status:'paused',seconds:3});
  await vi.advanceTimersByTimeAsync(3600000);expect(studySessionView().seconds).toBe(3);
 });
 it('uses bounded minute durability with immediate pause flush instead of five-second row growth',async()=>{
  await startStudySession();await vi.advanceTimersByTimeAsync(59000);expect(state.events).toHaveLength(0);expect(studySessionView().seconds).toBe(59);
  await vi.advanceTimersByTimeAsync(1000);expect(state.events).toHaveLength(1);expect(measuredStudyTotalSeconds()).toBe(60);
  await vi.advanceTimersByTimeAsync(1000);pauseStudySession();expect(measuredStudyTotalSeconds()).toBe(61);expect(state.events).toHaveLength(2);
 });
 it('records only last confirmed heartbeat when a suspended process returns after a long gap',async()=>{
  await startStudySession();await vi.advanceTimersByTimeAsync(5000);
  vi.spyOn(performance,'now').mockReturnValue(65000);pauseStudySession();
  expect(studySessionView().status).toBe('paused');expect(measuredStudyTotalSeconds()).toBe(5);
 });
 it('a paused observer never writes normalized state over another tab running or finished session',async()=>{
  const key=`koda:study-session:v1:qa-${scope}`;await startStudySession();await vi.advanceTimersByTimeAsync(1000);pauseStudySession();
  const prior=JSON.parse(localStorage.getItem(key)!);localStorage.setItem(key+':owner',JSON.stringify({owner:'other-active-tab',until:Date.now()+15000}));
  for(const status of ['running','finished']){
   const remote=JSON.stringify({...prior,status});localStorage.setItem(key,remote);window.dispatchEvent(new StorageEvent('storage',{key,newValue:remote}));
   expect(localStorage.getItem(key)).toBe(remote);expect(studySessionView().status).toBe(status==='running'?'paused':'finished');
  }
 });
 it('initial hydration cannot rewrite a foreign active owner session',()=>{
  const account='foreign-startup-'+scope,key=`koda:study-session:v1:${account}`;const remote=JSON.stringify({id:'foreign-session',status:'running',elapsedMs:0,lastEnd:0});localStorage.setItem(key,remote);localStorage.setItem(key+':owner',JSON.stringify({owner:'foreign-tab',until:Date.now()+15000}));
  setStudySessionUser(account);expect(studySessionView()).toMatchObject({status:'paused',seconds:0});expect(localStorage.getItem(key)).toBe(remote);
 });
 it('durable write failure pauses visibly and cannot credit failed interval',async()=>{
  await startStudySession();await vi.advanceTimersByTimeAsync(1000);state.fail=true;pauseStudySession();
  expect(studySessionView()).toMatchObject({status:'paused'});expect(studySessionView().error).toMatch(/сохранить время/);expect(measuredStudyTotalSeconds()).toBe(0);
  state.fail=false;await startStudySession();await vi.advanceTimersByTimeAsync(2000);finishStudySession();expect(measuredStudyTotalSeconds()).toBe(2);
 });
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./achievements/cloud',()=>({scheduleAchievementCloudSave:vi.fn()}));
import { loadSnapshot, setAchievementStorageUser } from './achievements/engine';
import { measuredStudySeconds } from './study-time';
import { pauseStudySession, startStudySession, studySessionView } from './study-session';
let run=0;
beforeEach(()=>{pauseStudySession();localStorage.clear();vi.useFakeTimers({toFake:['Date','setInterval','clearInterval','performance']});vi.setSystemTime(new Date('2026-10-09T10:00:00Z'));vi.stubGlobal('navigator',{locks:undefined});vi.spyOn(document,'hidden','get').mockReturnValue(false);run++;});
afterEach(()=>{pauseStudySession();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('actual engine account transition checkpoints old scope then restores new scope evidence',async()=>{
 const a=`integration-A-${run}`,b=`integration-B-${run}`;
 setAchievementStorageUser(b);await startStudySession();await vi.advanceTimersByTimeAsync(2000);pauseStudySession();expect(measuredStudySeconds(loadSnapshot().events)).toBe(2);
 setAchievementStorageUser(a);await startStudySession();await vi.advanceTimersByTimeAsync(3000);
 setAchievementStorageUser(b);expect(studySessionView()).toMatchObject({status:'paused',seconds:2});expect(measuredStudySeconds(loadSnapshot().events)).toBe(2);
 setAchievementStorageUser(a);expect(studySessionView()).toMatchObject({status:'paused',seconds:3});expect(measuredStudySeconds(loadSnapshot().events)).toBe(3);
});

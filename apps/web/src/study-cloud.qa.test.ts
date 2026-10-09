import type { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { hydrateAchievementsFromCloud, scheduleAchievementCloudSave, setAchievementCloudUser } from './achievements/cloud';
import { readStudyJournal } from './study-journal';
import type { AchievementEvent, AchievementSnapshot } from './achievements/types';
const mocks=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{from:mocks.from}}));
let sequence=0;
const event=(id:string):AchievementEvent=>({eventId:`study_interval_recorded:${id}`,type:'study_interval_recorded',payload:{id,sessionId:'manual',start:'2026-10-09T10:00:00Z',end:'2026-10-09T10:00:05Z',timezone:'UTC',schema:1},occurredAt:'2026-10-09T10:00:05Z',localDate:'2026-10-09',version:1});
const snapshot=(events:AchievementEvent[]):AchievementSnapshot=>({events,unlocked:{},activeCosmetics:{},backfillVersion:2,timezone:'UTC'});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));mocks.from.mockReset();setAchievementCloudUser(null);setAchievementCloudUser({id:`cloud-study-${++sequence}`} as User);});
afterEach(()=>{setAchievementCloudUser(null);vi.useRealTimers();});
function server(manual:ReturnType<typeof vi.fn>){mocks.from.mockImplementation((table:string)=>({upsert:table==='learning_events'?manual:vi.fn().mockResolvedValue({error:null})}));}
it('does not re-upload acknowledged immutable intervals at every checkpoint',async()=>{
 const upload=vi.fn().mockResolvedValue({error:null});server(upload);const user=`cloud-study-${sequence}`;
 scheduleAchievementCloudSave(snapshot([event('first')]),user);await vi.advanceTimersByTimeAsync(450);
 scheduleAchievementCloudSave(snapshot([event('first'),event('second')]),user);await vi.advanceTimersByTimeAsync(450);
 expect(upload).toHaveBeenCalledTimes(2);expect(upload.mock.calls[0][0].map((row:{id:string})=>row.id)).toEqual([`${user}:study_interval_recorded:first`]);expect(upload.mock.calls[1][0].map((row:{id:string})=>row.id)).toEqual([`${user}:study_interval_recorded:second`]);
 expect(upload.mock.calls[0][1]).toMatchObject({ignoreDuplicates:true});
});
it('failed interval upload remains retryable and is never acknowledged early',async()=>{
 const upload=vi.fn().mockResolvedValueOnce({error:new Error('offline')}).mockResolvedValue({error:null});server(upload);const user=`cloud-study-${sequence}`;
 scheduleAchievementCloudSave(snapshot([event('retry')]),user);await vi.advanceTimersByTimeAsync(450);
 scheduleAchievementCloudSave(snapshot([event('retry')]),user);await vi.advanceTimersByTimeAsync(450);
 expect(upload).toHaveBeenCalledTimes(2);expect(upload.mock.calls[1][0][0].id).toBe(`${user}:study_interval_recorded:retry`);
 scheduleAchievementCloudSave(snapshot([event('retry')]),user);await vi.advanceTimersByTimeAsync(450);expect(upload).toHaveBeenCalledTimes(2);
});
it('late account-A acknowledgement cannot suppress the same domain interval in B',async()=>{
 let resolve!:(value:{error:null})=>void;const upload=vi.fn().mockImplementationOnce(()=>new Promise<{error:null}>(done=>{resolve=done;})).mockResolvedValue({error:null});server(upload);
 const a=`cloud-study-${sequence}`;scheduleAchievementCloudSave(snapshot([event('shared')]),a);await vi.advanceTimersByTimeAsync(450);
 const b=`cloud-study-B-${sequence}`;setAchievementCloudUser({id:b} as User);resolve({error:null});await Promise.resolve();
 scheduleAchievementCloudSave(snapshot([event('shared')]),b);await vi.advanceTimersByTimeAsync(450);
 expect(upload).toHaveBeenCalledTimes(2);expect(upload.mock.calls[1][0][0].user_id).toBe(b);expect(upload.mock.calls[1][0][0].id).toBe(`${b}:study_interval_recorded:shared`);
});

it('hydrates every interval beyond a thousand rows and does not re-upload acknowledged remote evidence',async()=>{
 const user=`cloud-study-${sequence}`;const rows=Array.from({length:1001},(_,index)=>{const x=event(`remote-${index}`);return{id:`${user}:${x.eventId}`,type:x.type,payload:x.payload,occurred_at:x.occurredAt,local_date:x.localDate,version:1};});
 const ranges:number[][]=[];const upload=vi.fn().mockResolvedValue({error:null});
 const chain={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn(),upsert:upload};chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);chain.order.mockReturnValue(chain);chain.range.mockImplementation((start:number,end:number)=>{ranges.push([start,end]);return Promise.resolve({data:rows.slice(start,end+1),error:null});});
 mocks.from.mockImplementation((table:string)=>table==='learning_events'?chain:{select:()=>Object.assign(Promise.resolve({data:table==='user_achievement_stats'?null:[],error:null}),{maybeSingle:()=>Promise.resolve({data:null,error:null})}),upsert:vi.fn().mockResolvedValue({error:null})});
 await hydrateAchievementsFromCloud();expect(ranges).toEqual([[0,499],[500,999],[1000,1499]]);
 const restored=JSON.parse(localStorage.getItem(`koda:achievements:v1:${user}`)!);expect(restored.events.filter((row:{type:string})=>row.type==='study_interval_recorded')).toHaveLength(0);expect(readStudyJournal(user)).toHaveLength(1001);expect(upload).not.toHaveBeenCalled();
 scheduleAchievementCloudSave({...restored,events:[...restored.events,...readStudyJournal(user),event('new-local')]},user);await vi.advanceTimersByTimeAsync(450);expect(upload).toHaveBeenCalledTimes(1);expect(upload.mock.calls[0][0].map((row:{id:string})=>row.id)).toEqual([`${user}:study_interval_recorded:new-local`]);
});

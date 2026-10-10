import { expect,it } from 'vitest';
import { latestEarnedAchievement,selectHomeContinuation } from './home-support';
import type { Module } from '../types';
import type { AchievementManifest,AchievementSnapshot } from '../achievements/types';
const modules=[{slug:'empty',topics:[]},{slug:'actual',topics:[{slug:'topic',title:'Тема',exercises:[{id:'first',title:'Первая'},{id:'second',title:'Вторая'}]}]}] as Module[];
const manifest={families:[{slug:'01_solved_tasks',name:'Задачи',achievements:[{id:'old',name:'Первая'},{id:'new',name:'Вторая'},{id:'bad-date',name:'Неверная дата'}]}]} as AchievementManifest;
const snapshot=(unlocked:Record<string,{unlockedAt:string}>)=>({unlocked}) as AchievementSnapshot;
it('chooses a valid unsolved saved task, otherwise a real unsolved task, and nothing after completion',()=>{
 expect(selectHomeContinuation(modules,'second')?.task.id).toBe('second');
 expect(selectHomeContinuation(modules,'retired')?.task.id).toBe('first');
 expect(selectHomeContinuation(modules,'first',['first'])?.task.id).toBe('second');
 expect(selectHomeContinuation(modules,null,['first','second'])).toBeNull();expect(selectHomeContinuation([],null)).toBeNull();
});
it('selects the latest real award with a valid date without mutating evidence',()=>{
 const data=snapshot({old:{unlockedAt:'2026-01-01'},new:{unlockedAt:'2026-10-08'},'unknown-id':{unlockedAt:'2027-01-01'},'bad-date':{unlockedAt:'not-a-date'}}),before=JSON.stringify(data);
 expect(latestEarnedAchievement(manifest,data)?.def.id).toBe('new');expect(JSON.stringify(data)).toBe(before);
 expect(latestEarnedAchievement(manifest,snapshot({}))).toBeNull();expect(latestEarnedAchievement(manifest,snapshot({'unknown-id':{unlockedAt:'2026-10-08'}}))).toBeNull();
});
it('uses actual chronological order across timezone representations',()=>{
 expect(latestEarnedAchievement(manifest,snapshot({old:{unlockedAt:'2026-10-08T12:00:00+03:00'},new:{unlockedAt:'2026-10-08T10:00:00Z'}}))?.def.id).toBe('new');
});

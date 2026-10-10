import {expect,it} from 'vitest';
import {knowledgePractice,nearestAchievement} from './context-support';
import type {KnowledgeUnit,Module} from '../types';
import type {AchievementManifest,AchievementSnapshot} from '../achievements/types';
const modules=[{slug:'m',topics:[{slug:'t',exercises:[{id:'one'},{id:'two'},{id:'unrelated'}]}]}] as Module[];
const unit={relatedTaskIds:['retired','one','two']} as KnowledgeUnit;
it('knowledge actions choose actual related unsolved tasks and only then explicit repeat',()=>{
 expect(knowledgePractice(unit,modules,[])?.task.id).toBe('one');
 expect(knowledgePractice(unit,modules,['one'])?.task.id).toBe('two');
 expect(knowledgePractice(unit,modules,['one','two'])).toMatchObject({task:{id:'one'},repeat:true});
 expect(knowledgePractice({relatedTaskIds:['retired']} as KnowledgeUnit,modules,[])).toBeNull();
});
it('empty achievement evidence produces no fictitious next award and remains unchanged',()=>{
 const snapshot={events:[],unlocked:{},activeCosmetics:{},backfillVersion:2,timezone:'UTC'} as AchievementSnapshot;
 const manifest={families:[{slug:'01_solved_tasks',name:'Задачи',achievements:[{id:'first_task',name:'Старт'}]}]} as AchievementManifest;
 const before=JSON.stringify(snapshot);expect(nearestAchievement(manifest,snapshot)).toBeNull();expect(JSON.stringify(snapshot)).toBe(before);
});

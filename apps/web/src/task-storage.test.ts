import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadLastTask,loadTaskState,resetTaskState,saveLastTask,saveTaskState,setStorageUser} from './task-storage';

beforeEach(()=>{localStorage.clear();setStorageUser(null)});

describe('task storage',()=>{
 it('stores code and restores it independently for each task',()=>{saveTaskState('a',{code:'result = 1'});saveTaskState('b',{code:'result = 2'});expect(loadTaskState('a')?.code).toBe('result = 1');expect(loadTaskState('b')?.code).toBe('result = 2')});
 it('resets only the selected task',()=>{saveTaskState('a',{code:'a'});saveTaskState('b',{code:'b'});resetTaskState('a');expect(loadTaskState('a')).toBeUndefined();expect(loadTaskState('b')?.code).toBe('b')});
 it('keeps completion metadata and the last run result',()=>{vi.setSystemTime(new Date('2026-08-10T10:00:00Z'));saveTaskState('a',{code:'result = 1',status:'completed',attempts:3,completedAt:'2026-08-10T09:59:00Z',lastRunResult:{ok:true,passed:true,execution_ms:4}});expect(loadTaskState('a')).toMatchObject({status:'completed',attempts:3,completedAt:'2026-08-10T09:59:00Z',lastRunResult:{passed:true}});vi.useRealTimers()});
 it('remembers the last opened task',()=>{saveLastTask('start-003');expect(loadLastTask()).toBe('start-003')});
 it('isolates local caches of different accounts',()=>{setStorageUser('user-a');saveTaskState('start-001',{code:'a'});setStorageUser('user-b');saveTaskState('start-001',{code:'b'});expect(loadTaskState('start-001')?.code).toBe('b');setStorageUser('user-a');expect(loadTaskState('start-001')?.code).toBe('a')});
});

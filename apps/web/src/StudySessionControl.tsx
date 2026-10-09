import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { finishStudySession, measuredStudyTotals, pauseStudySession, setStudySessionUser, startStudySession, studySessionView, subscribeStudySession } from './study-session';
import './study-session.css';
export function useMeasuredStudyTotals(){const[,refresh]=useState(0);useEffect(()=>{const update=()=>refresh(value=>value+1);window.addEventListener('koda-study-updated',update);window.addEventListener('koda-achievements-updated',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('koda-study-updated',update);window.removeEventListener('koda-achievements-updated',update);window.removeEventListener('storage',update);};},[]);return measuredStudyTotals();}
export function StudySessionControl(){
 const{user}=useAuth();const[view,setView]=useState(studySessionView);
 useEffect(()=>{setStudySessionUser(user?.id??null);const update=()=>setView(studySessionView());update();const unsub=subscribeStudySession(update),tick=setInterval(update,1000);return()=>{unsub();clearInterval(tick);};},[user?.id]);
 const running=view.status==='running',active=view.status==='paused'||running;
 const seconds=Math.floor(view.seconds),time=`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 return <div className="study-session-control" aria-label="Таймер занятия"><span className="study-session-clock" aria-label={`Время занятия ${time}`}><small>{running?'Занятие идёт':view.status==='paused'?'На паузе':view.status==='finished'?'Занятие завершено':'Время занятия'}</small><b>{time}</b></span><button className="study-session-action" disabled={view.busy} onClick={()=>running?pauseStudySession():void startStudySession()}>{running?'Пауза':view.status==='paused'?'Продолжить':'Начать занятие'}</button>{active&&<button className="study-session-finish" onClick={finishStudySession} disabled={view.busy}>Завершить</button>}{view.error&&<p className="study-session-message" role="status">{view.error}</p>}</div>;
}

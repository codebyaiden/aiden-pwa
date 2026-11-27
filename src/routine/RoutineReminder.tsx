import {useEffect,useState} from 'react';
import {acknowledge,reminder,snooze,tick,type State} from './engine';
import {updateRoutine} from './storage';
// Foreground only. No permission prompts, network, or claims of background delivery.
export function RoutineReminder({onOpen}:{onOpen:()=>void}){
 const [notice,setNotice]=useState<{key:string;text:string}|null>(null);
 useEffect(()=>{let alive=true,running=false;async function poll(){if(running||!alive||document.visibilityState!=='visible')return;running=true;try{let sent:{key:string;text:string}|null=null;await updateRoutine((s:State)=>{const now=Date.now(),next=tick(s,now),due=reminder(next,now);if(!due)return next;sent=due;return acknowledge(next,due.key,now,due.text)});if(alive&&sent)setNotice(sent)}catch{/* Existing app remains usable if routine storage fails. */}finally{running=false}}
 const id=window.setInterval(()=>void poll(),15000);const onVisible=()=>void poll();document.addEventListener('visibilitychange',onVisible);void poll();return()=>{alive=false;clearInterval(id);document.removeEventListener('visibilitychange',onVisible)}},[]);
 if(!notice)return null;
 return <aside className="routine-global-notice" role="status"><div><strong>{notice.text}</strong><small>Rutina pendiente</small></div><div className="routine-global-actions"><button onClick={()=>{try{sessionStorage.setItem('aiden-routine-open',notice.key)}catch{/* route still opens */}setNotice(null);onOpen()}}>Abrir</button><button onClick={async()=>{try{await updateRoutine(s=>snooze(s,notice.key,10,Date.now()));setNotice(null)}catch{/* retain notice to allow retry */}}}>10 min</button><button aria-label="Cerrar aviso" onClick={()=>setNotice(null)}>×</button></div></aside>;
}

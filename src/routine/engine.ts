export type Activity = 'unknown'|'awake'|'gaming'|'movie'|'youtube'|'coding'|'away'|'sleeping';
export type Mode = 'normal'|'minimum'|'vacation';
export interface Step { id:string; title:string; instruction:string; seconds?:number; essential:boolean }
export interface Routine { id:string; title:string; start:number; end:number; cutoff:number; afterWake:boolean; steps:Step[]; messages:string[] }
export interface Run { key:string; routineId:string; date:string; due:number; done:string[]; skipped:string[]; retries:number; next:number|null; timer?:{stepId:string; end:number; paused?:number} }
export interface Product { id:string; name:string; opened:string; expires:string; remaining:number; note:string }
export interface Maintenance { id:string; title:string; every:number; due:string }
export interface Context { activity:Activity; source:string; at:number; expires:number }
export interface Review { date:string; note:string }
export interface State { version:1; started:string|null; mode:Mode; vacationUntil:string|null; wake:{date:string;at:number}|null; context:Context|null; rules:Record<string,Activity>; routines:Routine[]; runs:Record<string,Run>; products:Product[]; maintenance:Maintenance[]; reviews:Review[]; lastVisit:string|null; history:{at:number;text:string}[]; reminders:boolean }
const msgs = (subject:string) => [ `Hora de ${subject}.`, `Bro, cinco minutos y ya.`, `No lo dejes para después.`, `Hazlo y seguimos.`, `Tu yo de mañana te lo agradece.`, `Pausa lo que estás haciendo un momento.`, `No necesitas motivación para empezar.`, `Una cosa a la vez.`, `Esto no es una actualización de Windows, puedes hacerlo ya.`, `Vamos, termina lo pendiente.` ];
export const initial = ():State => ({version:1,started:null,mode:'normal',vacationUntil:null,wake:null,context:null,rules:{},routines:[
 {id:'morning',title:'Mañana',start:480,end:780,cutoff:900,afterWake:true,messages:msgs('tu rutina de la mañana'),steps:[{id:'up',title:'Levántate',instruction:'Sal de la cama y empieza a tu ritmo.',essential:true},{id:'wash',title:'Lava tu cara',instruction:'Usa tu limpiador suave y agua tibia. Seca sin frotar.',essential:true},{id:'teeth',title:'Cepíllate los dientes',instruction:'Cepilla suavemente todas las superficies.',seconds:120,essential:true},{id:'moisturize',title:'Hidrata tu piel',instruction:'Aplica tu hidratante habitual.',essential:true},{id:'spf',title:'Protector solar',instruction:'Aplica protector solar de amplio espectro SPF 30 o superior según su etiqueta.',essential:true}]},
 {id:'movement',title:'Movimiento',start:900,end:1020,cutoff:1140,afterWake:false,messages:msgs('moverte'),steps:[{id:'walk',title:'Muévete un rato',instruction:'Elige una actividad que disfrutes. Para si algo duele.',essential:false}]},
 {id:'evening',title:'Noche',start:1260,end:1290,cutoff:1410,afterWake:false,messages:msgs('tu rutina de noche'),steps:[{id:'wash-pm',title:'Lava tu cara',instruction:'Limpia suavemente y seca sin frotar.',essential:true},{id:'teeth-pm',title:'Cepíllate los dientes',instruction:'Cepilla suavemente durante dos minutos.',seconds:120,essential:true},{id:'moisturize-pm',title:'Hidrata tu piel',instruction:'Aplica tu hidratante habitual. Sigue las indicaciones de tu profesional para cualquier tratamiento.',essential:true}]},
 {id:'winddown',title:'Desconexión',start:1335,end:1365,cutoff:1430,afterWake:false,messages:['Cierra el portátil si ya terminaste.','GitHub seguirá ahí mañana.','No eres un servidor de producción.','Termina la partida y descansa.','Pausa el video y guarda tu progreso.','Mañana puedes continuar.','El portátil también merece descansar.','Hora de bajar el ritmo.','Una última cosa y desconecta.','Deja el teléfono cuando estés listo.'],steps:[{id:'stop',title:'Termina lo que estás haciendo',instruction:'Guarda tu trabajo o termina la partida; prepara un momento tranquilo para dormir.',essential:true}]}
 ],runs:{},products:[],maintenance:[],reviews:[],lastVisit:null,history:[],reminders:true});
export function dateAt(now:number):string { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function at(date:string,min:number):number { return Date.parse(date+'T00:00:00-05:00')+min*60000 }
export function addDays(date:string,days:number):string {return dateAt(at(date,720)+days*86400000)}
export function elapsedDays(start:string,date:string):number {return Math.max(1,Math.floor((at(date,0)-at(start,0))/86400000)+1)}
export function activeContext(s:State,now:number):Activity {return s.context && s.context.expires>now ? s.context.activity:'unknown'}
export function stepsFor(r:Routine,s:State):Step[]{return s.mode==='normal'?r.steps:r.steps.filter(x=>x.essential)}
export function remaining(r:Routine,run:Run,s:State):Step[]{return stepsFor(r,s).filter(x=>!run.done.includes(x.id)&&!run.skipped.includes(x.id))}
export function tick(s:State,now:number,random:()=>number=Math.random):State {
 if(!s.started)return s;const date=dateAt(now);let n=s;
 if(s.mode==='vacation'&&s.vacationUntil&&date>s.vacationUntil)n={...n,mode:'normal',vacationUntil:null};
 const runs={...n.runs};let changed=false;
 for(const r of n.routines){const key=date+':'+r.id;if(runs[key])continue;
 const wake=r.afterWake&&n.wake?.date===date?n.wake.at:null;
 // Never infer wake from a missing signal. The user may start a routine manually.
 if(r.afterWake&&wake===null)continue;
 const start=wake!==null?wake:at(date,r.start),end=wake!==null?Math.min(wake+10*60000,at(date,1439)):at(date,r.end);
 const due=start+Math.floor(Math.max(0,end-start)*random());runs[key]={key,routineId:r.id,date,due,done:[],skipped:[],retries:0,next:due};changed=true;
 }
 return changed?{...n,runs}:n;
}
export function ensureRun(s:State,r:Routine,now:number):State {const date=dateAt(now),key=date+':'+r.id;return s.runs[key]?s:{...s,runs:{...s.runs,[key]:{key,routineId:r.id,date,due:now,done:[],skipped:[],retries:0,next:now}}}}
export function mark(s:State,key:string,id:string,kind:'done'|'skip'|'undo',now:number):State {const run=s.runs[key],r=s.routines.find(x=>x.id===run?.routineId);if(!run||!r||!r.steps.some(x=>x.id===id))return s;const done=run.done.filter(x=>x!==id),skipped=run.skipped.filter(x=>x!==id);if(kind==='done')done.push(id);if(kind==='skip')skipped.push(id);const updated={...run,done,skipped,retries:0,timer:undefined};updated.next=remaining(r,updated,s).length?now+5*60000:null;return {...s,runs:{...s.runs,[key]:updated}}}
export function snooze(s:State,key:string,minutes:number,now:number):State {const r=s.runs[key];return r?{...s,runs:{...s.runs,[key]:{...r,next:now+minutes*60000}}}:s}
export function reminder(s:State,now:number):{key:string;text:string}|null {if(!s.reminders||s.mode==='vacation'||activeContext(s,now)==='sleeping')return null;const date=dateAt(now),activity=activeContext(s,now);for(const r of s.routines){const run=s.runs[date+':'+r.id];if(!run||run.next===null||run.next>now||run.retries>=4||!remaining(r,run,s).length)continue;const cutoff=r.afterWake?Math.min(run.due+3*3600000,at(date,1439)):at(date,r.cutoff);if(now>cutoff)continue;if(['gaming','movie','youtube','away'].includes(activity)&&now<run.due+(activity==='movie'?60:20)*60000)continue;return {key:run.key,text:r.messages[(elapsedDays(s.started??date,date)+run.retries)%r.messages.length]};}return null}
export function acknowledge(s:State,key:string,now:number,text:string):State {const run=s.runs[key];if(!run)return s;const retries=run.retries+1;return {...s,runs:{...s.runs,[key]:{...run,retries,next:retries>=4?null:now+[5,10,15][retries-1]*60000}},history:[...s.history,{at:now,text}].slice(-200)}}
export function setTimer(s:State,key:string,timer:Run['timer']):State {const run=s.runs[key];return run?{...s,runs:{...s.runs,[key]:{...run,timer}}}:s}

import { isCalendarDate } from '../savings/calculations';
import { isISODate } from '../savings/validation';
import { MAX_AMOUNT_COP } from '../savings/types';
import { occurrencesForRange } from './dates';
import type { CalendarEvent, Countdown, EventOccurrenceState, PersonalSnapshot, Task } from './types';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const date=(x:unknown):x is string=>typeof x==='string'&&isCalendarDate(x);
const time=(x:unknown)=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const validID=(x:unknown)=>typeof x==='string'&&UUID.test(x);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const timestamps=(x:Record<string,unknown>)=>isISODate(x.createdAt)&&isISODate(x.updatedAt)&&x.updatedAt>=x.createdAt;
const titled=(x:unknown,max=100)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export function validEvent(raw:unknown):raw is CalendarEvent{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const e=raw as Record<string,unknown>;
  return validID(e.id)&&titled(e.title)&&['personal','expense','income'].includes(String(e.category))
    &&date(e.startDate)&&date(e.endDate)&&e.endDate>=e.startDate
    &&(e.startTime===undefined||time(e.startTime))&&(e.endTime===undefined||time(e.endTime))
    &&(!(e.startTime&&e.endTime&&e.startDate===e.endDate)||String(e.endTime)>=String(e.startTime))
    &&(e.amountCOP===undefined||((e.category==='expense'||e.category==='income')&&Number.isSafeInteger(e.amountCOP)&&Number(e.amountCOP)>0&&Number(e.amountCOP)<=MAX_AMOUNT_COP))
    &&(e.notes===undefined||(typeof e.notes==='string'&&e.notes.length<=500))&&typeof e.important==='boolean'
    &&['none','weekly','monthly','yearly'].includes(String(e.recurrence))
    &&(e.recurrenceUntil===undefined||(e.recurrence!=='none'&&date(e.recurrenceUntil)&&e.recurrenceUntil>=e.startDate))
    &&timestamps(e)&&keys(e,['id','title','category','startDate','endDate','startTime','endTime','amountCOP','notes','important','recurrence','recurrenceUntil','createdAt','updatedAt']);
}
export function validTask(raw:unknown):raw is Task{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const t=raw as Record<string,unknown>;
  return validID(t.id)&&titled(t.title)&& (t.dueDate===undefined||date(t.dueDate))
    &&(t.note===undefined||(typeof t.note==='string'&&t.note.length<=500))
    &&(t.completedAt===undefined||isISODate(t.completedAt))&&timestamps(t)
    &&keys(t,['id','title','dueDate','note','completedAt','createdAt','updatedAt']);
}
export function validCountdown(raw:unknown):raw is Countdown{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const c=raw as Record<string,unknown>;
  return validID(c.id)&&titled(c.title)&&typeof c.pinned==='boolean'&&timestamps(c)
    &&(c.targetDate===undefined||date(c.targetDate))&&(c.targetTime===undefined||time(c.targetTime))
    &&(c.sourceEventId===undefined||validID(c.sourceEventId))
    &&(c.sourceEventId!==undefined?c.targetDate===undefined&&c.targetTime===undefined:date(c.targetDate))
    &&(c.targetTime===undefined||date(c.targetDate))
    &&keys(c,['id','title','targetDate','targetTime','sourceEventId','pinned','createdAt','updatedAt']);
}
export function validState(raw:unknown):raw is EventOccurrenceState{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const s=raw as Record<string,unknown>;
  return validID(s.eventId)&&date(s.occurrenceStartDate)&&s.occurrenceKey===`${s.eventId}@${s.occurrenceStartDate}`
    &&['paid','received','skipped'].includes(String(s.status))&&isISODate(s.changedAt)
    &&keys(s,['occurrenceKey','eventId','occurrenceStartDate','status','changedAt']);
}
export function validatePersonalCollections(input:Pick<PersonalSnapshot,'events'|'tasks'|'countdowns'|'eventOccurrenceStates'>):void{
  const limits:[[unknown[],number,(x:unknown)=>boolean,string],...Array<[unknown[],number,(x:unknown)=>boolean,string]>]=[
    [input.events,5000,validEvent,'eventos'],[input.tasks,10000,validTask,'tareas'],
    [input.countdowns,1000,validCountdown,'countdowns'],[input.eventOccurrenceStates,20000,validState,'estados']];
  for(const [values,max,check,label] of limits){
    if(!Array.isArray(values)||values.length>max||values.some(x=>!check(x)))throw new Error(`La copia contiene ${label} no válidos.`);
    const ids=values.map((x:any)=>x.id??x.occurrenceKey);
    if(new Set(ids).size!==ids.length)throw new Error(`La copia contiene ${label} duplicados.`);
  }
  const events=new Map(input.events.map(e=>[e.id,e]));
  for(const s of input.eventOccurrenceStates){
    const event=events.get(s.eventId);
    if(!event||event.category==='personal'||(s.status==='paid'&&event.category!=='expense')||(s.status==='received'&&event.category!=='income'))throw new Error('Hay estados financieros sin evento válido.');
    if(!occurrencesForRange([event],s.occurrenceStartDate,s.occurrenceStartDate).some(o=>o.startDate===s.occurrenceStartDate))throw new Error('Hay estados de ocurrencias que ya no existen.');
  }
  if(input.countdowns.filter(c=>c.pinned).length>1)throw new Error('Solo se permite un countdown fijado.');
  for(const c of input.countdowns) if(c.sourceEventId && events.get(c.sourceEventId)?.category!=='personal')throw new Error('Un countdown está vinculado a un evento inexistente o no personal.');
}

import 'fake-indexeddb/auto';
import { beforeEach,describe,expect,it } from 'vitest';
import {bogotaToday,balance} from '../savings/calculations';
import {loadSnapshot,saveFinalGoal,saveMonthlyPlan,saveMovement,restoreSnapshot} from '../savings/storage';
import type { Movement } from '../savings/types';
import {createPersonalBackup,parsePersonalBackup} from './backup';
import {loadPersonalSnapshot,removeEvent,restoreFullBackup,saveCountdown,saveEvent,saveOccurrenceState,saveTask} from './storage';
import type {CalendarEvent,Countdown,Task} from './types';
const stamp='2026-11-17T05:00:00.000Z';
function event(p:Partial<CalendarEvent>={}):CalendarEvent{return {id:crypto.randomUUID(),title:'Pago',category:'expense',startDate:'2026-11-20',endDate:'2026-11-20',important:false,recurrence:'monthly',createdAt:stamp,updatedAt:stamp,...p};}
function task(p:Partial<Task>={}):Task{return {id:crypto.randomUUID(),title:'Tarea',createdAt:stamp,updatedAt:stamp,...p};}
function countdown(p:Partial<Countdown>={}):Countdown{return {id:crypto.randomUUID(),title:'Fecha',targetDate:'2027-01-01',pinned:false,createdAt:stamp,updatedAt:stamp,...p};}
async function reset(){await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('aiden-savings');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
beforeEach(reset);
describe('migración y datos persistentes',()=>{
 it('v2 pasa a v3 sin tocar montos, id, meta ni plan',async()=>{
  const m:Movement={id:crypto.randomUUID(),type:'deposit',amountCOP:35000,localDate:'2026-11-01',createdAt:stamp,updatedAt:stamp};
  await new Promise<void>((resolve,reject)=>{
    const r=indexedDB.open('aiden-savings',2);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('movements',{keyPath:'id'}).put(m);d.createObjectStore('settings').put({schemaVersion:2,targetEndMonth:'2029-07',monthlyPlanCOP:200000,finalGoalCOP:8000000},'current');};
    r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);
  });
  const saved=await loadPersonalSnapshot();expect(saved.movements).toEqual([m]);expect(saved.settings).toEqual({schemaVersion:2,targetEndMonth:'2029-07',monthlyPlanCOP:200000,finalGoalCOP:8000000});
  expect(saved.events).toEqual([]);expect(saved.tasks).toEqual([]);expect(saved.countdowns).toEqual([]);
  expect(balance(saved.movements)).toBe(35000);
 });
 it('evento y confirmación de un solo mes no alteran alcancía',async()=>{
  await saveMovement({id:crypto.randomUUID(),type:'deposit',amountCOP:20000,localDate:'2026-11-01',createdAt:stamp,updatedAt:stamp},'add');
  const e=event();await saveEvent(e,'add');
  await saveOccurrenceState({eventId:e.id,occurrenceStartDate:e.startDate,occurrenceKey:`${e.id}@${e.startDate}`,status:'paid',changedAt:stamp},e.id,e.startDate);
  const s=await loadPersonalSnapshot();expect(s.eventOccurrenceStates).toHaveLength(1);expect(balance(s.movements)).toBe(20000);
 });
 it('editar fechas de una serie invalida los estados en el mismo commit',async()=>{
  const e=event();await saveEvent(e,'add');await saveOccurrenceState({eventId:e.id,occurrenceStartDate:e.startDate,occurrenceKey:`${e.id}@${e.startDate}`,status:'paid',changedAt:stamp},e.id,e.startDate);
  await saveEvent({...e,startDate:'2026-11-21',endDate:'2026-11-21'},'edit');
  expect((await loadPersonalSnapshot()).eventOccurrenceStates).toHaveLength(0);
 });
 it('borrar un evento borra estados y countdowns vinculados sin afectar tareas',async()=>{
  const e=event({category:'personal'});await saveEvent(e,'add');await saveTask(task(),'add');
  await saveCountdown(countdown({targetDate:undefined,sourceEventId:e.id,pinned:true}),'add');
  await removeEvent(e.id);const data=await loadPersonalSnapshot();expect(data.events).toHaveLength(0);expect(data.countdowns).toHaveLength(0);expect(data.tasks).toHaveLength(1);
 });
 it('solo un countdown fijado y v3 restaura íntegramente',async()=>{
  const a=countdown({pinned:true}),b=countdown({pinned:true});await saveCountdown(a,'add');await saveCountdown(b,'add');
  expect((await loadPersonalSnapshot()).countdowns.filter(c=>c.pinned).map(c=>c.id)).toEqual([b.id]);
  await saveTask(task(),'add');const saved=await loadPersonalSnapshot();
  const backup=createPersonalBackup(saved,new Date(stamp));expect(parsePersonalBackup(JSON.stringify(backup)).kind).toBe('full');
  await restoreFullBackup(backup);expect(await loadPersonalSnapshot()).toEqual(saved);
 });
 it('v1/v2 importar ahorros conserva calendario y tareas',async()=>{
  const e=event();await saveEvent(e,'add');const t=task();await saveTask(t,'add');
  const s=await loadPersonalSnapshot();const old={format:'aiden.savings.backup',version:1,exportedAt:stamp,settings:{schemaVersion:1,targetEndMonth:'2029-07',monthlyPlanCOP:90000},movements:[]};
  const parsed=parsePersonalBackup(JSON.stringify(old));expect(parsed.kind).toBe('legacy');
  if(parsed.kind==='legacy')await restoreSnapshot(parsed.savings);
  const after=await loadPersonalSnapshot();expect(after.events).toEqual([e]);expect(after.tasks).toEqual([t]);expect(after.settings.monthlyPlanCOP).toBe(90000);
  expect(s.movements).toEqual([]);
 });
 it('copia rota rechazada y restauración atómica ante fallo',async()=>{
  const t=task();await saveTask(t,'add');await saveMonthlyPlan(100000);await saveFinalGoal(8000000);
  const original=await loadPersonalSnapshot();const backup=createPersonalBackup(original);
  expect(()=>parsePersonalBackup(JSON.stringify({...backup,tasks:[...backup.tasks,backup.tasks[0]]}))).toThrow();
  const bad={...backup,tasks:[...backup.tasks,{...t,id:'broken'}]};
  await expect(restoreFullBackup(bad)).rejects.toThrow();
  expect(await loadPersonalSnapshot()).toEqual(original);
 });
 it('recarga del almacenamiento no agrega dinero ficticio',async()=>{
  const data=await loadPersonalSnapshot();expect(data.movements).toHaveLength(0);expect(await loadSnapshot()).toMatchObject({movements:[]});
 });
});

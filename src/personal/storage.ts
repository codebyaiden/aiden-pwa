import { bogotaToday } from '../savings/calculations';
import { loadSnapshot, request, transaction } from '../savings/storage';
import { validateLedger, validateSettings } from '../savings/validation';
import { occurrencesForRange } from './dates';
import { validatePersonalCollections, validCountdown, validEvent, validState, validTask } from './validation';
import type { BackupV3, CalendarEvent, Countdown, EventOccurrenceState, PersonalSnapshot, Task } from './types';

const stores = ['movements','settings','events','eventOccurrenceStates','tasks','countdowns'];
export async function loadPersonalSnapshot():Promise<PersonalSnapshot>{
  // Read every collection in one readonly transaction so the backup/dashboard is coherent.
  return transaction('readonly',stores,async tx=>{
    const [movements,settings,events,eventOccurrenceStates,tasks,countdowns] = await Promise.all([
      request<PersonalSnapshot['movements']>(tx.objectStore('movements').getAll()),
      request<PersonalSnapshot['settings']|undefined>(tx.objectStore('settings').get('current')),
      request<CalendarEvent[]>(tx.objectStore('events').getAll()),
      request<EventOccurrenceState[]>(tx.objectStore('eventOccurrenceStates').getAll()),
      request<Task[]>(tx.objectStore('tasks').getAll()),
      request<Countdown[]>(tx.objectStore('countdowns').getAll())
    ]);
    validateLedger(movements,bogotaToday());
    // Existing settings may be absent on a fresh install; preserve the exact v2 defaults.
    const savings = settings ? settings : (awaitSettingsDefault());
    if(!validateSettings(savings))throw new Error('La configuración guardada no es válida.');
    const personal={movements,settings:savings,events,eventOccurrenceStates,tasks,countdowns};
    validatePersonalCollections(personal);
    return personal;
  });
}
function awaitSettingsDefault(){return {monthlyPlanCOP:null,finalGoalCOP:null,targetEndMonth:'2029-07',schemaVersion:2} as const;}
export async function saveEvent(next:CalendarEvent,mode:'add'|'edit'){
  if(!validEvent(next))throw new Error('Revisa los datos del evento.');
  await transaction('readwrite',['events','eventOccurrenceStates'],async tx=>{
    const es=tx.objectStore('events'),ss=tx.objectStore('eventOccurrenceStates');
    const old=await request<CalendarEvent|undefined>(es.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('Este evento ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt))throw new Error('Este evento cambió. Vuelve a abrirlo.');
    const structural=old&&(old.startDate!==next.startDate||old.endDate!==next.endDate||old.recurrence!==next.recurrence||old.recurrenceUntil!==next.recurrenceUntil||old.category!==next.category);
    if(structural){const states=await request<EventOccurrenceState[]>(ss.getAll());for(const s of states)if(s.eventId===next.id)ss.delete(s.occurrenceKey);}
    if(mode==='add')es.add(next);else es.put(next);
  });
}
export async function removeEvent(id:string){
  await transaction('readwrite',['events','eventOccurrenceStates','countdowns'],async tx=>{
    const es=tx.objectStore('events'),ss=tx.objectStore('eventOccurrenceStates'),cs=tx.objectStore('countdowns');
    if(!await request(es.get(id)))throw new Error('El evento ya no existe.');
    const states=await request<EventOccurrenceState[]>(ss.getAll());
    const countdowns=await request<Countdown[]>(cs.getAll());
    for(const s of states)if(s.eventId===id)ss.delete(s.occurrenceKey);
    // An event-linked countdown has no independent date: delete it instead of orphaning it.
    for(const c of countdowns)if(c.sourceEventId===id)cs.delete(c.id);
    es.delete(id);
  });
}
export async function saveOccurrenceState(next:EventOccurrenceState|null,eventId:string,startDate:string){
  if(next&&!validState(next))throw new Error('El estado del pago no es válido.');
  await transaction('readwrite',['events','eventOccurrenceStates'],async tx=>{
    const event=await request<CalendarEvent|undefined>(tx.objectStore('events').get(eventId));
    if(!event||event.category==='personal')throw new Error('El evento financiero ya no existe.');
    if(!occurrencesForRange([event],startDate,startDate).some(o=>o.startDate===startDate))throw new Error('Esta ocurrencia ya no existe.');
    if(next&&(next.eventId!==eventId||next.occurrenceStartDate!==startDate||(next.status==='paid'&&event.category!=='expense')||(next.status==='received'&&event.category!=='income')))throw new Error('Estado no compatible con este evento.');
    if(next)tx.objectStore('eventOccurrenceStates').put(next);
    else tx.objectStore('eventOccurrenceStates').delete(`${eventId}@${startDate}`);
  });
}
export async function saveTask(next:Task,mode:'add'|'edit'){
  if(!validTask(next))throw new Error('Revisa los datos de la tarea.');
  await transaction('readwrite',['tasks'],async tx=>{
    const store=tx.objectStore('tasks');const old=await request<Task|undefined>(store.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('La tarea ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt))throw new Error('La tarea ya no existe.');
    if(mode==='add')store.add(next);else store.put(next);
  });
}
export async function removeTask(id:string){
  await transaction('readwrite',['tasks'],async tx=>{
    const store=tx.objectStore('tasks');if(!await request(store.get(id)))throw new Error('La tarea ya no existe.');store.delete(id);
  });
}
export async function saveCountdown(next:Countdown,mode:'add'|'edit'){
  if(!validCountdown(next))throw new Error('Revisa los datos del countdown.');
  await transaction('readwrite',['countdowns','events'],async tx=>{
    const store=tx.objectStore('countdowns');const old=await request<Countdown|undefined>(store.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('El countdown ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt))throw new Error('El countdown ya no existe.');
    if(next.sourceEventId){const event=await request<CalendarEvent|undefined>(tx.objectStore('events').get(next.sourceEventId));if(!event||event.category!=='personal')throw new Error('Selecciona un evento personal existente.');}
    if(next.pinned){const all=await request<Countdown[]>(store.getAll());for(const c of all)if(c.pinned&&c.id!==next.id)store.put({...c,pinned:false,updatedAt:new Date().toISOString()});}
    if(mode==='add')store.add(next);else store.put(next);
  });
}
export async function removeCountdown(id:string){
  await transaction('readwrite',['countdowns'],async tx=>{
    const store=tx.objectStore('countdowns');if(!await request(store.get(id)))throw new Error('El countdown ya no existe.');store.delete(id);
  });
}
export async function restoreFullBackup(backup:BackupV3){
  validateLedger(backup.movements,bogotaToday());
  if(!validateSettings(backup.settings))throw new Error('La configuración del respaldo no es válida.');
  validatePersonalCollections(backup);
  await transaction('readwrite',stores,async tx=>{
    for(const name of stores)tx.objectStore(name).clear();
    for(const m of backup.movements)tx.objectStore('movements').add(m);
    tx.objectStore('settings').put(backup.settings,'current');
    for(const e of backup.events)tx.objectStore('events').add(e);
    for(const s of backup.eventOccurrenceStates)tx.objectStore('eventOccurrenceStates').add(s);
    for(const t of backup.tasks)tx.objectStore('tasks').add(t);
    for(const c of backup.countdowns)tx.objectStore('countdowns').add(c);
  });
}
// Keep the v1.1 storage functions directly usable without touching personal stores.
export {loadSnapshot};

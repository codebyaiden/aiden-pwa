import { bogotaToday, balance } from '../savings/calculations';
import { parseBackup, MAX_BACKUP_SIZE } from '../savings/backup';
import type { BackupV2 } from '../savings/types';
import { isISODate,validateLedger,validateSettings } from '../savings/validation';
import { validateFinanceEntries, validatePersonalCollections } from './validation';
import {validateRoutine} from '../routine/schema';
import type {State} from '../routine/engine';
import type { BackupV5, BackupV4, PersonalSnapshot } from './types';
export type ParsedBackup={kind:'legacy';savings:BackupV2}|{kind:'full';data:BackupV4;preserveFinance?:boolean;routine?:State};
export function createPersonalBackup(data:PersonalSnapshot,now:Date=new Date()):BackupV4{
  validatePersonalCollections(data);
  validateFinanceEntries(data.financeEntries,bogotaToday());
  return {format:'aiden.personal.backup',version:4,exportedAt:now.toISOString(),
    settings:{...data.settings},movements:data.movements.map(x=>({...x})),events:data.events.map(x=>({...x})),
    eventOccurrenceStates:data.eventOccurrenceStates.map(x=>({...x})),tasks:data.tasks.map(x=>({...x})),countdowns:data.countdowns.map(x=>({...x})),financeEntries:data.financeEntries.map(x=>({...x}))};
}
export function createUnifiedBackup(data:PersonalSnapshot,routine:State):BackupV5 {
  const safe=validateRoutine(routine);
  delete safe.syncPush;
  return {...createPersonalBackup(data),version:5,routine:safe};
}
export function parsePersonalBackup(raw:string,today=bogotaToday()):ParsedBackup{
  if(new TextEncoder().encode(raw).length>MAX_BACKUP_SIZE)throw new Error('El archivo supera 5 MB.');
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new Error('El archivo no contiene JSON válido.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Copia no válida.');
  const obj=parsed as Record<string,unknown>;
  if(obj.format==='aiden.savings.backup')return {kind:'legacy',savings:parseBackup(raw,today)};
  if(obj.format!=='aiden.personal.backup'||(obj.version!==3&&obj.version!==4&&obj.version!==5))throw new Error('Formato de copia no compatible.');
  const originalFields=['format','version','exportedAt','settings','movements','events','eventOccurrenceStates','tasks','countdowns'];
  const expected=obj.version===3?originalFields:[...originalFields,'financeEntries',...(obj.version===5?['routine']:[])];
  if(Object.keys(obj).sort().join(',')!==expected.sort().join(','))throw new Error('Estructura de la copia no válida.');
  if(!isISODate(obj.exportedAt)||!validateSettings(obj.settings))throw new Error('Fecha o configuración no válida.');
  validateLedger(obj.movements,today);
  validatePersonalCollections(obj as unknown as PersonalSnapshot);
  if(obj.version!==3)validateFinanceEntries(obj.financeEntries,today);
  // Backups v3 were complete before personal finance existed; do not invent entries.
  const {routine:rawRoutine,...personal}=obj;
  const routine=obj.version===5?validateRoutine(rawRoutine):undefined;
  if(routine)delete routine.syncPush;
  const b={...personal,version:4,financeEntries:obj.version===3?[]:obj.financeEntries} as unknown as BackupV4;
  return {kind:'full',data:b,preserveFinance:obj.version===3,routine};
}
export function personalBackupSummary(b:ParsedBackup){
  const d=b.kind==='full'?b.data:b.savings;
  return {movements:d.movements.length,total:balance(d.movements),events:b.kind==='full'?b.data.events.length:null,tasks:b.kind==='full'?b.data.tasks.length:null,countdowns:b.kind==='full'?b.data.countdowns.length:null,financeEntries:b.kind==='full'?b.data.financeEntries.length:null};
}
export function downloadPersonalBackup(backup:BackupV4|BackupV5){
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=`aiden-copia-${bogotaToday()}.json`;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

import { bogotaToday, balance } from '../savings/calculations';
import { parseBackup, MAX_BACKUP_SIZE } from '../savings/backup';
import type { BackupV2 } from '../savings/types';
import { isISODate,validateLedger,validateSettings } from '../savings/validation';
import { validatePersonalCollections } from './validation';
import type { BackupV3, PersonalSnapshot } from './types';
export type ParsedBackup={kind:'legacy';savings:BackupV2}|{kind:'full';data:BackupV3};
export function createPersonalBackup(data:PersonalSnapshot,now:Date=new Date()):BackupV3{
  validatePersonalCollections(data);
  return {format:'aiden.personal.backup',version:3,exportedAt:now.toISOString(),
    settings:{...data.settings},movements:data.movements.map(x=>({...x})),events:data.events.map(x=>({...x})),
    eventOccurrenceStates:data.eventOccurrenceStates.map(x=>({...x})),tasks:data.tasks.map(x=>({...x})),countdowns:data.countdowns.map(x=>({...x}))};
}
export function parsePersonalBackup(raw:string,today=bogotaToday()):ParsedBackup{
  if(new TextEncoder().encode(raw).length>MAX_BACKUP_SIZE)throw new Error('El archivo supera 5 MB.');
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new Error('El archivo no contiene JSON válido.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Copia no válida.');
  const obj=parsed as Record<string,unknown>;
  if(obj.format==='aiden.savings.backup')return {kind:'legacy',savings:parseBackup(raw,today)};
  if(obj.format!=='aiden.personal.backup'||obj.version!==3)throw new Error('Formato de copia no compatible.');
  if(Object.keys(obj).sort().join(',')!==['format','version','exportedAt','settings','movements','events','eventOccurrenceStates','tasks','countdowns'].sort().join(','))throw new Error('Estructura de la copia no válida.');
  if(!isISODate(obj.exportedAt)||!validateSettings(obj.settings))throw new Error('Fecha o configuración no válida.');
  validateLedger(obj.movements,today);
  const b=obj as unknown as BackupV3;
  validatePersonalCollections(b);
  return {kind:'full',data:b};
}
export function personalBackupSummary(b:ParsedBackup){
  const d=b.kind==='full'?b.data:b.savings;
  return {movements:d.movements.length,total:balance(d.movements),events:b.kind==='full'?b.data.events.length:null,tasks:b.kind==='full'?b.data.tasks.length:null,countdowns:b.kind==='full'?b.data.countdowns.length:null};
}
export function downloadPersonalBackup(backup:BackupV3){
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=`aiden-copia-${bogotaToday()}.json`;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

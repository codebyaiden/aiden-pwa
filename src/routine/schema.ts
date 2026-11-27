import {z} from 'zod';
import type {State} from './engine';

const date = z.iso.date();
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const stamp = z.number().int().min(0).max(8.64e15);
const minute = z.number().int().min(0).max(1439);
const activity = z.enum(['unknown','awake','gaming','movie','youtube','coding','away','sleeping']);
const step = z.strictObject({
  id, title:z.string().max(150), instruction:z.string().max(1200),
  essential:z.boolean(), seconds:z.number().int().positive().max(86400).optional()
});
const routine = z.strictObject({
  id,title:z.string().max(150),start:minute,end:minute,cutoff:minute,afterWake:z.boolean(),
  steps:z.array(step).min(1).max(100),messages:z.array(z.string().min(1).max(200)).min(10).max(50)
}).refine(x=>x.start<=x.end&&x.end<=x.cutoff&&new Set(x.steps.map(s=>s.id)).size===x.steps.length);
const run = z.strictObject({
  key:z.string().max(111),routineId:id,date,due:stamp,done:z.array(id).max(100),skipped:z.array(id).max(100),
  retries:z.number().int().min(0).max(20),next:stamp.nullable(),cancelled:z.boolean().optional(),completedAt:stamp.optional(),
  timer:z.strictObject({stepId:id,end:stamp,paused:stamp.optional()}).optional()
});
export const routineSchema = z.strictObject({
  version:z.literal(1),started:date.nullable(),mode:z.enum(['normal','minimum','vacation']),vacationUntil:date.nullable(),
  wake:z.strictObject({date,at:stamp}).nullable(),
  context:z.strictObject({activity,source:z.string().max(200),at:stamp,expires:stamp}).nullable(),
  rules:z.record(id,activity),routines:z.array(routine).min(1).max(20),runs:z.record(z.string().max(111),run),
  products:z.array(z.strictObject({id,name:z.string().max(100),opened:z.union([date,z.literal('')]),expires:z.union([date,z.literal('')]),remaining:z.number().min(0).max(100),note:z.string().max(500)})).max(500),
  maintenance:z.array(z.strictObject({id,title:z.string().max(100),every:z.number().int().min(1).max(365),due:date})).max(500),
  reviews:z.array(z.strictObject({date,note:z.string().max(1000)})).max(2000),
  lastVisit:date.nullable(),history:z.array(z.strictObject({at:stamp,text:z.string().max(500)})).max(200),
  reminders:z.boolean(),retryMinutes:z.array(z.number().int().min(1).max(180)).max(8).optional(),
  quiet:z.strictObject({start:minute,end:minute}).optional(),signals:z.record(id,stamp).optional(),syncPush:z.boolean().optional()
}).superRefine((s,ctx)=>{
  const definitions=new Map(s.routines.map(r=>[r.id,new Set(r.steps.map(t=>t.id))]));
  if(definitions.size!==s.routines.length)ctx.addIssue({code:'custom',message:'Rutinas duplicadas.'});
  for(const [key,value] of Object.entries(s.runs)){
    const steps=definitions.get(value.routineId);
    const marked=[...value.done,...value.skipped];
    if(key!==value.key||key!==value.date+':'+value.routineId||!steps||new Set(marked).size!==marked.length||
      marked.some(id=>!steps.has(id))||(value.timer&&!steps.has(value.timer.stepId))){
      ctx.addIssue({code:'custom',message:'Registro de rutina no válido.',path:['runs',key]});
    }
  }
});
export function validateRoutine(value:unknown):State {
  const parsed=routineSchema.safeParse(value);
  if(!parsed.success)throw new Error('Los datos de rutina no son válidos.');
  return parsed.data;
}

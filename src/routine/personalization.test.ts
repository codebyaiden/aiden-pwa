import {describe,it,expect} from 'vitest';
import {initial,at,tick,activeContext,mark} from './engine';
import {receiveSignal,teach,explain,reviewSummary,parseChanges,applyChanges} from './personalization';
const date='2026-11-26',now=at(date,900);
const begun=()=>tick({...initial(),started:date},now,()=>0);
const valid={format:'aiden.routine.changes.v1',changes:[{routineId:'movement',start:950,end:980,cutoff:1100}]};
describe('personalization',()=>{
 it('treats Sleep Focus as ambiguous, expires stale context, respects explicit rules',()=>{const s=begun();expect(activeContext(receiveSignal(s,'sleep-focus',now),now)).toBe('unknown');const g=receiveSignal(s,'gaming-focus',now);expect(activeContext(g,now)).toBe('gaming');expect(activeContext(g,now+31*60000)).toBe('unknown');expect(activeContext(receiveSignal(teach(s,'gaming-focus','coding'),'gaming-focus',now),now)).toBe('coding');});
 it('explains postponement and completion',()=>{const s=begun();expect(explain(receiveSignal(s,'gaming-focus',now),now).find(x=>x.id==='movement')?.reason).toContain('Pospuesto');const done=mark(s,date+':movement','walk','done',now);expect(reviewSummary(done,date,date).find(x=>x.id==='movement')?.completed).toBe(1);expect(explain(done,now).find(x=>x.id==='movement')?.reason).toBe('Sin tareas pendientes');});
 it('validates reviewed configuration and preserves existing run timestamps',()=>{const s=begun();const a=applyChanges(s,parseChanges(JSON.stringify(valid),s));expect(a.routines[1].start).toBe(950);expect(a.runs[date+':movement'].due).toBe(s.runs[date+':movement'].due);expect(s.routines[1].start).toBe(900);for(const change of [{...valid.changes[0],start:9999},{...valid.changes[0],routineId:'morning'},{...valid.changes[0],steps:[]}])expect(()=>parseChanges(JSON.stringify({...valid,changes:[change]}),s)).toThrow();expect(()=>parseChanges(JSON.stringify({...valid,changes:[...valid.changes,...valid.changes]}),s)).toThrow();});
});

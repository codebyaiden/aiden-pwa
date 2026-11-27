import type {Run,State} from './engine';

// Keep local changes since the previous response and retain independent server changes.
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeRoutine(base:State, local:State, remote:State):State {
  const next={...remote,runs:{...remote.runs}};
  for(const key of new Set([...Object.keys(base),...Object.keys(local)]) as Set<keyof State>){
    if(key==='runs'||key==='history'||key==='syncPush'||equal(base[key],local[key]))continue;
    if(key==='context'&&remote.context&&local.context&&remote.context.at>local.context.at)continue;
    if(key==='wake'&&remote.wake&&local.wake&&remote.wake.at>local.wake.at)continue;
    Object.assign(next,{[key]:local[key]});
  }
  for(const key of new Set([...Object.keys(base.runs),...Object.keys(local.runs)])){
    const before=base.runs[key], after=local.runs[key], server=remote.runs[key];
    if(equal(before,after))continue;
    if(!after){delete next.runs[key];continue;}
    if(!server){next.runs[key]=after;continue;}
    const merged={...server};
    for(const field of new Set([...Object.keys(before??{}),...Object.keys(after)]) as Set<keyof Run>){
      if(before ? !equal(before[field],after[field]) :
        field==='timer'||field==='cancelled'||field==='completedAt'||((field==='done'||field==='skipped')&&after[field].length>0)){
        Object.assign(merged,{[field]:after[field]});
      }
    }
    // Resolve step decisions individually when different steps were marked offline.
    const decisions=(run:Run|undefined,id:string)=>run?.done.includes(id)?'done':run?.skipped.includes(id)?'skipped':null;
    const ids=new Set([...(before?.done??[]),...(before?.skipped??[]),...after.done,...after.skipped,...server.done,...server.skipped]);
    merged.done=[];merged.skipped=[];
    for(const id of ids){
      const localDecision=decisions(after,id);
      const decision=localDecision===decisions(before,id)?decisions(server,id):localDecision;
      if(decision)merged[decision].push(id);
    }
    next.runs[key]=merged;
  }
  const entries=new Map(remote.history.map(x=>[JSON.stringify(x),x]));
  const prior=new Set(base.history.map(x=>JSON.stringify(x)));
  for(const entry of local.history)if(!prior.has(JSON.stringify(entry)))entries.set(JSON.stringify(entry),entry);
  next.history=[...entries.values()].sort((a,b)=>a.at-b.at).slice(-200);
  return next;
}

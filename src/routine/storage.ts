import {request,transaction} from '../savings/storage';
import {requestSync} from './sync';
import {initial,type State} from './engine';
export async function loadRoutine():Promise<State>{return transaction('readonly',['routine'],async tx=>{const data=await request<State|undefined>(tx.objectStore('routine').get('state'));if(data===undefined)return initial();if(data.version!==1)throw new Error('Versión de rutina no compatible.');return data;});}
export async function updateRoutine(fn:(s:State)=>State):Promise<State>{const result=await transaction('readwrite',['routine'],async tx=>{const store=tx.objectStore('routine');const current=await request<State|undefined>(store.get('state'));if(current&&current.version!==1)throw new Error('Versión de rutina no compatible.');const next=fn(current??initial());if(next!==current)store.put(next,'state');return {next,changed:next!==current&&!!next.started};});if(result.changed)requestSync();return result.next;}

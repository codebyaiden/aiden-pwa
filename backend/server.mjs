import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import * as webPush from 'web-push';
import {initial,dateAt,at,addDays,tick,reminder,acknowledge,quietNow,activeContext,cutoffAt,snooze,cancel} from '../src/routine/engine.ts';
import {receiveSignal,signals} from '../src/routine/personalization.ts';
import {mergeRoutine} from '../src/routine/merge.ts';
import {validateRoutine} from '../src/routine/schema.ts';

const {DATABASE, APP_TOKEN, WEBHOOK_TOKEN, ORIGIN, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, PORT='8795'}=process.env;
if(![DATABASE,ORIGIN,VAPID_PUBLIC,VAPID_PRIVATE,VAPID_SUBJECT].every(Boolean)||
  ![APP_TOKEN,WEBHOOK_TOKEN].every(x=>/^[a-f0-9]{64}$/.test(x??''))||APP_TOKEN===WEBHOOK_TOKEN){
  throw new Error('Missing or invalid service configuration.');
}
webPush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC,VAPID_PRIVATE);
const db=new DatabaseSync(DATABASE);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=FULL;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY, at INTEGER NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL, next INTEGER NOT NULL
  );
`);
const get=(key)=>{const row=db.prepare('SELECT value FROM settings WHERE key=?').get(key);return row?JSON.parse(row.value):null;};
const put=(key,value)=>db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
const del=(key)=>db.prepare('DELETE FROM settings WHERE key=?').run(key);
const atomic=(fn)=>{
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
};
const state=()=>get('routine')??initial();
const result=()=>({...state(),syncPush:!!get('subscription')});
const update=(next)=>{delete next.syncPush;put('routine',next);};
const reject=(code)=>{throw Object.assign(new Error('Request rejected'),{code});};
const authenticated=(req,secret)=>{
  const header=Buffer.from(req.headers.authorization??'');
  const expected=Buffer.from('Bearer '+secret);
  return header.length===expected.length&&timingSafeEqual(header,expected);
};
async function body(req,max=5*1024*1024){
  if(req.headers['content-type']?.split(';')[0]!=='application/json')reject(415);
  if(Number(req.headers['content-length'])>max)reject(413);
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>max){reject(413);}chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reject(400);}
}
function subscription(input){
  if(!input||typeof input.endpoint!=='string'||input.endpoint.length>2048)reject(400);
  let url;try{url=new URL(input.endpoint);}catch{reject(400);}
  const allowed=/^(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)?push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
  const key=input.keys?.p256dh, auth=input.keys?.auth;
  if(url.protocol!=='https:'||!allowed.test(url.hostname)||url.username||url.password||url.port||url.hash||
    !/^B[A-Za-z0-9_-]{86}$/.test(key??'')||!(/^[A-Za-z0-9_-]{22}$/).test(auth??''))reject(400);
  try{webPush.generateRequestDetails({endpoint:url.href,keys:{p256dh:key,auth}},'test');}catch{reject(400);}
  return {endpoint:url.href,keys:{p256dh:key,auth}};
}

const actions={
  signal(s,data,now){
    if(!signals.includes(data.signal))reject(400);
    return receiveSignal(s,data.signal,now,'Automatización');
  },
  wake(s,_data,now){
    return {...s,wake:{date:dateAt(now),at:now},context:{activity:'awake',source:'Confirmación en Atajos',at:now,expires:now+7200000}};
  },
  snooze(s,data,now){
    if(typeof data.key!=='string'||!Object.hasOwn(s.runs,data.key)||s.runs[data.key].date!==dateAt(now)||!Number.isInteger(data.minutes)||data.minutes<1||data.minutes>180)reject(400);
    return snooze(s,data.key,data.minutes,now);
  },
  cancel(s,data,now){
    if(typeof data.key!=='string'||!Object.hasOwn(s.runs,data.key)||s.runs[data.key].date!==dateAt(now))reject(400);
    return cancel(s,data.key);
  }
};
const webhookPaths=new Set(['/v1/webhook','/v1/shortcut']);
function webhook(data){
  if(!data||typeof data.action!=='string'||!Object.hasOwn(actions,data.action)||typeof data.id!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(data.id))reject(400);
  const fields={signal:['signal'],wake:[],snooze:['key','minutes'],cancel:['key']}[data.action];
  if(Object.keys(data).some(key=>!['id','action',...fields].includes(key)))reject(400);
  return atomic(()=>{
    const now=Date.now();
    if(db.prepare('SELECT 1 FROM events WHERE id=?').get(data.id))return {accepted:true,duplicate:true};
    const current=state();
    update(tick(actions[data.action](current,data,now),now));
    db.prepare('INSERT INTO events VALUES (?,?)').run(data.id,now);
    return {accepted:true,duplicate:false};
  });
}

const recentRequests=new Map();
const server=createServer(async(req,res)=>{
  const send=(status,data)=>{
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(data));
  };
  try{
    const origin=req.headers.origin;
    if(origin&&origin!==ORIGIN)reject(403);
    if(origin){res.setHeader('Access-Control-Allow-Origin',ORIGIN);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Headers','authorization, content-type');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
      res.writeHead(204);return res.end();
    }
    const path=req.url;
    if(req.method==='GET'&&path==='/v1/health'){db.prepare('SELECT 1').get();return send(200,{ok:true});}
    const hook=webhookPaths.has(path);
    if(!authenticated(req,hook?WEBHOOK_TOKEN:APP_TOKEN))reject(401);
    const group=hook?'hook':'app', now=Date.now();
    let rate=recentRequests.get(group);
    if(!rate||rate.until<=now){rate={until:now+60000,count:0};recentRequests.set(group,rate);}
    if(++rate.count>180)reject(429);
    if(hook&&req.method==='POST')return send(200,webhook(await body(req,4096)));
    if(path==='/v1/status'&&req.method==='GET')return send(200,{vapid:VAPID_PUBLIC,push:!!get('subscription')});
    if(path==='/v1/sync'&&req.method==='GET')return send(200,result());
    if(path==='/v1/sync'&&req.method==='POST'){
      const input=await body(req);
      let base,local;
      try{base=validateRoutine(input.base);local=validateRoutine(input.local);}catch{reject(400);}
      return send(200,atomic(()=>{
        const next=mergeRoutine(base,local,state());
        if(local.started)next.lastVisit=dateAt(Date.now());
        let validated;try{validated=validateRoutine(tick(next,Date.now()));}catch{reject(409);}
        update(validated);return result();
      }));
    }
    if(path==='/v1/subscription'&&req.method==='POST'){
      const sub=subscription(await body(req,4096));put('subscription',sub);return send(200,{push:true});
    }
    if(path==='/v1/subscription'&&req.method==='DELETE'){del('subscription');return send(200,{push:false});}
    if(path==='/v1/history'&&req.method==='GET')return send(200,db.prepare('SELECT id,at,status,attempts FROM deliveries ORDER BY at DESC LIMIT 40').all());
    if(path==='/v1/test'&&req.method==='POST'){
      const sub=get('subscription');if(!sub)reject(409);
      return send(200,{status:await deliver(sub,{title:'aiden.',body:'Aviso de prueba',tag:'routine-test'})});
    }
    reject(404);
  }catch(error){
    const code=Number.isInteger(error.code)?error.code:500;
    if(code===500)console.error('Request failed');
    if(!res.headersSent)send(code,{error:code===500?'Servicio no disponible':'Solicitud rechazada'});
  }
});
server.requestTimeout=20000;
server.headersTimeout=10000;
server.maxHeadersCount=40;

async function deliver(sub,payload){
  try{
    await webPush.sendNotification(sub,JSON.stringify(payload),{TTL:180,timeout:8000,urgency:'normal'});
    return 'accepted';
  }catch(error){
    if([404,410].includes(error.statusCode)){
      if(JSON.stringify(get('subscription'))===JSON.stringify(sub))del('subscription');
      return 'expired';
    }
    return !error.statusCode||error.statusCode===429||error.statusCode>=500?'retry':'failed';
  }
}

const runDeliveryId=run=>`${run.key}:${run.next}:${run.retries}`;
function dueItem(s,now){
  if(!s.started||!s.reminders||s.mode==='vacation'||quietNow(s,now)||activeContext(s,now)==='sleeping')return null;
  const due=reminder(s,now,run=>eligible(runDeliveryId(run),now));
  if(due){
    const run=s.runs[due.key];
    return {id:runDeliveryId(run),key:due.key,expected:run.next,cutoff:cutoffAt(s.routines.find(r=>r.id===run.routineId),run),body:due.text};
  }
  const day=dateAt(now);
  if(now<at(day,720)||now>=at(day,1200))return null;
  const items=[
    ...s.maintenance.filter(x=>x.due<=day).map(x=>({id:`maintenance:${x.id}:${x.due}`,body:'Tienes mantenimiento pendiente.'})),
    ...s.products.filter(x=>x.remaining<=10||x.expires&&x.expires<=day).map(x=>({id:`product:${x.id}:${x.expires||'stock'}:${day.slice(0,7)}`,body:'Revisa tu inventario.'})),
  ];
  const sunday=addDays(day,-new Date(at(day,720)).getUTCDay());
  if(now>=at(sunday,960))items.push({id:`review:${sunday}`,body:'Tu revisión semanal está lista.'});
  return items.find(x=>eligible(x.id,now))??null;
}
const delivery=(id)=>db.prepare('SELECT status,attempts,next FROM deliveries WHERE id=?').get(id);
function eligible(id,now){
  const entry=delivery(id);
  return !entry||((entry.status==='retry'||entry.status==='sending')&&entry.next<=now);
}
let working=false;
async function work(){
  if(working)return;
  working=true;
  try{
    const now=Date.now(), previous=state(), current=tick(previous,now);
    if(current!==previous)update(current);
    const sub=get('subscription');
    if(!sub)return;
    const due=dueItem(current,now);
    if(!due||due.cutoff&&due.cutoff<=now||!eligible(due.id,now))return;
    const attempts=(delivery(due.id)?.attempts??0)+1;
    db.prepare(`INSERT INTO deliveries VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE
      SET at=excluded.at,status=excluded.status,attempts=excluded.attempts,next=excluded.next`).run(due.id,now,'sending',attempts,now+60000);
    const status=await deliver(sub,{title:'aiden.',body:due.body,tag:due.key??due.id});
    atomic(()=>{
      const settled=status==='retry'&&attempts>=4?'failed':status;
      db.prepare('UPDATE deliveries SET status=?,next=? WHERE id=?').run(settled,Date.now()+30000*2**attempts,due.id);
      const latest=state(),run=latest.runs[due.key];
      if((settled==='accepted'||settled==='failed')&&run?.next===due.expected&&due.key){
        update(acknowledge(latest,due.key,Date.now(),settled==='accepted'?due.body:'No se pudo enviar un aviso.'));
      }
    });
  }catch{console.error('Reminder cycle failed');}
  finally{working=false;}
}
setInterval(()=>void work(),15000).unref();
setInterval(()=>{
  const threshold=Date.now()-90*86400000;
  db.prepare('DELETE FROM deliveries WHERE at<?').run(threshold);
  db.prepare('DELETE FROM events WHERE at<?').run(threshold);
},3600000).unref();
server.listen(Number(PORT),'127.0.0.1',()=>void work());

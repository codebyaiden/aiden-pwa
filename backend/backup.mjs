import {backup,DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rename,unlink,rmdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';

const [operation,source,destination,keyPath]=process.argv.slice(2);
if(!['create','restore'].includes(operation)||!source||!destination||!keyPath||source===destination){
  throw new Error('Usage: backup.mjs create|restore SOURCE DESTINATION KEY');
}
process.umask(0o077);
const key=await readFile(keyPath);
if(key.length!==32)throw new Error('Invalid recovery key.');
const magic=Buffer.from('aiden.sqlite.v1\0');
const temp=await mkdtemp(join(dirname(destination),'.aiden-backup-'));
const snapshot=join(temp,'snapshot');
const encrypted=join(temp,'encrypted');
function verify(path){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    if(db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw new Error('SQLite integrity check failed.');
    for(const table of ['settings','deliveries','events'])db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
  }finally{db.close();}
}
try {
  if(operation==='create'){
    const live=new DatabaseSync(source,{readOnly:true});
    try{await backup(live,snapshot);}finally{live.close();}
    verify(snapshot);
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(magic);
    const data=Buffer.concat([cipher.update(await readFile(snapshot)),cipher.final()]);
    await writeFile(encrypted,Buffer.concat([magic,iv,cipher.getAuthTag(),data]),{flag:'wx'});
    await rename(encrypted,destination);
  }else{
    const sourceData=await readFile(source);
    if(!sourceData.subarray(0,magic.length).equals(magic))throw new Error('Invalid backup format.');
    const decipher=createDecipheriv('aes-256-gcm',key,sourceData.subarray(magic.length,magic.length+12));
    decipher.setAAD(magic);
    decipher.setAuthTag(sourceData.subarray(magic.length+12,magic.length+28));
    const data=Buffer.concat([decipher.update(sourceData.subarray(magic.length+28)),decipher.final()]);
    await writeFile(snapshot,data,{flag:'wx'});
    verify(snapshot);
    await writeFile(destination,data,{flag:'wx'});
  }
  console.log('Verified SQLite '+(operation==='create'?'backup':'restoration')+'.');
}finally{
  for(const file of [snapshot,snapshot+'-wal',snapshot+'-shm',encrypted])await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});
  await rmdir(temp);
}

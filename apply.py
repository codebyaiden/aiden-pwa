#!/usr/bin/env python3
"""Apply to a clean checkout of the inspected aiden-pwa v1.3 source. No server changes."""
from pathlib import Path
import sys, shutil, subprocess
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
base=Path(__file__).resolve().parent
app=root/'src/App.tsx'; storage=root/'src/savings/storage.ts'; vite=root/'vite.config.ts'
if not all(x.is_file() for x in (app,storage,vite)): raise SystemExit('Not an aiden-pwa checkout')
a=app.read_text(); s=storage.read_text(); v=vite.read_text()
def replace_once(text, old, new):
 if text.count(old)!=1: raise SystemExit('Unexpected source: '+old[:100])
 return text.replace(old,new,1)
# Preflight all changes before writing anything.
a=replace_once(a,"import { useRegisterSW } from 'virtual:pwa-register/react';","import { useRegisterSW } from 'virtual:pwa-register/react';\nimport { RoutineView } from './routine/RoutineView';\nimport { RoutineReminder } from './routine/RoutineReminder';")
a=replace_once(a,"type Tab='home'|'calendar'|'savings'|'tasks';","type Tab='home'|'calendar'|'savings'|'tasks'|'routine';")
a=replace_once(a,"const tabFromHash=(hash:string):Tab=>hash===","const tabFromHash=(hash:string):Tab=>hash==='#rutina'?'routine':hash===")
a=replace_once(a,"const tabHash=(tab:Tab)=>tab===","const tabHash=(tab:Tab)=>tab==='routine'?'#rutina':tab===")
a=replace_once(a,"    tasks:<><path", "    routine:<><path d=\"M12 3v18M3 12h18\"/></>,\n    tasks:<><path")
a=replace_once(a,"  const [snapshot,setSnapshot]", "  useEffect(()=>{document.body.classList.add('routine-winter');document.body.style.setProperty('--routine-winter-gif',`url(${import.meta.env.BASE_URL}routine/winter.gif)`);document.body.style.setProperty('--routine-winter-still',`url(${import.meta.env.BASE_URL}routine/winter.webp)`);return()=>{document.body.classList.remove('routine-winter');document.body.style.removeProperty('--routine-winter-gif');document.body.style.removeProperty('--routine-winter-still');};},[]);\n  const [snapshot,setSnapshot]")
a=replace_once(a,'<main id="main-content">','<main id="main-content">{snapshot&&!loadError&&tab===\'home\'&&<button type="button" className="routine-entry" onClick={()=>navigate(\'routine\')}><span><strong>Rutina</strong><small>Ver lo que sigue</small></span><span aria-hidden="true">›</span></button>}')
a=replace_once(a,"      :tab==='home'?<HomeView", "      :tab==='routine'?<RoutineView onBack={()=>navigate('home')}/>\n      :tab==='home'?<HomeView")
a=replace_once(a,'className={`bottom-nav nav-${tab}`}','className={`bottom-nav nav-${tab===\'routine\'?\'home\':tab}`}')
a=replace_once(a,'<main id="main-content">','{snapshot&&!loadError&&!overlay&&tab!==\'routine\'&&<RoutineReminder onOpen={()=>navigate(\'routine\')}/>}<main id="main-content">')
# Avoid marking the Home tab as current when on the routine subpage, but retain its selected style.
a=a.replace("${tab===key?'current':''}","${tab===key||(tab==='routine'&&key==='home')?'current':''}")
s=replace_once(s,'const DB_VERSION = 4;','const DB_VERSION = 5;')
s=replace_once(s,"      if (!db.objectStoreNames.contains('financeEntries')) {","      if (!db.objectStoreNames.contains('routine')) db.createObjectStore('routine');\n      if (!db.objectStoreNames.contains('financeEntries')) {")
v=replace_once(v,"globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']","globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,gif,webp}']")
for target in [root/'src/routine',root/'public/routine']:
 if target.exists(): raise SystemExit('Refusing to overwrite existing '+str(target))
# Preserve an explicit diff; no Git commit or deployment.
for p,c in [(app,a),(storage,s),(vite,v)]: p.write_text(c)
shutil.copytree(base/'src/routine',root/'src/routine');shutil.copytree(base/'public/routine',root/'public/routine')
print('Routine integrated. Run npm install, npm run test, npm run build. Review git diff before committing.')

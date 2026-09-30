import assert from 'node:assert/strict';
import {studyState} from './fixtures.mjs';
import fs from 'node:fs';
import {newState,startTimer,pauseTimer,finishTimer,elapsed,aggregate,dayKey,addDays,sessionParts,validateState,hasActiveSession,contributionRange,heatPalette,contrastRatio} from '../dist/core.mjs';
import {THEME_OPTIONS,getThemeTokens} from '../dist/vendor/themes.mjs';
const base=new Date(2026,8,29,23,59,30).getTime();
const s=studyState(base);startTimer(s,base);pauseTimer(s,base+30000);startTimer(s,base+90000);finishTimer(s,base+120000);
let a=aggregate(s,'2026-09-29','2026-09-30',base+120000);assert.equal(a.total,60000);assert.equal(a.max,30000);assert.equal(a.count,1);
assert.equal(aggregate(s,'2026-09-30','2026-09-30',base+120000).total,30000);
assert.equal(aggregate(s,'2026-09-29','2026-09-29',base+120000).total,30000);
const midnight=studyState(base);startTimer(midnight,base);finishTimer(midnight,base+30000);assert.equal(aggregate(midnight,'2026-09-30','2026-09-30',base+60000).total,0);
const epoch=studyState(0);startTimer(epoch,0);assert.equal(elapsed(epoch,1000),1000);assert.ok(hasActiveSession(epoch));assert.equal(finishTimer(epoch,1000),1000);
const backward=studyState(base);startTimer(backward,base);pauseTimer(backward,base-1000);assert.equal(backward.sessions.length,0);assert.equal(backward.timer.elapsedMs,0);
assert.throws(()=>startTimer({...studyState(),subjects:[]},base));
const badArchived=studyState();badArchived.subjects[0].archived=true;assert.throws(()=>startTimer(badArchived));
for(const now of [new Date(2026,8,30,6).getTime(),new Date(2026,8,30,0,5).getTime(),new Date(2026,8,30,23,59).getTime()]){
 const r=contributionRange(now);const dates=Array.from({length:r.weeks*7},(_,i)=>addDays(r.gridStart,i)).filter(d=>d>=r.first&&d<=r.today);assert.equal(dates.length,90);assert.equal(dayKey(dates.at(-1)),dayKey(now));
}
const clone=()=>structuredClone(s);
for(const change of [v=>v.tasks.push({id:'x',title:'x',done:false,date:'2026-02-30',subjectId:''}),v=>v.sessions.push(v.sessions[0]),v=>v.subjects.push(v.subjects[0]),v=>v.sessions[0].start=1e100,v=>v.sessions[0].durationMs+=1,v=>v.timer.elapsedMs=100,v=>v.sessions[1].subjectId=v.subjects[1].id,v=>v.tasks.push(null)]){const v=clone();change(v);assert.throws(()=>validateState(v));}
const paused=studyState(base);startTimer(paused,base);pauseTimer(paused,base+2000);assert.equal(validateState(paused).timer.elapsedMs,2000);
const prototype=studyState(base);prototype.subjects[0].id='__proto__';prototype.timer.subjectId='__proto__';startTimer(prototype,base);finishTimer(prototype,base+1000);assert.equal(aggregate(prototype,'2026-09-29','2026-09-30',base+1000).subjects['__proto__'],1000);
let contrasts=0;for(const t of THEME_OPTIONS)for(const mode of ['light','dark'])for(const p of heatPalette(getThemeTokens(t.key,mode))){assert.ok(contrastRatio(p.background,p.text)>=4.5,`${t.key}/${mode}`);contrasts++;}
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
const cloud=await import('../dist/cloud.mjs');const pub='sb_publishable_test';cloud.configure('https://testproject.supabase.co',pub);assert.equal(cloud.getConfig().url,'https://testproject.supabase.co');
const token=role=>btoa('{}')+'.'+btoa(JSON.stringify({role}))+'.sig';cloud.configure('https://testproject.supabase.co',token('anon'));
for(const [url,key] of [['http://testproject.supabase.co',pub],['https://user@testproject.supabase.co',pub],['https://testproject.supabase.co:8443',pub],['https://attacker.com',pub],['https://testproject.supabase.co','sb_secret_test'],['https://testproject.supabase.co',token('service_role')],['https://testproject.supabase.co',token('authenticated')],['https://testproject.supabase.co','malformed']])assert.throws(()=>cloud.configure(url,key));
const source=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.ok(!/rel=["'](?:shortcut )?icon/.test(source));
console.log(`PASS: interrupted-focus duration, midnight boundaries, epoch/backward clock, archived subjects, exact 90 days, malformed/duplicate imports, prototype-safe totals, ${contrasts} calendar contrast pairs, Supabase configuration boundaries, and no favicon.`);

import assert from 'node:assert/strict';
import {boot,subjectState,locks} from './ui-harness.mjs';
import {newState,startTimer,finishTimer,aggregate,validateState,serializeBackup,parseBackup,sessionParts,addDays,dayKey,streak} from '../dist/core.mjs';
const KEY='sela.study.v1',now=Date.UTC(2026,8,30,12);
const task={id:'other-tab-record',title:'Preserve this record',date:'2026-09-30',done:false,subjectId:'math'};
// A corrupt-state confirmation cannot overwrite a repaired snapshot, even if
// its storage event is delayed or arrives before the confirmation is accepted.
for(const active of [false,true])for(const deliverEvent of [false,true]){
 let raw='{broken';const storage={getItem:key=>key===KEY?raw:null,setItem:(key,value)=>{if(key===KEY)raw=value;}};
 const app=boot(raw,{now,storage,lock:locks()});
 await app.api.handleAction({dataset:{action:'recover-local'}});
 const repaired=subjectState(now);repaired.tasks.push(task);if(active)repaired.timer.startedAt=now-1000;
 raw=JSON.stringify(validateState(repaired));const expected=raw;
 if(deliverEvent)app.windowEvents.storage({key:KEY});
 await app.modal.form.handler({preventDefault(){}});
 assert.equal(raw,expected);assert.equal(app.downloads.length,0);assert.ok(app.error.textContent);
}
// Unchanged corrupt data can still be backed up and replaced intentionally.
{
 const app=boot('{broken',{now});await app.api.handleAction({dataset:{action:'recover-local'}});
 await app.modal.form.handler({preventDefault(){}});
 assert.equal(await app.downloads[0].text(),'{broken');assert.equal(JSON.parse(app.map.get(KEY)).version,2);
}
const importFile=(app,promise)=>app.events.change({target:{id:'import-file',dataset:{},value:'fixture.json',files:[{size:1000,text:()=>promise}]}});
// A slow read preserves a new draft and explicit navigation.
for(const openDraft of [false,true]){
 const app=boot(subjectState(now),{now});await app.api.handleAction({dataset:{action:'nav',view:'settings'}});
 let resolve;const pending=importFile(app,new Promise(done=>resolve=done));
 await app.api.handleAction({dataset:{action:'nav',view:'study'}});if(openDraft)app.api.editTask();
 const html=app.modal.innerHTML;resolve(JSON.stringify(newState(now)));await pending;
 assert.equal(app.modal.innerHTML,html);assert.equal(app.modal.open,openDraft);
}
// Newest file wins when reads resolve in reverse order; its normal submit works.
{
 const app=boot(subjectState(now),{now});let first,second;
 const a=importFile(app,new Promise(done=>first=done));const b=importFile(app,new Promise(done=>second=done));
 const newest=subjectState(now);newest.tasks.push(task);
 second(JSON.stringify(newest));await b;const confirmation=app.modal.innerHTML;
 first(JSON.stringify(newState(now)));await a;assert.equal(app.modal.innerHTML,confirmation);
 await app.modal.form.handler({preventDefault(){}});assert.equal(app.api.getState().tasks[0].id,task.id);
}
// No 366-day discontinuity: one uninterrupted focus remains one record.
for(const age of [366*86400000-1,366*86400000,366*86400000+1,367*86400000]){
 const state=subjectState(now);startTimer(state,now-age);validateState(state);
 const original=JSON.stringify(state),copy=parseBackup(serializeBackup(state,now));
 assert.equal(copy.sessions.length,1);assert.equal(copy.sessions[0].durationMs,age);assert.equal(JSON.stringify(state),original);
 assert.equal(finishTimer(state,now),age);validateState(state);
 const total=aggregate(state,'2025-01-01','2026-09-30',now);assert.equal(total.total,age);assert.equal(total.max,age);
}
const previousTZ=process.env.TZ;
try{
 // Explicit historical dates exercise the whole streak boundary, including
 // epoch-zero activity whose local calendar date precedes 1970 in the west.
 for(const zone of ['UTC','America/Los_Angeles','Asia/Singapore']){
  process.env.TZ=zone;
  const historicalNow=+new Date('1999-09-23T12:00:00');
  for(const [dates,expected] of [
   [['1999-09-23'],1],
   [['1999-09-21','1999-09-22','1999-09-23'],3],
   [['1999-09-21','1999-09-22'],2],
   [['1999-09-20','1999-09-22','1999-09-23'],2],
   [['1999-09-20'],0],
   [[],0]
  ]){
   const historical=subjectState(historicalNow);
   historical.sessions=dates.map((date,i)=>{const start=+new Date(date+'T10:00:00');return {id:'historical-'+i,runId:'historical-'+i,subjectId:'math',start,end:start+3600000,durationMs:3600000};});
   validateState(historical);assert.equal(streak(historical,historicalNow),expected,`${zone}: ${dates}`);
   const app=boot(historical,{now:historicalNow});
   assert.equal(app.app.querySelector('[data-live="streak"]').textContent,app.api.t('summary.streak',{count:expected}));
  }
  const epoch=subjectState(3600000);
  epoch.sessions=[{id:'epoch',runId:'epoch',subjectId:'math',start:0,end:3600000,durationMs:3600000}];
  validateState(epoch);assert.equal(streak(epoch,3600000),1,`${zone}: epoch-zero study`);
  const centuryNow=+new Date('2000-01-01T12:00:00'),century=subjectState(centuryNow);
  century.sessions=['1999-12-30','1999-12-31','2000-01-01'].map((date,i)=>{const start=+new Date(date+'T10:00:00');return {id:'century-'+i,runId:'century-'+i,subjectId:'math',start,end:start+3600000,durationMs:3600000};});
  validateState(century);assert.equal(streak(century,centuryNow),3,`${zone}: streak crosses 2000`);
  const current=subjectState(now);
  current.sessions=[{id:'current',runId:'current',subjectId:'math',start:now-3600000,end:now,durationMs:3600000}];
  validateState(current);assert.equal(streak(current,now),1,`${zone}: current-day streak`);
 }
 process.env.TZ='America/Santiago';
 const start=Date.parse('2026-09-06T23:30:00-03:00'),end=Date.parse('2026-09-07T00:30:00-03:00');
 const state=subjectState(end);state.sessions=[{id:'dst',runId:'dst',subjectId:'math',start,end,durationMs:end-start}];validateState(state);
 assert.deepEqual(sessionParts(state.sessions[0]).map(part=>[part.date,part.ms]),[['2026-09-06',1800000],['2026-09-07',1800000]]);
 assert.equal(aggregate(state,'2026-09-06','2026-09-06',end).total,1800000);
 assert.equal(aggregate(state,'2026-09-07','2026-09-07',end).total,1800000);
 const app=boot(state,{now:end});await app.api.handleAction({dataset:{action:'nav',view:'stats'}});await app.api.handleAction({dataset:{action:'period',value:'day'}});await app.api.handleAction({dataset:{action:'period-prev'}});
 assert.match(app.app.innerHTML,/<td class="mono" title="[^"]*01:00:00">00:30:00<\/td>/);
 process.env.TZ='Pacific/Apia';assert.equal(dayKey(addDays(new Date('2011-12-31T00:00:00+14:00'),-1)),'2011-12-29');
 process.env.TZ='UTC';
 for(const end of [Date.parse('+010000-01-02T01:00:00Z'),8640000000000000]){
  const parts=sessionParts({id:'extended',runId:'extended',subjectId:'math',start:end-3600000,end});
  assert.equal(parts.reduce((sum,part)=>sum+part.ms,0),3600000);assert.ok(parts.every(part=>Number.isFinite(part.ms)));
 }
}finally{if(previousTZ===undefined)delete process.env.TZ;else process.env.TZ=previousTZ;}
console.log('PASS: stale recovery preserves repaired/active records with delayed or delivered events; imports retain newer drafts/selections; long timers finish/export; historical/epoch/current streaks agree with explicit day counts; midnight DST conserves daily/history totals; skipped-date iteration and extended-year endpoints remain finite.');

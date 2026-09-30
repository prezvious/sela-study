import assert from 'node:assert/strict';
import fs from 'node:fs';
import {actual,boot,subjectState,locks} from './ui-harness.mjs';
const now=new Date(2026,8,30,10).getTime(),task=id=>({id,title:id,date:'2026-09-30',done:false,subjectId:'math'});
const nav=(h,view)=>h.api.handleAction({dataset:{action:'nav',view}});
let assertions=0;const check=(value)=>{assert.ok(value);assertions++;};
// T001: limit is enforced by the real form and generic writes remain valid.
{
 const s=subjectState(now);s.tasks=Array.from({length:20000},(_,i)=>({...task('old-'+i),date:'2026-01-01'}));
 const h=boot(s,{now});h.api.editTask();const form=h.modal.form;form.fd={get:k=>({title:'New',date:'2026-09-30',subjectId:'math'})[k]};await form.handler({preventDefault(){}});
 check(h.error.textContent.includes('20.000'));check(h.modal.open);assert.equal(JSON.parse(h.map.get('sela.study.v1')).tasks.length,20000);
 await assert.rejects(h.api.mutate(s=>s.tasks.push(task('overflow'))));actual.restoreLocalState(h.map.get('sela.study.v1'));
 h.api.editTask('old-0');h.modal.form.fd={get:k=>({title:'Edited',date:'2026-01-01',subjectId:'math'})[k]};await h.modal.form.handler({preventDefault(){}});assert.equal(h.api.getState().tasks[0].title,'Edited');
 await h.api.mutate(s=>s.tasks.pop());h.api.editTask();const f=h.modal.form;f.fd=form.fd;await Promise.all([f.handler({preventDefault(){}}),f.handler({preventDefault(){}})]);assert.equal(h.api.getState().tasks.length,20000);
}
// T003: both tab operations enter the original code before either write, then serialize.
{
 const map=new Map([['sela.study.v1',JSON.stringify(subjectState(now))]]),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},lock=locks();
 const a=boot(subjectState(now),{now,storage,lock}),b=boot(subjectState(now),{now,storage,lock});
 await Promise.all([a.api.mutate(s=>s.tasks.push(task('tab-A'))),b.api.mutate(s=>s.tasks.push(task('tab-B')))]);
 assert.deepEqual(JSON.parse(map.get('sela.study.v1')).tasks.map(x=>x.id),['tab-A','tab-B']);
 // An older queued storage event must read the latest snapshot instead of reverting it.
 a.windowEvents.storage({key:'sela.study.v1',newValue:JSON.stringify(subjectState(now))});assert.equal(a.api.getState().tasks.length,2);
 await assert.rejects(a.api.mutate(s=>s.tasks.push({...task('invalid'),date:'2026-02-30'})));
 await b.api.mutate(s=>s.tasks.push(task('after-error')));assert.equal(JSON.parse(map.get('sela.study.v1')).tasks.length,3);
 // A subject change/archival checked before acquiring the lock must still respect a new active timer.
 await b.api.handleAction({dataset:{action:'toggle-timer',running:'false'}});
 await assert.rejects(a.api.handleAction({dataset:{action:'choose-subject',id:'math'}}),/Selesaikan/);
 await a.api.handleAction({dataset:{action:'toggle-timer',running:'false'}});check(a.api.getState().timer.startedAt!==null);
}
// T004: live dashboard updates cannot mutate the historical modal.
{
 const s=subjectState(now),start=new Date(2026,8,29,10).getTime();s.sessions=[{id:'yesterday',runId:'yesterday',subjectId:'math',start,end:start+3600000,durationMs:3600000}];
 const h=boot(s,{now});h.api.showDay('2026-09-29');h.tick();assert.equal(h.modal.nodes.find(n=>n.kind==='subject-time').textContent,'1j 0m');
 await h.api.handleAction({dataset:{action:'toggle-timer',running:'false'}});h.advance(65000);h.tick();assert.equal(h.app.nodes.find(n=>n.kind==='subject-time').textContent,'1m');assert.equal(h.modal.nodes.find(n=>n.kind==='subject-time').textContent,'1j 0m');
}
// T005: midnight moves today, enables the new date, and keeps an open modal intact.
for(const view of ['study','calendar','stats'])for(const open of [false,true]){
 const edge=new Date(2026,8,30,23,59,59).getTime(),h=boot(subjectState(edge),{now:edge});await nav(h,view);if(open)h.api.showDay('2026-09-30');
 h.advance(2000);h.tick();assert.equal(h.api.getTaskDate(),'2026-10-01');if(view!=='stats'){const cells=h.app.querySelectorAll('.heat-cell.today');assert.equal(cells.length,1);assert.equal(cells[0].key,'2026-10-01');assert.equal(cells[0].disabled,false);check(cells[0].attrs['aria-label'].startsWith('1 Oktober'));}
 assert.equal(h.modal.open,open);if(open)check(h.modal.innerHTML.includes('30 September 2026'));
}
{
 const edge=new Date(2026,8,30,23,59,59).getTime(),h=boot(subjectState(edge),{now:edge});await h.events.change({target:{id:'task-date',value:'2026-09-28',dataset:{}}});h.advance(2000);h.tick();assert.equal(h.api.getTaskDate(),'2026-09-28');
}
// T006: week day, footer and accessible label agree; selected past periods stay at zero.
for(const mode of ['week','month']){
 const h=boot(subjectState(now),{now});await h.api.handleAction({dataset:{action:'toggle-timer',running:'false'}});await nav(h,'calendar');await h.api.handleAction({dataset:{action:'heat-mode',value:mode}});h.advance(65000);h.tick();
 check(h.app.querySelectorAll('.heat-cell.today')[0].attrs['aria-label'].includes('00:01:05'));check(h.app.querySelector('[data-live="heat-total"]').textContent.startsWith('1m'));
 if(mode==='week')assert.equal(h.app.nodes.find(n=>n.kind==='heat-day'&&n.key==='2026-09-30').textContent,'1m');
 await h.api.handleAction({dataset:{action:'heat-prev'}});h.advance(65000);h.tick();check(h.app.querySelector('[data-live="heat-total"]').textContent.startsWith('0m'));
}
// T008: success and failure after navigation are shown as auth results, never a null-DOM error.
for(const outcome of ['success','failure']){
 let resolve,reject;const pending=new Promise((r,j)=>{resolve=r;reject=j;});const h=boot(subjectState(now),{now,cloud:{getConfig:()=>({url:'https://example.supabase.co'}),authenticate:()=>pending}});
 await nav(h,'settings');const form=h.authForm();form.fd={get:k=>({email:'audit@example.invalid',password:'test-password'})[k]};
 const submit=h.events.submit({preventDefault(){},target:form,submitter:{value:'login'}});await nav(h,'study');
 if(outcome==='success')resolve('Terhubung sebagai audit@example.invalid.');else reject({key:'error.authCredentials'});await submit;
 assert.equal(h.toast.textContent,outcome==='success'?'Terhubung sebagai audit@example.invalid.':'Email atau kata sandi salah.');assert.equal(form.password.value,'');assert.equal(form.buttons[0].disabled,false);await nav(h,'settings');check(h.app.innerHTML.includes(h.toast.textContent));
}
// Recovery remains possible; replacing data rechecks an active session inside the lock.
{
 const h=boot('{broken',{now});await h.api.replaceData(subjectState(now));assert.equal(h.api.getState().subjects.length,1);assert.equal(await h.downloads[0].text(),'{broken');
 await h.api.handleAction({dataset:{action:'toggle-timer',running:'false'}});await assert.rejects(h.api.replaceData(actual.newState(now)),/Selesaikan/);assert.equal(h.api.getState().subjects.length,1);
}
// Quota failures retain unsaved notes and do not silently overwrite another tab's later changes.
{
 let raw=JSON.stringify(subjectState(now)),fail=true;const storage={getItem:()=>raw,setItem:(k,v)=>{if(fail)throw Error('quota');raw=v;}};
 const h=boot(subjectState(now),{now,storage});await h.api.mutate(s=>s.tasks.push(task('unsaved')));assert.equal(h.api.getState().tasks.length,1);
 const other=subjectState(now);other.tasks.push(task('other-tab'));raw=JSON.stringify(other);h.windowEvents.storage({key:'sela.study.v1',newValue:raw});assert.equal(h.api.getState().tasks[0].id,'unsaved');fail=false;
 await nav(h,'settings');check(h.app.innerHTML.includes('Catatan sementara · ekspor JSON untuk menyimpan'));
 await h.api.handleAction({dataset:{action:'export'}});assert.equal(JSON.parse(await h.downloads[0].text()).tasks[0].id,'unsaved');
 await assert.rejects(h.api.mutate(s=>s.tasks.push(task('new'))),/Tab lain/);assert.equal(JSON.parse(raw).tasks[0].id,'other-tab');
}
// T009: guide describes existing cloud actions.
const guide=fs.readFileSync(new URL('../dist/locales/id-ID.mjs',import.meta.url),'utf8');check(!guide.includes('Gunakan data saya'));check(guide.includes('Simpan ke cloud'));check(guide.includes('Ambil dari cloud'));
console.log('PASS: task boundary, validated writes, serialized tab edits, stale storage events, modal date isolation, midnight in 3 views with/without modal, manual dates, live week/month totals, auth navigation success/error, import recovery, quota conflicts, and current guide.');

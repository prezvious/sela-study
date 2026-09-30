import assert from 'node:assert/strict';
import {boot,subjectState} from './ui-harness.mjs';
const now=new Date(2026,8,30,10).getTime(),nav=(h,view)=>h.api.handleAction({dataset:{action:'nav',view}}),deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const field=(h,form,name)=>h.app.querySelector('#'+form+' [name="'+name+'"]');
// Same-view re-renders preserve only unsaved edits; clean fields follow new stored values.
{
 const h=boot(subjectState(now),{now});await nav(h,'settings');
 field(h,'goal-form','goal').value='20';field(h,'cloud-config','url').value='https://draft.supabase.co';h.document.activeElement=field(h,'cloud-config','url');
 await h.api.mutate(s=>s.settings.theme='dark');
 assert.equal(field(h,'goal-form','goal').value,'20');assert.equal(field(h,'cloud-config','url').value,'https://draft.supabase.co');assert.equal(h.document.activeElement,field(h,'cloud-config','url'));
 await nav(h,'study');await nav(h,'settings');assert.equal(field(h,'goal-form','goal').value,'240');assert.equal(field(h,'cloud-config','url').value,'');
 await h.api.mutate(s=>s.settings.goal=17);assert.equal(field(h,'goal-form','goal').value,'17');assert.ok(h.app.innerHTML.includes('Target hari ini · 17m'));assert.ok(h.app.innerHTML.includes('step="1"'));
 const form={id:'goal-form',fd:{get:()=>20}};await h.events.submit({target:form,preventDefault(){}});assert.equal(h.api.getState().settings.goal,20);
}
// Password drafts survive unrelated updates only within the current settings view.
{
 const h=boot(subjectState(now),{now,cloud:{getConfig:()=>({url:'https://one.supabase.co'})}});await nav(h,'settings');field(h,'cloud-auth','password').value='draft-only';await h.api.mutate(s=>s.settings.theme='dark');assert.equal(field(h,'cloud-auth','password').value,'draft-only');assert.ok(!h.map.get('sela.study.v1').includes('draft-only'));await nav(h,'study');await nav(h,'settings');assert.equal(field(h,'cloud-auth','password').value,'');
}
// A late read cannot replace a new dialog, even after navigating back to Settings.
for(const action of ['cloud-load','cloud-save']){
 const d=deferred();let reads=0;const h=boot(subjectState(now),{now,cloud:{getConfig:()=>({url:'https://one.supabase.co'}),load:()=>{reads++;return d.promise;}}});await nav(h,'settings');const op=h.api.handleAction({dataset:{action}});
 await assert.rejects(h.api.handleAction({dataset:{action}}),/Tunggu/);assert.equal(reads,1);
 await nav(h,'study');await nav(h,'settings');h.api.editTask();const original=h.modal.innerHTML;
 d.resolve({data:subjectState(now),revision:1,context:{project:'https://one.supabase.co',userId:'A'}});await op;assert.equal(h.modal.innerHTML,original);assert.ok(h.toast.textContent.includes('dibatalkan'));
}
// Save captures the current local backup at confirmation, and includes the read context.
{
 let saved;const remote={data:null,revision:0,context:{project:'https://one.supabase.co',userId:'A'}};
 const h=boot(subjectState(now),{now,cloud:{getConfig:()=>({url:remote.context.project}),load:async()=>remote,save:async(...args)=>{saved=args;}}});await nav(h,'settings');await h.api.handleAction({dataset:{action:'cloud-save'}});
 await h.api.mutate(s=>s.tasks.push({id:'late',title:'After read',date:'2026-09-30',subjectId:'math',done:false}));h.modal.form.fd={};await h.modal.form.handler({preventDefault(){}});
 assert.equal(saved[0].tasks[0].id,'late');assert.equal(saved[1],0);assert.deepEqual(saved[2],remote.context);assert.equal(h.modal.open,false);
}
// A cloud failure clears busy state so the user can retry; import preserves local records on context failure.
{
 let fail=true;const h=boot(subjectState(now),{now,cloud:{getConfig:()=>({url:'https://one.supabase.co'}),load:async()=>{if(fail)throw Error('offline');return {data:subjectState(now),revision:1,context:{userId:'A'}};},checkContext:async()=>{throw {key:'error.accountChanged'};}}});await nav(h,'settings');await assert.rejects(h.api.handleAction({dataset:{action:'cloud-load'}}),/offline/);fail=false;await h.api.handleAction({dataset:{action:'cloud-load'}});h.modal.form.fd={};await h.modal.form.handler({preventDefault(){}});assert.ok(h.error.textContent.includes('Akun atau proyek'));assert.equal(h.downloads.length,0);assert.equal(h.modal.open,true);
}
console.log('PASS: unsaved settings and focus, clean values, integer goals, password lifetime, stale/duplicate cloud reads, current save snapshot, pinned context, and error recovery.');

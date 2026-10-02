import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {boot,subjectState,locks} from './ui-harness.mjs';
import * as core from '../dist/core.mjs';
import * as i18n from '../dist/i18n.mjs';
import {documentOf,workspaceKey,readWorkspace} from '../dist/sync.mjs';

if(process.argv.includes('--zone-child')){
 const zone=process.env.TZ;
 i18n.setLocale('en-GB',{persist:false});
 if(zone==='America/Santiago'){
  const now=+new Date('2026-09-06T12:00:00-03:00'),state=subjectState(now),start=+new Date('2026-08-31T00:00:00-04:00');
  state.sessions=[{id:'one',runId:'one',subjectId:'math',start,end:start+1800000,durationMs:1800000}];
  assert.equal(i18n.localeWeekStart(now).getHours(),0);
  const h=boot(state,{now});h.api.setLocale('en-GB');await h.api.handleAction({dataset:{action:'nav',view:'stats'}});
  assert.ok(h.app.innerHTML.includes('00:30:00'));assert.ok(!h.app.innerHTML.includes('<td colspan="5" class="empty">'));
  assert.ok(h.app.innerHTML.includes('00:00'));
 }else{
  const state=subjectState(Date.now());state.tasks=[{id:'civil-date',title:'Historical task',date:'2011-12-30',subjectId:'',done:false}];
  assert.equal(core.validateState(state).tasks[0].date,'2011-12-30');
  assert.equal(i18n.parseDateInput('30/12/2011'),'2011-12-30');
  assert.equal(i18n.formatDateInput('2011-12-30'),'30/12/2011');
  assert.throws(()=>i18n.parseDateInput('29/02/2011'));
  assert.throws(()=>core.validateState({...state,tasks:[{...state.tasks[0],date:'2011-02-29'}]}));
  const h=boot(state);h.api.setLocale('en-GB');
  await h.events.change({target:{id:'task-date',dataset:{},value:'30/12/2011'}});
  assert.ok(h.app.innerHTML.includes('30 Dec'));assert.equal(h.api.getState().tasks[0].date,'2011-12-30');
 }
 console.log('PASS: confirmed date/history regressions in '+zone);
}else{
 const now=Date.now(),source=subjectState(now);
 source.tasks=[{id:'one',title:'Old title',date:'2026-10-03',subjectId:'math',done:false}];
 const map=new Map([['sela.study.v1',JSON.stringify(source)]]),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)},lock=locks();
 const a=boot(source,{now,storage,lock}),b=boot(source,{now,storage,lock});
 a.api.editTask('one');const draft=a.modal.form;draft.fd={get:key=>({title:'Old title',date:'2026-10-04',subjectId:'math'})[key]};
 await b.api.mutate(state=>state.tasks[0].title='Updated in tab B');a.windowEvents.storage({key:'sela.study.v1'});
 await draft.handler({preventDefault(){}});
 assert.equal(JSON.parse(map.get('sela.study.v1')).tasks[0].title,'Updated in tab B');
 assert.equal(JSON.parse(map.get('sela.study.v1')).tasks[0].date,'2026-10-04');

 a.api.editTask('one');const conflicting=a.modal.form;conflicting.fd={get:key=>({title:'Changed in A',date:'2026-10-04',subjectId:'math'})[key]};
 await b.api.mutate(state=>state.tasks[0].title='Changed in B');
 await conflicting.handler({preventDefault(){}});
 assert.ok(a.modal.open);assert.equal(JSON.parse(map.get('sela.study.v1')).tasks[0].title,'Changed in B');
 assert.ok(a.error.textContent);

 a.api.editSubject('math');const subjectDraft=a.modal.form;subjectDraft.fd={get:key=>({name:'Math',color:'#123456'})[key]};
 await b.api.mutate(state=>state.subjects[0].name='Renamed in B');a.windowEvents.storage({key:'sela.study.v1'});
 await subjectDraft.handler({preventDefault(){}});
 assert.equal(JSON.parse(map.get('sela.study.v1')).subjects[0].name,'Renamed in B');
 assert.equal(JSON.parse(map.get('sela.study.v1')).subjects[0].color,'#123456');

 a.api.editTask('one');const deleted=a.modal.form;deleted.fd={get:key=>({title:'Changed in B',date:'2026-10-05',subjectId:'math'})[key]};
 await b.api.mutate(state=>state.tasks=[]);await deleted.handler({preventDefault(){}});
 assert.ok(a.modal.open);assert.equal(JSON.parse(map.get('sela.study.v1')).tasks.length,0);

 const independent=subjectState(now);independent.tasks=[{id:'independent',title:'No subject',date:'2026-10-03',subjectId:'',done:false}];
 const independentUI=boot(independent,{now});independentUI.api.editTask('independent');
 assert.ok(!independentUI.modal.innerHTML.includes('<option value="math" selected>'));

 const upper=subjectState(now);upper.subjects[0].color='#ABCDEF';
 const upperMap=new Map([['sela.study.v1',JSON.stringify(upper)]]),upperStorage={getItem:key=>upperMap.get(key)||null,setItem:(key,value)=>upperMap.set(key,value)},upperLock=locks();
 const colorA=boot(upper,{now,storage:upperStorage,lock:upperLock}),colorB=boot(upper,{now,storage:upperStorage,lock:upperLock});
 colorA.api.editSubject('math');const colorDraft=colorA.modal.form;colorDraft.fd={get:key=>({name:'New name',color:'#abcdef'})[key]};
 await colorB.api.mutate(state=>state.subjects[0].color='#654321');await colorDraft.handler({preventDefault(){}});
 assert.equal(JSON.parse(upperMap.get('sela.study.v1')).subjects[0].color,'#654321');
 assert.equal(JSON.parse(upperMap.get('sela.study.v1')).subjects[0].name,'New name');

 // Metadata corruption must offer a repair that backs up raw bytes and keeps a live timer.
 {
  const project='https://fixture.supabase.co',user={id:'A',email:'alice@example.invalid'},key=workspaceKey(project,user.id),account=subjectState(now);
  account.tasks=[{id:'keep',title:'Preserved task',date:'2026-10-03',subjectId:'math',done:false}];core.startTimer(account,now-1000);
  const doc=documentOf(account,'en-GB'),raw=JSON.stringify({...doc,_sync:{revision:-1,base:null}}),cache=new Map([['sela.study.v1',JSON.stringify(subjectState(now))],[key,raw]]);
  let row=null;const cloud={getConfig:()=>({url:project}),watchAuth(){},assertCurrentContext(){},load:async()=>({...row||{data:null,revision:0},context:{project,userId:user.id}}),save:async(data,revision)=>{row={data:structuredClone(data),revision:revision+1};return row.revision;}};
  const h=boot(subjectState(now),{now,storage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)},cloud});
  await h.api.getSync().attach(user,project);
  assert.ok(h.app.innerHTML.includes('data-action="repair-account-cache"'));assert.ok(h.app.innerHTML.includes('data-action="recover-local"'));
  await assert.rejects(h.api.mutate(state=>state.settings.goal=30),error=>error.key==='error.recoveryFirst');assert.equal(cache.get(key),raw);
  await h.api.handleAction({dataset:{action:'repair-account-cache'}});
  assert.equal(await h.downloads[0].text(),raw);assert.equal(readWorkspace({getItem:key=>cache.get(key)},key).revision,1);
  assert.equal(h.api.getState().tasks[0].id,'keep');assert.equal(h.api.getState().timer.startedAt,now-1000);
  assert.equal(row.data.tasks[0].id,'keep');assert.equal(row.data.timer.startedAt,now-1000);
  assert.ok(!h.app.innerHTML.includes('data-action="repair-account-cache"'));

  // A repaired or edited cache in another tab must defeat a stale repair action.
  cache.set(key,raw);h.windowEvents.storage({key});assert.ok(h.app.innerHTML.includes('data-action="repair-account-cache"'));
  const newer=JSON.stringify({...doc,_sync:{revision:1,base:doc}});cache.set(key,newer);
  await assert.rejects(h.api.handleAction({dataset:{action:'repair-account-cache'}}),error=>error.key==='error.tabConflict');
  assert.equal(cache.get(key),newer);assert.equal(h.downloads.length,1);h.api.getSync().dispose();
 }

 const c=boot(subjectState(now),{now});await c.api.handleAction({dataset:{action:'toggle-timer',running:'false'}});
 await c.api.handleAction({dataset:{action:'nav',view:'subjects'}});c.advance(120000);c.tick();
 assert.equal(c.app.querySelector('[data-subject-lifetime="math"]').textContent,c.api.t('subjects.total',{duration:'2m'}));

 i18n.setLocale('en-GB',{persist:false});let html='';const guide={addEventListener(){},set innerHTML(value){html=value;}};
 const guideUrl='https://example.invalid/sela/panduan-supabase.html';
 vm.runInNewContext(fs.readFileSync(new URL('../dist/guide.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),{...i18n,esc:core.esc,URL,location:{href:guideUrl},document:{querySelector:()=>guide},applyDocumentLocale(){},applySavedAppearance(){},observeSavedAppearance(){}});
 assert.equal(new URL(html.match(/<header[^>]*><a href="([^"]+)"/)[1],guideUrl).href,'https://example.invalid/sela/');

 for(const zone of ['UTC','Pacific/Apia','America/Santiago']){
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--zone-child'],{encoding:'utf8',timeout:15000,env:{...process.env,TZ:zone}});
  assert.equal(result.status,0,result.stdout+result.stderr);process.stdout.write(result.stdout);
 }
 console.log('PASS: stale task/subject field merging, conflicting/deleted records, independent tasks, account-metadata recovery/raw backup/live timer/stale repair, live guest subject totals and guide subpaths.');
}

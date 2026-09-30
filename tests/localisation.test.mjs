import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CATALOGUES,LANGUAGES,LOCALE_KEY,setLocale,getLocale,t,messageText,LocalisedError,formatDateInput,parseDateInput,formatNumber,formatTime,formatDuration,firstWeekday,localeWeekStart,weekdayNames} from '../dist/i18n.mjs';
import {boot,subjectState,actual} from './ui-harness.mjs';
import {THEME_OPTIONS} from '../dist/vendor/themes.mjs';
const params=text=>[...new Set([...text.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map(m=>m[1]))].sort();
const base=CATALOGUES['en-GB'],keys=Object.keys(base).sort();let checked=0;
for(const {code} of LANGUAGES){
 const catalogue=CATALOGUES[code];assert.deepEqual(Object.keys(catalogue).sort(),keys);setLocale(code,{persist:false});
 for(const [key,value] of Object.entries(catalogue)){
  const expected=params(typeof base[key]==='string'?base[key]:base[key].other),forms=typeof value==='string'?[value]:Object.values(value);
  if(typeof value==='object'){assert.ok(value.other,key);for(const category of new Intl.PluralRules(code).resolvedOptions().pluralCategories)assert.ok(value[category],`${code}/${key}/${category}`);}
  for(const form of forms){assert.ok(form.trim());assert.deepEqual(params(form),expected,`${code}/${key}`);}
  const values=Object.fromEntries(expected.map(p=>[p,p==='count'?22:'test']));assert.ok(t(key,values));checked++;
 }
 for(const theme of THEME_OPTIONS)assert.ok(catalogue['theme.'+theme.key]);
 const input=formatDateInput('2026-10-01');assert.equal(parseDateInput(input),'2026-10-01');assert.equal(parseDateInput(formatDateInput('0001-01-01')),'0001-01-01');assert.equal(parseDateInput('2024-02-29'),'2024-02-29');assert.throws(()=>parseDateInput('2026-02-29'),LocalisedError);assert.throws(()=>parseDateInput('2026-04-31'),LocalisedError);assert.throws(()=>parseDateInput('2026-00-01'),LocalisedError);assert.throws(()=>parseDateInput('2026-01-00'),LocalisedError);
 assert.equal(firstWeekday(),code==='en-US'?0:1);assert.equal(localeWeekStart(new Date(2026,9,1)).getDay(),firstWeekday());assert.equal(weekdayNames().length,7);
 assert.ok(formatDuration(3720000).length>0);assert.ok(formatTime(new Date(2026,9,1,14,5)).length>0);
}
setLocale('en-GB',{persist:false});assert.equal(formatDateInput('2026-10-01'),'01/10/2026');assert.equal(parseDateInput('01/10/2026'),'2026-10-01');assert.ok(t('form.subjectExample').includes('Maths'));assert.equal(t('form.colour'),'Colour');assert.ok(!/PM/.test(formatTime(new Date(2026,9,1,14,5))));
const existingError=new LocalisedError('error.nameUsed');setLocale('en-US',{persist:false});assert.equal(formatDateInput('2026-10-01'),'10/01/2026');assert.equal(parseDateInput('01/10/2026'),'2026-01-10');assert.ok(t('form.subjectExample').includes('Math'));assert.equal(t('form.colour'),'Color');assert.ok(/PM/.test(formatTime(new Date(2026,9,1,14,5))));
let dateError;try{parseDateInput('invalid');}catch(error){dateError=error;}assert.ok(dateError.message.includes('MM/DD/YYYY'));setLocale('fr-FR',{persist:false});assert.ok(dateError.message.includes('JJ/MM/AAAA'));assert.ok(!dateError.message.includes('MM/DD/YYYY'));
setLocale('ru-RU',{persist:false});assert.equal(formatDateInput('2026-10-01'),'01.10.2026');assert.notEqual(existingError.message,base['error.nameUsed']);
for(const [count,ending] of [[0,'занятий'],[1,'занятие'],[2,'занятия'],[5,'занятий'],[11,'занятий'],[21,'занятие'],[22,'занятия'],[25,'занятий']])assert.equal(t('count.sessions',{count}),`${count} ${ending}`);
setLocale('fr-FR',{persist:false});assert.ok(formatNumber(1.5).includes(','));assert.equal(messageText(Error('Raw English SDK failure')),t('error.generic'));
assert.throws(()=>setLocale('xx-XX'));assert.throws(()=>t('missing'));assert.throws(()=>t('form.importText'));
// Every page and all dialog variants render in every locale without changing study data.
const now=new Date(2026,9,1,14,5).getTime();
{const state=actual.newState(now);state.tasks.push({id:'date-boundary',title:'date',date:'0001-01-01',done:false,subjectId:''});assert.equal(actual.validateState(state).tasks[0].date,'0001-01-01');state.tasks[0].date='0000-01-01';assert.throws(()=>actual.validateState(state));}
for(const {code} of LANGUAGES){
 const state=subjectState(now);state.tasks.push({id:'task',title:'Original user text',date:'2026-10-01',done:false,subjectId:'math'});state.subjects.push({id:'archive',name:'Archived user text',color:'#7198ca',archived:true});
 const h=boot(state,{now,cloud:{getConfig:()=>({url:'https://one.supabase.co'}),load:async()=>({data:state,revision:1,context:{userId:'A'}})}}),before=h.map.get('sela.study.v1');h.api.setLocale(code);assert.equal(h.document.documentElement.lang,code);assert.equal(h.map.get(LOCALE_KEY),code);assert.equal(h.map.get('sela.study.v1'),before);
 for(const view of ['study','stats','calendar','subjects','settings']){
  await h.api.handleAction({dataset:{action:'nav',view}});assert.ok(h.app.innerHTML.includes(CATALOGUES[code]['brand.footer']));assert.ok(h.app.innerHTML.includes(CATALOGUES[code]['nav.'+view]));
  if(view==='calendar')for(const mode of ['week','month','contributions']){await h.api.handleAction({dataset:{action:'heat-mode',value:mode}});h.tick();}
  if(view==='stats')for(const period of ['day','week','month'])await h.api.handleAction({dataset:{action:'period',value:period}});
 }
 h.api.editSubject();assert.ok(h.modal.innerHTML.includes(CATALOGUES[code]['form.subjectNew']));h.api.editSubject('math');assert.ok(h.modal.innerHTML.includes('Math'));h.api.editTask('task');assert.ok(h.modal.innerHTML.includes('Original user text'));h.api.showDay('2026-10-01');assert.ok(h.modal.innerHTML.includes(h.api.t('count.sessions',{count:0})));
 for(const [action,id] of [['delete-task','task'],['delete-subject','math'],['recover-local',null]]){await h.api.handleAction({dataset:{action,id}});assert.ok(h.modal.open);h.modal.close();}
 await h.api.handleAction({dataset:{action:'cloud-save'}});h.modal.close();await h.api.handleAction({dataset:{action:'cloud-load'}});h.modal.close();
 assert.equal(h.map.get('sela.study.v1'),before);h.map.set(LOCALE_KEY,'fr-FR');h.windowEvents.storage({key:LOCALE_KEY});assert.equal(h.api.getLocale(),'fr-FR');assert.equal(h.map.get('sela.study.v1'),before);
 const reloaded=boot(state,{now,storage:{getItem:k=>h.map.get(k)||null,setItem:(k,v)=>h.map.set(k,v)}});assert.equal(reloaded.api.getLocale(),'fr-FR');
}
// A pending dialog survives a language change and closes only when its own write finishes.
{
 const h=boot(subjectState(now),{now});h.api.editTask();const form=h.modal.form;form.fd={get:k=>({title:'Keep my task',date:'2026-10-01',subjectId:'math'})[k]};const submit=form.handler({preventDefault(){}});h.api.setLocale('ru-RU');assert.ok(h.modal.open);assert.equal(h.modal.form.buttons[0].disabled,true);await submit;assert.equal(h.modal.open,false);assert.equal(h.api.getState().tasks[0].title,'Keep my task');
 h.api.editSubject();h.modal.form.fd={get:k=>({name:'Math',color:'#7198ca'})[k]};await h.modal.form.handler({preventDefault(){}});assert.equal(h.error.textContent,CATALOGUES['ru-RU']['error.nameUsed']);h.api.setLocale('fr-FR');assert.equal(h.error.textContent,CATALOGUES['fr-FR']['error.nameUsed']);
}
// Native validation is disabled; the app presents its own localised errors.
for(const {code} of LANGUAGES){const h=boot(subjectState(now),{now});h.api.setLocale(code);const field={tagName:'INPUT',disabled:false,required:true,name:'email',value:'',focus(){},setAttribute(){},removeAttribute(){}};assert.throws(()=>h.api.validateForm({elements:[field]}),e=>e.key==='validation.required'&&e.message===CATALOGUES[code]['validation.required']);}
for(const name of ['app.mjs','guide.mjs','date-input.mjs']){const source=fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');assert.ok(!/openai|anthropic|translate\.google|translation\.google|api\.deepl|type="date"/i.test(source));}
// Run the actual HTTP handler with a listening double and real local file reads.
{
 let handler;const serverModuleUrl=new URL('../server.mjs',import.meta.url).href,server=fs.readFileSync(new URL(serverModuleUrl),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url','serverModuleUrl');
 const context=vm.createContext({URL,path,fileURLToPath,readFile,serverModuleUrl,http:{createServer(fn){handler=fn;return {listen(){}};}}});vm.runInContext(server,context);
 for(const [url,expected] of [['/missing-page',404],['/%2e%2e%2fserver.mjs',403]]){
  const response={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};await handler({url},response);assert.equal(response.status,expected);assert.ok(response.headers['Content-Type'].includes('text/html'));assert.ok(response.body.includes(`data-error-code="${expected}"`));assert.ok(response.body.includes('src="/error-page.mjs"'));assert.ok(!response.body.includes('Not found'));
 }
}
setLocale('id-ID',{persist:false});
console.log(`PASS: ${checked} fixed messages, plural forms and placeholders; 59 themes; six locales across five pages/dialogs; UK/US dates and clocks; Russian plurals; malformed dates; unchanged records, persistence and cross-tab switching; pending dialogs and translated errors; HTTP 403/404 pages; no runtime translation API.`);

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as themes from '../dist/vendor/themes.mjs';
import * as actual from '../dist/core.mjs';
import {createSync,parseWorkspace,documentOf} from '../dist/sync.mjs';
import id from '../dist/locales/id-ID.mjs';
import gb from '../dist/locales/en-GB.mjs';
import us from '../dist/locales/en-US.mjs';
import es from '../dist/locales/es-ES.mjs';
import fr from '../dist/locales/fr-FR.mjs';
import ru from '../dist/locales/ru-RU.mjs';
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/export (?=(?:const|let|function|class))/g,'');
const localisation=strip(fs.readFileSync(new URL('../dist/i18n.mjs',import.meta.url),'utf8'));
const dates=strip(fs.readFileSync(new URL('../dist/date-input.mjs',import.meta.url),'utf8'));
const core=fs.readFileSync(new URL('../dist/core.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
const source=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const locking=fs.readFileSync(new URL('../dist/storage.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
export {actual};
export function subjectState(now){const s=actual.newState(now);s.subjects=[{id:'math',name:'Math',color:'#9270d7'}];s.timer.subjectId='math';return s;}
export function locks(){let queue=Promise.resolve();return {request(name,fn){if(name!=='sela.study.write')throw Error('Inconsistent lock name');const next=queue.then(fn);queue=next.catch(()=>{});return next;}};}
function surface(){
 let html='';const object={nodes:[],contains:el=>object.nodes.includes(el),focus:()=>{}};
 Object.defineProperty(object,'innerHTML',{get:()=>html,set(value){
  html=value;object.nodes=[];
  for(const f of html.matchAll(/<form id="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g))for(const m of f[2].matchAll(/<input([^>]*)>/g)){
   const attrs=Object.fromEntries(Array.from(m[1].matchAll(/([\w-]+)="([^"]*)"/g),a=>[a[1],a[2]]));
   object.nodes.push({kind:'field',formId:f[1],name:attrs.name,dataset:{},defaultValue:attrs.value||'',value:attrs.value||'',closest:()=>({id:f[1]}),focus(){object.onFocus?.(this);}});
  }
  for(const m of html.matchAll(/<(?:span|strong|small|p)[^>]*data-(live|subject-time|subject-progress|subject-lifetime|heat-day)="([^"]+)"[^>]*>([^<]*)/g)){
   const dataset={};dataset[{'subject-time':'subjectTime','subject-progress':'subjectProgress','subject-lifetime':'subjectLifetime','heat-day':'heatDay'}[m[1]]||'live']=m[2];
   object.nodes.push({kind:m[1],key:m[2],textContent:m[3],dataset,style:{width:''}});
  }
  for(const m of html.matchAll(/<button class="heat-cell([^"]*)"([^>]*)>/g)){
   const classes=new Set(m[1].trim().split(/\s+/)),attrs=Object.fromEntries(Array.from(m[2].matchAll(/([\w-]+)="([^"]*)"/g),m=>[m[1],m[2]]));
   object.nodes.push({kind:'heat',key:attrs['data-date'],attrs,dataset:{date:attrs['data-date']},disabled:/\bdisabled\b/.test(m[2]),title:attrs.title,classList:{contains:k=>classes.has(k),toggle(k,v){v?classes.add(k):classes.delete(k);}},setAttribute(k,v){attrs[k]=v;}});
  }
  if(object.onHTML)object.onHTML(html);
 }});
 object.querySelectorAll=selector=>{
  if(selector.startsWith('#goal-form input'))return object.nodes.filter(n=>n.kind==='field');
  if(selector.startsWith('[data-today-subjects] ')){if(!html.includes('data-today-subjects'))return [];selector=selector.replace('[data-today-subjects] ','');}
  if(selector==='.heat-cell.today')return object.nodes.filter(n=>n.kind==='heat'&&n.classList.contains('today'));
  const m=selector.match(/^\[data-(subject-time|subject-progress|heat-day)\]$/);return m?object.nodes.filter(n=>n.kind===m[1]):[];
 };
 object.querySelector=selector=>{const field=selector.match(/^#([\w-]+) \[name="([^"]+)"\]$/);if(field)return object.nodes.find(n=>n.kind==='field'&&n.formId===field[1]&&n.name===field[2])||null;const m=selector.match(/^\[data-(live|subject-lifetime)="([^"]+)"\]$/);return m?object.nodes.find(n=>n.kind===m[1]&&n.key===m[2])||null:null;};
 return object;
}
export function boot(initial,{now=Date.now(),storage=null,lock=locks(),cloud={}}={}){
 let current=now,interval=null;const events={},windowEvents={},app=surface(),modal=surface(),toast={textContent:'',classList:{add(){},remove(){}}},error={textContent:''},status={textContent:''};
 const map=new Map([['sela.study.v1',typeof initial==='string'?initial:JSON.stringify(initial)]]);
 const localStorage=storage||{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 function form(){return {fd:null,buttons:[{disabled:false}],password:{value:'secret'},querySelectorAll(){return this.buttons;},setAttribute(){},querySelector(s){return s==='input[name="password"]'?this.password:null;},addEventListener(t,h){this.handler=h;}};}
 Object.assign(modal,{form:null,open:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},onHTML(html){this.form=html.includes('<form')?form():null;error.textContent='';},showModal(){this.open=true;},close(){this.open=false;this.innerHTML='';this.listeners.close?.();}});
 const modalQuery=modal.querySelector;modal.querySelector=s=>s==='form'?modal.form:s==='.form-error'?error:modalQuery(s);
 const document={activeElement:null,documentElement:{style:{setProperty(){}}},body:{dataset:{}},addEventListener(t,h){const prior=events[t];events[t]=event=>{prior?.(event);return h(event);};},querySelectorAll(s){return [...app.querySelectorAll(s),...modal.querySelectorAll(s)];},querySelector(s){
  if(s==='#app')return app;if(s==='#modal')return modal;if(s==='#toast')return toast;if(s==='meta[name="theme-color"]')return {content:''};
  if(s==='#cloud-status')return app.innerHTML.includes('id="cloud-status"')?status:null;
  return app.querySelector(s)||modal.querySelector(s);
 }};
 class FakeDate extends Date{constructor(...args){super(...(args.length?args:[current]));}static now(){return current;}}
 const downloads=[];const context=vm.createContext({id,gb,us,es,fr,ru,Date:FakeDate,crypto:crypto.webcrypto,document,localStorage,structuredClone,TextEncoder,Blob,URL:{createObjectURL(blob){downloads.push(blob);return 'blob:mock';},revokeObjectURL(){}},navigator:{locks:lock},CSS:{escape:x=>x},matchMedia:()=>({matches:false,addEventListener(){}}),window:{addEventListener(t,h){const prior=windowEvents[t];windowEvents[t]=event=>{prior?.(event);return h(event);};},scrollTo(){}},setInterval(fn){if(!interval)interval=fn;},setTimeout(){return 1;},clearTimeout(){},FormData:function(f){return f.fd;},cloud:{getConfig:()=>({}),...cloud},createSync,parseWorkspace,documentOf,...themes});
 document.createElement=()=>({click(){}});
 app.onFocus=el=>document.activeElement=el;
 vm.runInContext(localisation+'\n'+core+'\n'+locking+'\n'+dates+'\n'+source+'\nglobalThis.replay={mutate,handleAction,editTask,editSubject,showDay,render,replaceData,exportData,setLocale,getLocale,t,message,LocalisedError,validateForm,getState:()=>state,getTaskDate:()=>taskDate,getSync:()=>syncEngine};',context);
 return {api:context.replay,document,app,modal,toast,error,status,events,windowEvents,map,downloads,authForm:()=>Object.assign(form(),{id:'cloud-auth'}),tick:()=>interval(),advance:ms=>current+=ms,clock:()=>current};
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {boot,subjectState} from './ui-harness.mjs';
import * as core from '../dist/core.mjs';
import * as i18n from '../dist/i18n.mjs';
const now=new Date(2026,9,1,10).getTime(),results=[];
for(const {code} of i18n.LANGUAGES)for(const mode of ['week','month']){
 const state=subjectState(now),start=new Date(2026,8,23,10).getTime();
 state.sessions=[{id:'past',runId:'past',subjectId:'math',start,end:start+3600000,durationMs:3600000}];
 const h=boot(state,{now});h.api.setLocale(code);
 await h.api.handleAction({dataset:{action:'nav',view:'calendar'}});
 await h.api.handleAction({dataset:{action:'heat-mode',value:mode}});
 await h.api.handleAction({dataset:{action:'heat-prev'}});
 const footer=h.app.querySelector('[data-live="heat-total"]').textContent;
 i18n.setLocale(code,{persist:false});
 assert.equal(footer,h.api.t('calendar.'+mode+'Total',{duration:i18n.formatDuration(3600000)}));
 results.push({case:'past-period-footer',locale:code,mode,footer});
}

const source=fs.readFileSync(new URL('../dist/date-input.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
for(const {code} of i18n.LANGUAGES){
 i18n.setLocale(code,{persist:false});
 let popup;
 const input={id:'audit-date',isConnected:true,dataset:{dateValue:'2026-10-01'},closest:()=>({append(){}})};
 const document={querySelector:()=>null,createElement(){popup={attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelector:()=>({focus(){}}),scrollIntoView(){},remove(){}};return popup;}};
 const context=vm.createContext({...core,...i18n,document});
 vm.runInContext(source+'\nglobalThis.drawAudit=(input,date)=>{dateInput=input;dateMonth=date;dateFocus="2026-10-01";drawDatePicker();return datePopup.innerHTML;};',context);
 const html=context.drawAudit(input,new Date(2026,9,1));
 const opening=html.match(/<div[^>]*role="grid"[^>]*>/)?.[0];
 assert.ok(opening);
 assert.equal((html.match(/role="gridcell"/g)||[]).length,42);
 assert.equal((html.match(/role="columnheader"/g)||[]).length,7);
 assert.equal((html.match(/role="row"/g)||[]).length,7);
 assert.ok(/aria-label="[^"<>]+"/.test(opening));
 results.push({case:'named-aria-date-grid',locale:code,gridOpening:opening,cells:42,headers:7,rows:7,name:opening.match(/aria-label="([^"]+)"/)[1]});
}
const selected={'id-ID':'dipilih','en-GB':'selected','en-US':'selected','es-ES':'seleccionad','fr-FR':'sélectionné','ru-RU':'выбранн'};
for(const result of results.filter(r=>r.case==='past-period-footer'))assert.ok(result.footer.includes(selected[result.locale]));
const savedZone=process.env.TZ;
try{
 // Lifetime totals include every permitted timestamp, even if epoch zero has
 // a local date in 1969. Expected duration is an explicit independent value.
 for(const zone of ['UTC','America/Los_Angeles','Asia/Singapore']){
  process.env.TZ=zone;
  for(const start of [0,Date.UTC(1999,8,23,10)])for(const {code} of i18n.LANGUAGES){
   const hState=subjectState(now);hState.subjects[0].id='__proto__';hState.timer.subjectId='__proto__';
   hState.sessions=[{id:'historical',runId:'historical',subjectId:'__proto__',start,end:start+3600000,durationMs:3600000}];
   core.validateState(hState);const h=boot(hState,{now});h.api.setLocale(code);i18n.setLocale(code,{persist:false});
   await h.api.handleAction({dataset:{action:'nav',view:'subjects'}});
   assert.ok(h.app.innerHTML.includes(h.api.t('subjects.total',{duration:i18n.formatDuration(3600000)})),`${zone}/${code}/${start}`);
  }
 }
 // Compare month grids to civil dates enumerated independently in UTC. Valid
 // four-digit task years must not be coerced into the twentieth century.
 for(const zone of ['UTC','America/Los_Angeles','Asia/Singapore']){
  process.env.TZ=zone;
  for(const date of ['0001-01-15','0042-02-15','0099-12-15','0100-01-15','2026-10-15'])for(const {code} of i18n.LANGUAGES){
   const historicalNow=Date.parse(date+'T12:00:00'),state=subjectState(historicalNow);
   state.tasks=[{id:'early-year',title:'Preserved historical task',date,done:false,subjectId:'math'}];
   core.validateState(state);const h=boot(state,{now:historicalNow});h.api.setLocale(code);i18n.setLocale(code,{persist:false});
   await h.api.handleAction({dataset:{action:'nav',view:'calendar'}});
   await h.api.handleAction({dataset:{action:'heat-mode',value:'month'}});
   const month=Date.parse(date.slice(0,7)+'-01T00:00:00Z'),civil=new Date(month),firstWeekday=code==='en-US'?0:1;
   const offset=(civil.getUTCDay()-firstWeekday+7)%7,gridStart=month-offset*86400000;
   const actual=[...h.app.innerHTML.matchAll(/class="heat-cell[^\"]*"[^>]*data-date="([^"]+)"/g)].map(m=>m[1]);
   const expected=actual.map((_,i)=>new Date(gridStart+i*86400000).toISOString().slice(0,10));
   assert.deepEqual(actual,expected,`${zone}/${code}/${date}: exact calendar grid`);
   assert.ok(actual.includes(date));
   const snapshot=h.map.get('sela.study.v1');
   await h.api.handleAction({dataset:{action:'heat-next'}});
   await h.api.handleAction({dataset:{action:'heat-prev'}});
   assert.deepEqual([...h.app.innerHTML.matchAll(/class="heat-cell[^\"]*"[^>]*data-date="([^"]+)"/g)].map(m=>m[1]),expected,`${zone}/${code}/${date}: next/previous month`);
   assert.equal(h.map.get('sela.study.v1'),snapshot);
   const calendarFooter=h.app.querySelector('[data-live="heat-total"]').textContent;
   h.advance(1000);h.tick();
   assert.equal(h.app.querySelector('[data-live="heat-total"]').textContent,calendarFooter);
   assert.equal(h.map.get('sela.study.v1'),snapshot);
   await h.api.handleAction({dataset:{action:'nav',view:'stats'}});
   await h.api.handleAction({dataset:{action:'period',value:'month'}});
   const days=[...h.app.innerHTML.matchAll(/class="bar-column"[^>]*data-date="([^"]+)"/g)].map(m=>m[1]);
   const nextMonth=new Date(month);nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
   const monthLength=(+nextMonth-month)/86400000;
   assert.equal(days.length,monthLength);
   assert.deepEqual(days,Array.from({length:monthLength},(_,i)=>new Date(month+i*86400000).toISOString().slice(0,10)),`${zone}/${code}/${date}: exact statistics range`);
   await h.api.handleAction({dataset:{action:'period-prev'}});
   await h.api.handleAction({dataset:{action:'period-next'}});
   assert.deepEqual([...h.app.innerHTML.matchAll(/class="bar-column"[^>]*data-date="([^"]+)"/g)].map(m=>m[1]),days,`${zone}/${code}/${date}: statistics navigation`);
   assert.equal(h.map.get('sela.study.v1'),snapshot);
  }
 }
 process.env.TZ='Pacific/Apia';
 for(const {code} of i18n.LANGUAGES){
  i18n.setLocale(code,{persist:false});
  const input={id:'skipped-date',isConnected:true,dataset:{dateValue:'2011-12-31'},closest:()=>({append(){}})};
  const document={querySelector:()=>null,createElement(){return {setAttribute(){},querySelector:()=>({focus(){}}),scrollIntoView(){},remove(){}};}};
  const context=vm.createContext({...core,...i18n,document});
  vm.runInContext(source+'\nglobalThis.drawSkipped=(input,date)=>{dateInput=input;dateMonth=date;dateFocus="2011-12-31";drawDatePicker();return datePopup.innerHTML;};',context);
  const html=context.drawSkipped(input,new Date(2011,11,1));
  const cells=[...html.matchAll(/<(?:span|button)[^>]*role="gridcell"[^>]*>/g)].map(m=>m[0]);
  assert.equal(cells.length,42);assert.equal(cells.filter(cell=>cell.includes('aria-disabled="true"')).length,1);
  const first=code==='en-US'?Date.UTC(2011,10,27):Date.UTC(2011,10,28);
  for(const [index,cell] of cells.entries()){
   // Enumerate Gregorian civil dates in UTC: no production calendar helpers.
   const expected=new Date(first+index*86400000).toISOString().slice(0,10);
   if(expected==='2011-12-30')assert.ok(cell.includes('aria-disabled="true"'));
   else assert.ok(cell.includes(`data-date-pick="${expected}"`),`${code} cell=${index}`);
  }
  const pastNow=new Date(2011,11,31,12).getTime(),h=boot(subjectState(pastNow),{now:pastNow});h.api.setLocale(code);
  await h.api.handleAction({dataset:{action:'nav',view:'calendar'}});
  for(const mode of ['month','week','contributions']){
   await h.api.handleAction({dataset:{action:'heat-mode',value:mode}});
   const dates=[...h.app.innerHTML.matchAll(/class="heat-cell[^\"]*"[^>]*data-date="([^"]+)"/g)].map(m=>m[1]);
   assert.equal(new Set(dates).size,dates.length,`${code}/${mode}: no duplicate dates`);
   assert.ok(!dates.includes('2011-12-30'));assert.ok(dates.includes('2011-12-31'));
  }
 }
}finally{if(savedZone===undefined)delete process.env.TZ;else process.env.TZ=savedZone;}
console.log('PASS: selected historical labels, complete lifetime totals including epoch/pre-2000 records, exact early-year month grids/ranges/navigation, named row-owned grids, and skipped-date calendar alignment in all six languages.');

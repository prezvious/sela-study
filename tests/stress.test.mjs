/*
 * Reproducible, bounded stress audit; built-in Node modules only.
 * Run: node tests/stress.test.mjs
 * Replay: node tests/stress.test.mjs --seed=1578770470
 * Default seeds: 0x5e1a2026, 0x0c10c0de, 0xdeadbeef (printed as uint32).
 * Caps per seed: 600 stopwatch actions, 48 generated backup/corruption cases,
 * 12 multi-tab waves x 9 writes, 12 quota fixtures, 27 cloud schedules, and
 * 12 minute-aligned intervals per timezone. Seven timezone child processes
 * each have a 30-second timeout and 256-MiB heap cap. Every fixture is synthetic.
 * SDK, DOM, storage and lock doubles do not establish live browser/Supabase behaviour.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as core from '../dist/core.mjs';
import {LocalisedError,message,setLocale} from '../dist/i18n.mjs';
import {boot,subjectState} from './ui-harness.mjs';

const supplied=process.argv.slice(2);
if(supplied.some(x=>!/^--seed=\d+$/.test(x)))throw Error('Usage: node tests/stress.test.mjs [--seed=uint32]');
const SEEDS=supplied.length?supplied.map(x=>Number(x.slice(7))):[0x5e1a2026,0x0c10c0de,0xdeadbeef];
if(SEEDS.length>4||SEEDS.some(x=>!Number.isInteger(x)||x<0||x>0xffffffff))throw Error('Use at most four unsigned 32-bit seeds.');
const random=seed=>{let value=seed>>>0;return max=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)%max;};};
const json=value=>JSON.parse(JSON.stringify(value));
const KEY='sela.study.v1',NOW=Date.UTC(2026,8,29,12);
const task=(id,title=id)=>({id,title,date:'2026-09-29',done:false,subjectId:'math'});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const settle=promise=>promise.then(value=>({value}),error=>({error}));
async function reached(h,phase,count=1){for(let i=0;i<64;i++){if(h.entered[phase]>=count)return;await Promise.resolve();}throw Error(`Mock ${phase} did not reach controlled phase ${count}`);}
const failures=[];let passed=0;
async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){failures.push({name,error});console.error(`FAIL ${name}\n${error.stack||error}`);}}
console.log(JSON.stringify({suite:'sela deterministic stress',seeds:SEEDS,timezoneChildren:7,network:'mocked',records:'synthetic'}));

function timerModel(seed){
 const next=random(seed),s=core.newState(NOW);
 s.subjects=Array.from({length:3},(_,i)=>({id:`subject${i}`,name:`Subject ${i}`,color:core.COLORS[i]}));s.timer.subjectId='subject0';
 let now=NOW,started=null,accrued=0,run=0,currentSubject='subject0';const segments=[],runMap=new Map([[s.timer.runId,run]]),trace=[];
 const independentElapsed=()=>accrued+(started===null?0:Math.max(0,now-started));
 const stop=()=>{if(started!==null){const duration=Math.max(0,now-started);if(duration>0)segments.push({start:started,end:started+duration,subjectId:currentSubject,durationMs:duration,run});accrued+=duration;started=null;}};
 try{
  for(let i=0;i<600;i++){
   const choice=next(8);trace.push({i,choice,now});
   if(choice===0){const delta=[0,1,999,60000,3600000,-1,-60000][next(7)];now+=delta;}
   else if(choice===1||choice===2){
    const clockBlocked=started===null&&segments.some(x=>x.end>now);
    if(clockBlocked)assert.throws(()=>core.startTimer(s,now),e=>e.key==='error.clock');
    else{core.startTimer(s,now);if(started===null)started=now;}
   }
   else if(choice===3){const before=accrued;stop();assert.equal(core.pauseTimer(s,now),accrued-before);}
   else if(choice===4){stop();assert.equal(core.finishTimer(s,now),accrued);accrued=0;run++;runMap.set(s.timer.runId,run);}
   else if(choice===5&&started===null&&accrued===0){currentSubject=`subject${next(3)}`;s.timer.subjectId=currentSubject;}
   else if(choice===6){
    const original=JSON.stringify(s),snapshot=core.parseBackup(core.serializeBackup(s,now));
    assert.equal(JSON.stringify(s),original,'backup must not mutate the running/paused timer');
    assert.equal(snapshot.sessions.reduce((sum,x)=>sum+x.durationMs,0),segments.reduce((sum,x)=>sum+x.durationMs,0)+(started===null?0:Math.max(0,now-started)));
    assert.equal(snapshot.timer.startedAt,null);assert.equal(snapshot.timer.elapsedMs,0);
   }
   assert.equal(core.elapsed(s,now),independentElapsed());assert.equal(core.hasActiveSession(s),started!==null||accrued>0);
   assert.deepEqual(s.sessions.map(x=>({start:x.start,end:x.end,subjectId:x.subjectId,durationMs:x.durationMs,run:runMap.get(x.runId)})),segments);
   if(i%17===0){
    assert.deepEqual(core.validateState(s).sessions,s.sessions);
    const a=core.aggregate(s,'2026-09-01','2026-10-31',now),expectedSegments=[...segments];
    if(started!==null&&now>started)expectedSegments.push({durationMs:now-started,run,subjectId:currentSubject});
    assert.equal(a.total,expectedSegments.reduce((sum,x)=>sum+x.durationMs,0));
    assert.equal(a.count,new Set(expectedSegments.map(x=>x.run)).size);
    assert.equal(a.max,Math.max(0,...expectedSegments.map(x=>x.durationMs)));
    for(const subject of s.subjects)assert.equal(a.subjects[subject.id]||0,expectedSegments.filter(x=>x.subjectId===subject.id).reduce((sum,x)=>sum+x.durationMs,0));
   }
  }
 }catch(error){throw new Error(`${error.stack||error}\nReplay --seed=${seed}; final actions=${JSON.stringify(trace.slice(-25))}`,{cause:error});}
}

function generatedBackups(seed){
 const next=random(seed);const poison=['__proto__','constructor','toString'];
 for(let caseId=0;caseId<48;caseId++){
  const s=core.newState(NOW);s.subjects=Array.from({length:1+next(6)},(_,i)=>({id:poison[i]||`subject_${i}`,name:`A<&> "Ж ñ ${i}`,color:core.COLORS[i%6],archived:i>0&&next(2)===0}));
  s.timer.subjectId=s.subjects[0].id;s.settings.goal=15+next(1426);s.settings.theme=['light','dark','system'][next(3)];
  s.tasks=Array.from({length:next(50)},(_,i)=>({id:`task_${i}`,title:`Title ${caseId}/${i}\u0001 <script>Ж😊</script>`,date:['2024-02-29','2026-09-29','0001-01-01','9999-12-31'][next(4)],done:!!next(2),subjectId:s.subjects[next(s.subjects.length)].id}));
  let cursor=NOW-7*86400000;
  const sessionCount=next(60);
  for(let i=0;i<sessionCount;i++){
   cursor+=next(10000);const duration=next(600000),end=cursor+duration;
   s.sessions.push({id:`segment_${i}`,runId:`run_${i}`,subjectId:s.subjects[next(s.subjects.length)].id,start:cursor,end,durationMs:duration});cursor=end;
  }
  const valid=core.validateState(s),snapshot=core.parseBackup(core.serializeBackup(valid,NOW));
  assert.deepEqual(snapshot.subjects,valid.subjects);assert.deepEqual(snapshot.tasks,valid.tasks);assert.deepEqual(snapshot.sessions,valid.sessions);assert.deepEqual(snapshot.settings,valid.settings);
  const duration=valid.sessions.reduce((sum,x)=>sum+x.durationMs,0);assert.equal(core.aggregate(snapshot,'2026-09-01','2026-09-30',NOW).total,duration);
  const corruptions=[
   v=>v.subjects.push({...v.subjects[0]}),v=>v.subjects[0].id='id.invalid',v=>v.subjects[0].name=' '.repeat(80),
   v=>v.subjects[0].color='expression(alert(1))',v=>v.timer.elapsedMs=1,v=>v.timer.startedAt=Number.NaN,
   v=>v.timer.runId='x'.repeat(101),v=>v.settings.goal=14,v=>v.settings.goal=1441,v=>v.settings.goal=20.5,
   v=>v.tasks.push({...task('bad'),'date':'2026-02-29'}),v=>v.tasks.push({...task('bad'),subjectId:'unknown'}),
   v=>v.tasks.push({...task('bad'),title:'x'.repeat(301)}),v=>v.tasks.push({...task('bad'),done:'false'})
  ];
  if(valid.sessions.length)corruptions.push(v=>v.sessions[0].durationMs++,v=>v.sessions[0].end--);
  const nonzero=valid.sessions.findIndex(x=>x.durationMs>0);
  if(nonzero>=0)corruptions.push(v=>v.sessions.push({...v.sessions[nonzero],id:'overlap'}));
  for(const [index,change] of corruptions.entries()){
   const bad=structuredClone(valid);change(bad);assert.throws(()=>core.validateState(bad),undefined,`seed=${seed} case=${caseId} corruption=${index}`);
  }
 }
 // Inclusive schema limits and safe timestamp/duration boundaries. No maximum-size strings.
 const s=core.newState(NOW);s.subjects=Array.from({length:core.LIMITS.subjects},(_,i)=>({id:`s${i}`,name:`S${i}`,color:'#abcdef'}));s.timer.subjectId='s0';
 assert.equal(core.validateState(s).subjects.length,core.LIMITS.subjects);assert.throws(()=>core.validateState({...s,subjects:[...s.subjects,{id:'overflow',name:'Overflow',color:'#abcdef'}]}));
 s.tasks=Array.from({length:core.LIMITS.tasks},(_,i)=>({...task(`t${i}`),subjectId:'s0'}));assert.equal(core.validateState(s).tasks.length,core.LIMITS.tasks);
 assert.throws(()=>core.validateState({...s,tasks:[...s.tasks,{...task('overflow'),subjectId:'s0'}]}));
 for(const duration of [366*86400000-1,366*86400000,366*86400000+1,367*86400000]){s.sessions=[{id:'limit',runId:'old',subjectId:'s0',start:0,end:duration,durationMs:duration}];assert.equal(core.validateState(s).sessions[0].durationMs,duration);}
 s.sessions[0].end=8640000000000001;s.sessions[0].durationMs=s.sessions[0].end;assert.throws(()=>core.validateState(s));
}

function queuedLocks(){
 const pending=[];
 return {pending,request(name,fn){assert.equal(name,'sela.study.write');return new Promise((resolve,reject)=>pending.push({fn,resolve,reject}));},run(index){const [op]=pending.splice(index,1);try{op.resolve(op.fn());}catch(error){op.reject(error);}}};
}
async function multiTab(seed){
 const next=random(seed),initial=subjectState(NOW),map=new Map([[KEY,JSON.stringify(initial)]]),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},lock=queuedLocks();
 const tabs=Array.from({length:3},()=>boot(initial,{now:NOW,storage,lock}));
 const expected=new Map(),history=[map.get(KEY)];let counter=0;
 for(let wave=0;wave<12;wave++){
  const operations=[],results=[];
  for(let i=0;i<9;i++){
   const kind=next(5),keys=[...expected.keys()],id=kind===0||keys.length===0?`generated_${counter++}`:keys[next(keys.length)],tab=tabs[next(tabs.length)];
   const descriptor={kind,id,add:kind===0||keys.length===0,done:!!next(2),title:`Edited ${wave}/${i}`};
   const promise=settle(tab.api.mutate(s=>{
    if(kind===4){s.tasks.push({...task(`invalid_${counter++}`),date:'2026-02-30'});return;}
    const old=s.tasks.find(x=>x.id===id);
    if(descriptor.add)s.tasks.push(task(id));
    else if(kind===1&&old)old.done=descriptor.done;
    else if(kind===2)s.tasks=s.tasks.filter(x=>x.id!==id);
    else if(kind===3&&old)old.title=descriptor.title;
   }));operations.push({descriptor,promise});results.push(promise);
  }
  while(lock.pending.length){
   const index=next(lock.pending.length),{descriptor,promise}=operations.splice(index,1)[0],previous=map.get(KEY);lock.run(index);const outcome=await promise;
   if(descriptor.kind===4){assert.equal(outcome.error?.key,'error.backupFormat');assert.equal(map.get(KEY),previous,'a rejected edit must not change storage');}
   else{
    assert.equal(outcome.error,undefined);const {kind,id,add,done,title}=descriptor;
    // Apply each descriptor to a Map model; the oracle never reads implementation
    // output to decide what a successful operation was supposed to do.
    const actual=JSON.parse(map.get(KEY));
    if(add)expected.set(id,task(id));
    else if(kind===1&&expected.has(id))expected.get(id).done=done;
    else if(kind===2)expected.delete(id);
    else if(kind===3&&expected.has(id))expected.get(id).title=title;
    assert.deepEqual(actual.tasks,[...expected.values()],`seed=${seed} wave=${wave} operation=${JSON.stringify(descriptor)}`);history.push(map.get(KEY));
   }
   // Reordered/coalesced notifications carry arbitrary old raw values. Handlers
   // must consult current storage, as real events can arrive after another edit.
   for(const tab of tabs)tab.windowEvents.storage({key:KEY,newValue:history[next(history.length)]});
  }
  await Promise.all(results);
  assert.deepEqual(JSON.parse(map.get(KEY)).tasks,[...expected.values()]);
  for(const tab of tabs)assert.deepEqual(json(tab.api.getState().tasks),[...expected.values()]);
 }
}

async function quotaStress(seed){
 const next=random(seed);
 for(let i=0;i<12;i++){
  let raw=JSON.stringify(subjectState(NOW)),writeFails=true,readFails=false;
  const storage={getItem:k=>{if(k!==KEY)return null;if(readFails)throw Error('synthetic read denial');return raw;},setItem:(k,v)=>{if(k!==KEY)return;if(writeFails)throw Error('synthetic quota');raw=v;}};
  const a=boot(subjectState(NOW),{now:NOW,storage}),b=boot(subjectState(NOW),{now:NOW,storage}),first=task(`unsaved_${i}`),second=task(`saved_${i}`);
  const storedBefore=raw;await a.api.mutate(s=>s.tasks.push(first));assert.equal(raw,storedBefore);assert.deepEqual(json(a.api.getState().tasks),[first]);
  readFails=true;await a.api.mutate(s=>s.settings.goal=15+next(1426));readFails=false;
  writeFails=false;await b.api.mutate(s=>s.tasks.push(second));a.windowEvents.storage({key:KEY,newValue:storedBefore});
  assert.deepEqual(json(a.api.getState().tasks),[first]);assert.deepEqual(JSON.parse(raw).tasks,[second]);
  const before=raw;await assert.rejects(a.api.mutate(s=>s.tasks.push(task('must_not_overwrite'))),e=>e.key==='error.tabConflict');assert.equal(raw,before);
  await a.api.handleAction({dataset:{action:'export'}});assert.deepEqual(JSON.parse(await a.downloads.at(-1).text()).tasks,[first]);
  readFails=true;await assert.rejects(b.api.mutate(s=>s.tasks.push(task('denied'))),e=>e.key==='error.storageRead');readFails=false;assert.equal(raw,before);
 }
 // Malformed persisted bytes remain downloadable and ordinary writes are blocked.
 for(const raw of ['{broken','null','{"version":2}','[1,2,3]']){
  const h=boot(raw,{now:NOW});await assert.rejects(h.api.mutate(s=>s.tasks.push(task('blocked'))),e=>e.key==='error.recoveryFirst');
  await h.api.handleAction({dataset:{action:'export'}});assert.equal(await h.downloads.at(-1).text(),raw);assert.equal(h.map.get(KEY),raw);
 }
}

const cloudSource=fs.readFileSync(new URL('../dist/cloud.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replace("import('https://esm.sh/@supabase/supabase-js@2.57.4')",'mockImport()');
function cloudFixture(){
 const map=new Map(),created=[],calls=[],authListeners=new Set(),entered={sdk:0,user:0,query:0,rpc:0,auth:0},gates={sdk:null,user:null,query:null,rpc:null,auth:null};let user='account_A',revision=0,payload=null;
 const createClient=(url,key,options)=>{
  const authKey=options.auth.storageKey;if(user)map.set(authKey,JSON.stringify({user:{id:user}}));
  const client={url,key,authKey,stopped:false,auth:{stopAutoRefresh(){client.stopped=true;},onAuthStateChange(callback){authListeners.add(callback);return {data:{subscription:{unsubscribe(){authListeners.delete(callback);}}}};},async getUser(){entered.user++;const captured=user;await gates.user?.promise;return {data:{user:captured?{id:captured}:null}};},async signInWithPassword(){entered.auth++;await gates.auth?.promise;return {data:{session:{}}};},async signUp(){entered.auth++;await gates.auth?.promise;return {data:{session:null}};},async signOut(){entered.auth++;await gates.auth?.promise;return {};}},from(){return {select(){return this;},eq(){return this;},async maybeSingle(){entered.query++;const captured={data:payload,revision};await gates.query?.promise;return {data:captured};}};},async rpc(name,args){calls.push({url,name,args});entered.rpc++;await gates.rpc?.promise;if(args.p_expected_user_id!==user)return {error:{message:'ACCOUNT_CHANGED'}};if(args.p_expected_revision!==revision)return {error:{message:'CLOUD_CONFLICT'}};payload=args.p_data;revision++;return {};}};created.push(client);return client;
 };
 const context=vm.createContext({LocalisedError,message,URL,atob,location:{origin:'http://stress.invalid'},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},mockImport:async()=>{entered.sdk++;await gates.sdk?.promise;return {createClient};}});
 vm.runInContext(cloudSource+'\nglobalThis.api={getClient,configure,load,save,authenticate,signOut};',context);
 context.api.configure('https://one.supabase.co','sb_publishable_synthetic');
 const emitAuth=(value,event='SIGNED_IN')=>{user=value;for(const client of created){if(value)map.set(client.authKey,JSON.stringify({user:{id:value}}));else map.delete(client.authKey);}for(const callback of authListeners)callback(event,value?{user:{id:value}}:null);};
 return {api:context.api,map,created,calls,gates,entered,setUser:value=>emitAuth(value,value?'SIGNED_IN':'SIGNED_OUT'),refresh:()=>emitAuth(user,'TOKEN_REFRESHED'),setRevision:value=>revision=value};
}
async function cloudStress(seed){
 const next=random(seed);
 for(let i=0;i<27;i++){
  const h=cloudFixture(),mode=i%9;
  if(mode===0){
   h.gates.sdk=deferred();const first=settle(h.api.getClient()),same=settle(h.api.getClient());
   h.api.configure('https://two.supabase.co','sb_publishable_next');const latest=settle(h.api.getClient());h.gates.sdk.resolve();
   assert.equal((await first).error.key,'error.configChanged');assert.equal((await same).error.key,'error.configChanged');assert.equal((await latest).value.url,'https://two.supabase.co');assert.equal(h.created.length,1);
  }else if(mode===1){
   await h.api.getClient();h.gates.query=deferred();const pending=settle(h.api.load());await reached(h,'query');
   h.api.configure('https://two.supabase.co','sb_publishable_next');h.gates.query.resolve();assert.equal((await pending).error.key,'error.configChanged');assert.equal(h.calls.length,0);
  }else if(mode===2){
   const remote=await h.api.load();h.gates.rpc=deferred();const pending=settle(h.api.save({marker:next(1000)},0,remote.context));await reached(h,'rpc');
   h.setUser('account_B');h.gates.rpc.resolve();assert.equal((await pending).error.key,'error.accountChanged');assert.equal(h.calls[0].args.p_expected_user_id,'account_A');
  }else if(mode===3){
   const remote=await h.api.load();h.setRevision(1+next(10));await assert.rejects(h.api.save({marker:next(1000)},remote.revision,remote.context),e=>e.key==='error.cloudConflict');
   const fresh=await h.api.load();await h.api.save({marker:'retry'},fresh.revision,fresh.context);assert.equal(h.calls.length,2);
  }else if(mode===4){
   await h.api.getClient();h.gates.auth=deferred();const pending=settle(h.api.authenticate('synthetic@example.invalid','synthetic-password','login'));await reached(h,'auth');
   h.map.set('sela.supabase.config.v1',JSON.stringify({url:'https://two.supabase.co',key:'sb_publishable_cross_tab'}));h.gates.auth.resolve();assert.equal((await pending).error.key,'error.configChanged');const current=await h.api.getClient();assert.equal(current.url,'https://two.supabase.co');assert.ok(h.created[0].stopped);
  }else if(mode===5){
   const remote=await h.api.load(),snapshot={marker:next(1000)};const outcomes=await Promise.all([settle(h.api.save(snapshot,remote.revision,remote.context)),settle(h.api.save({marker:'other'},remote.revision,remote.context))]);
   assert.equal(outcomes.filter(x=>!x.error).length,1);assert.equal(outcomes.filter(x=>x.error?.key==='error.cloudConflict').length,1);assert.equal(h.calls.length,2);
  }else if(mode===6){
   await h.api.getClient();h.gates.query=deferred();const pending=settle(h.api.load());await reached(h,'query');
   h.setUser('account_B');h.gates.query.resolve();assert.equal((await pending).error?.key,'error.accountChanged','an old account read must not become a new confirmation');
   h.gates.query=null;const fresh=await h.api.load();assert.equal(fresh.context.userId,'account_B');assert.equal(h.calls.length,0);
  }else if(mode===7){
   await h.api.getClient();h.gates.user=deferred();const pending=settle(h.api.load());await reached(h,'user');
   h.setUser(next(2)?'account_B':null);h.gates.user.resolve();assert.equal((await pending).error?.key,'error.accountChanged','getUser captured before an account switch must be rejected');assert.equal(h.calls.length,0);
  }else{
   const remote=await h.api.load();h.gates.query=deferred();const pending=settle(h.api.load());await reached(h,'query',2);h.refresh();h.gates.query.resolve();
   const refreshed=await pending;assert.equal(refreshed.error,undefined,'refreshing the same account must preserve identity');assert.equal(refreshed.value.context.userId,remote.context.userId);
   await h.api.save({marker:'after-refresh'},remote.revision,remote.context);assert.equal(h.calls.length,1);
  }
 }
}

setLocale('id-ID',{persist:false});
for(const seed of SEEDS){
 await check(`stopwatch model seed=${seed}`,()=>timerModel(seed));
 await check(`generated backups and corruption seed=${seed}`,()=>generatedBackups(seed));
 await check(`three-tab interleavings seed=${seed}`,()=>multiTab(seed));
 await check(`quota/read/corruption isolation seed=${seed}`,()=>quotaStress(seed));
 await check(`cloud asynchronous schedules seed=${seed}`,()=>cloudStress(seed));
}
await check('long-active finish/export duration conservation',()=>{
 for(const duration of [366*86400000-1,366*86400000,366*86400000+1,367*86400000]){
  const now=Date.now(),s=core.newState(now);s.subjects=[{id:'long',name:'Long fixture',color:'#abcdef'}];s.timer.subjectId='long';core.startTimer(s,now-duration);
  assert.equal(core.validateState(s).timer.startedAt,now-duration);const before=JSON.stringify(s),backup=core.parseBackup(core.serializeBackup(s,now));
  assert.equal(JSON.stringify(s),before);assert.equal(backup.sessions.reduce((sum,x)=>sum+x.durationMs,0),duration);assert.equal(backup.timer.startedAt,null);
  assert.equal(core.finishTimer(s,now),duration);assert.equal(core.validateState(s).sessions.reduce((sum,x)=>sum+x.durationMs,0),duration);
 }
});
for(const zone of ['UTC','Asia/Singapore','America/New_York','Europe/Paris','Australia/Lord_Howe','Pacific/Apia','America/Santiago']){
 await check(`calendar oracle TZ=${zone}`,()=>{
  const result=spawnSync(process.execPath,['--max-old-space-size=256',fileURLToPath(new URL('./stress-timezones.mjs',import.meta.url)),...SEEDS.map(String)],{env:{...process.env,TZ:zone},encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(result.error)throw result.error;assert.equal(result.status,0,result.stderr||result.stdout);console.log(result.stdout.trim());
 });
}
console.log(JSON.stringify({result:failures.length?'FAIL':'PASS',passed,failed:failures.map(x=>x.name),seeds:SEEDS}));
if(failures.length)process.exitCode=1;

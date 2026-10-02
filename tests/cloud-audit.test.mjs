import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const project=process.argv[2]||fileURLToPath(new URL('..',import.meta.url));
const moduleFile=process.argv[3]||path.join(project,'dist','cloud.mjs');
const {LocalisedError,message}=await import(pathToFileURL(path.join(project,'dist','i18n.mjs')));
const source=fs.readFileSync(moduleFile,'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replace("import('https://esm.sh/@supabase/supabase-js@2.57.4')",'mockImport()');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
 const map=new Map(),clients=[],events={};let userId='A',authGate=null,queryGate=null,sessionGate=null,row=null;
 let authStarted=deferred(),queryStarted=deferred(),sessionStarted=deferred();
 const session=()=>userId?{user:{id:userId}}:null;
 function writeSession(c){if(userId)map.set(c.storageKey,JSON.stringify(session()));else map.delete(c.storageKey);}
 const createClient=(url,key,options)=>{
  const callbacks=new Set(),c={url,key,storageKey:options.auth.storageKey,unsubscribed:0,stopped:false};
  writeSession(c);
  c.auth={stopAutoRefresh(){c.stopped=true;},onAuthStateChange(callback){callbacks.add(callback);callback('INITIAL_SESSION',session());return {data:{subscription:{unsubscribe(){callbacks.delete(callback);c.unsubscribed++;}}}};},async getSession(){const snapshot=session();sessionStarted.resolve();if(sessionGate)await sessionGate;return {data:{session:snapshot}};},async resetPasswordForEmail(email,options){c.resetRequest={email,options};return {};},async updateUser(values){c.passwordRequest=values;return {};},async getUser(){const snapshot=session();authStarted.resolve();if(authGate)await authGate;return {data:{user:snapshot?.user||null}};},async signOut(){userId=null;writeSession(c);c.emit('SIGNED_OUT');return {};}};
  c.emit=event=>{for(const callback of callbacks)callback(event,session());};
  c.from=()=>({select(){return this;},eq(){return this;},async maybeSingle(){const snapshot=row;queryStarted.resolve();if(queryGate)await queryGate;return {data:snapshot};}});
  c.rpc=async()=>({});clients.push(c);return c;
 };
 const context=vm.createContext({LocalisedError,message,URL,atob,location:{origin:'http://fixture.invalid',href:'http://fixture.invalid/study/index.html?draft=1#ignored'},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},window:{addEventListener(type,fn){events[type]=fn;}},mockImport:async()=>({createClient})});
 vm.runInContext(source+'\nglobalThis.api={getConfig,configure,load,checkContext,assertCurrentContext,save,getClient,watchAuth,refreshAuth,requestReset,updatePassword};',context);
 context.api.configure('https://one.supabase.co','sb_publishable_fixture');
 return {api:context.api,map,clients,setRow:r=>row=r,setUser(id,{emit=true}={}){userId=id;for(const c of clients){writeSession(c);if(emit)c.emit(id?'SIGNED_IN':'SIGNED_OUT');}},setSessionGate(p){sessionGate=p;sessionStarted=deferred();},sessionStarted:()=>sessionStarted.promise,setAuthGate:p=>authGate=p,setQueryGate:p=>queryGate=p,authStarted:()=>authStarted.promise,queryStarted:()=>queryStarted.promise,refresh(){for(const c of clients)c.emit('TOKEN_REFRESHED');},configEvent(){events.storage?.({key:'sela.supabase.config.v1'});}};
}
const changed=e=>e.key==='error.accountChanged'||e.key==='error.configChanged';
// Account listeners must never replay queued or delayed sessions after sign-out.
{
 const h=fixture();await h.api.getClient();const received=[],stop=h.api.watchAuth(value=>received.push(value));await h.api.refreshAuth();await Promise.resolve();received.length=0;
 h.setUser('B');h.setUser(null);await Promise.resolve();assert.equal(received.at(-1).user,null);assert.ok(received.every(value=>value.user===null));
 h.setUser('A');await Promise.resolve();received.length=0;const gate=deferred();h.setSessionGate(gate.promise);const refreshing=h.api.refreshAuth();await h.sessionStarted();h.setUser(null);gate.resolve();await refreshing;await Promise.resolve();assert.equal(received.at(-1).user,null);assert.ok(received.every(value=>value.user===null));
 stop();received.length=0;h.setUser('B');await Promise.resolve();assert.equal(received.length,0);
}
// Reset callbacks preserve the deployed application path and remove draft URL state.
{
 const h=fixture();await h.api.requestReset(' test@example.invalid ');assert.equal(h.clients[0].resetRequest.email,'test@example.invalid');assert.equal(h.clients[0].resetRequest.options.redirectTo,'http://fixture.invalid/study/index.html');await h.api.updatePassword('a-new-test-password');assert.equal(h.clients[0].passwordRequest.password,'a-new-test-password');
}
// Auth's network response belongs to its request's identity, not to a later account.
{
 const h=fixture(),gate=deferred();h.setAuthGate(gate.promise);const op=h.api.load();const rejection=assert.rejects(op,changed);
 await h.authStarted();h.setUser('B');gate.resolve();await rejection;
}
// Reads must reject account changes, even when a queued response was fetched under A.
for(const change of ['switch','signout','ABA','storage-before-event']){
 const h=fixture(),gate=deferred();h.setRow({data:{version:2},revision:1});h.setQueryGate(gate.promise);
 const op=h.api.load(),rejection=assert.rejects(op,changed);await h.queryStarted();
 if(change==='signout')h.setUser(null);else if(change==='ABA'){h.setUser('B');h.setUser('A');}else h.setUser('B',{emit:change!=='storage-before-event'});
 gate.resolve();await rejection;
}
// A same-account refresh keeps the already checked confirmation valid.
{
 const h=fixture(),gate=deferred();h.setQueryGate(gate.promise);const op=h.api.load();await h.queryStarted();h.refresh();gate.resolve();const remote=await op;h.api.assertCurrentContext(remote.context);await h.api.checkContext(remote.context);
 assert.ok(!JSON.stringify(remote.context).includes('sb_publishable_'));assert.ok(!JSON.stringify(remote.context).includes('access_token'));
}
// Synchronous checks reject stale identities/config at the local commit boundary.
for(const change of ['account','signout','ABA','storage-before-event','project','key','same-config','cross-tab-ABA']){
 const h=fixture(),remote=await h.api.load();await h.api.checkContext(remote.context);
 if(change==='account')h.setUser('B');
 else if(change==='signout')h.setUser(null);
 else if(change==='ABA'){h.setUser('B');h.setUser('A');}
 else if(change==='storage-before-event')h.setUser('B',{emit:false});
 else if(change==='project')h.api.configure('https://two.supabase.co','sb_publishable_fixture');
 else if(change==='key')h.api.configure('https://one.supabase.co','sb_publishable_rotated');
 else if(change==='same-config')h.api.configure('https://one.supabase.co','sb_publishable_fixture');
 else{h.map.set('sela.supabase.config.v1',JSON.stringify({url:'https://two.supabase.co',key:'sb_publishable_fixture'}));h.configEvent();h.map.set('sela.supabase.config.v1',JSON.stringify({url:'https://one.supabase.co',key:'sb_publishable_fixture'}));h.configEvent();}
 assert.throws(()=>h.api.assertCurrentContext(remote.context),changed,change);
}
// Invalidated SDK clients release their listener and stop refresh; recreated clients get new identities.
{
 const h=fixture(),remote=await h.api.load(),first=h.clients[0];h.api.configure('https://one.supabase.co','sb_publishable_fixture');
 assert.equal(first.unsubscribed,1);assert.equal(first.stopped,true);await h.api.load();assert.equal(h.clients.length,2);assert.throws(()=>h.api.assertCurrentContext(remote.context),changed);
}
// Run actual UI handlers after root applies the accompanying app guard.
if(!process.argv[3]){
 const {boot,subjectState}=await import(pathToFileURL(path.join(project,'tests','ui-harness.mjs')));
 const now=new Date(2026,9,1,10).getTime(),local=subjectState(now),remote=subjectState(now);
 local.tasks.push({id:'local',title:'Local fixture',date:'2026-10-01',subjectId:'math',done:false});remote.tasks.push({id:'remote',title:'A fixture',date:'2026-10-01',subjectId:'math',done:false});
 for(const change of ['account','project','storage-before-event','refresh']){
  const c=fixture();c.setRow({data:remote,revision:1});const entered=deferred(),release=deferred();
  // Exercise the legacy restore guard independently of automatic account initialisation.
  const h=boot(local,{now,cloud:{...c.api,watchAuth:undefined},lock:{request(name,fn){assert.equal(name,'sela.study.write');entered.resolve();return release.promise.then(fn);}}});
  await h.api.handleAction({dataset:{action:'nav',view:'settings'}});await h.api.handleAction({dataset:{action:'cloud-load'}});h.modal.form.fd={};
  const confirmation=h.modal.form.handler({preventDefault(){}});await entered.promise;
  if(change==='account')c.setUser('B');else if(change==='project')c.api.configure('https://two.supabase.co','sb_publishable_fixture');else if(change==='storage-before-event')c.setUser('B',{emit:false});else c.refresh();
  release.resolve();await confirmation;
  assert.equal(h.api.getState().tasks[0].id,change==='refresh'?'remote':'local',change);
  assert.equal(h.downloads.length,change==='refresh'?1:0,change);assert.equal(h.modal.open,change!=='refresh',change);
 }
}
console.log('PASS: getUser/query identity races, sign-out, ABA, delayed storage notifications, same-account refresh, synchronous context guards, connection generations and subscription cleanup'+(!process.argv[3]?', plus actual queued restore handlers.':'. Candidate module checks only; UI verification awaits the app guard.'));

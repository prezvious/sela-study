import {LocalisedError,message,messageText,setLocale} from '../dist/i18n.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/cloud.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replace("import('https://esm.sh/@supabase/supabase-js@2.57.4')",'mockImport()');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function boot(importer){
 const map=new Map(),made=[],writes=[];let userId='A',row=null,queryGate=null,rpcError=null,authFailure=null;
 const createClient=(url,key)=>{const c={url,key,stopped:false,auth:{stopAutoRefresh(){c.stopped=true;},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},getUser:async()=>({data:{user:{id:userId}}}),signOut:async()=>({}),signInWithPassword:async()=>({data:{session:{}},error:authFailure}),signUp:async()=>({data:{session:null},error:authFailure})},from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){if(queryGate)await queryGate;return {data:row};}}),rpc:async(name,args)=>{writes.push({url,userId,name,args});return {error:rpcError};}};made.push(c);return c;};
 const context=vm.createContext({LocalisedError,message,URL,atob,location:{origin:'http://localhost:4318'},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},mockImport:()=>importer?importer(createClient):Promise.resolve({createClient})});
 vm.runInContext(source+'\nglobalThis.api={getClient,configure,load,save,checkContext,authenticate,signOut};',context);
 context.api.configure('https://one.supabase.co','sb_publishable_test');
 return {api:context.api,map,made,writes,setUser:id=>userId=id,setRow:r=>row=r,setQueryGate:p=>queryGate=p,setRPCError:e=>rpcError=e,setAuthError:e=>authFailure=e};
}
// One initialization per configuration, never cache an earlier project after an in-flight change.
{
 const d=deferred(),h=boot(createClient=>d.promise.then(()=>({createClient})));
 const first=h.api.getClient(),same=h.api.getClient();h.api.configure('https://two.supabase.co','sb_publishable_test');const next=h.api.getClient();
 const checks=[assert.rejects(first,/Konfigurasi/),assert.rejects(same,/Konfigurasi/)];d.resolve();await Promise.all(checks);const c=await next;
 assert.equal(c.url,'https://two.supabase.co');assert.equal(h.made.length,1);assert.equal(await h.api.getClient(),c);
}
{
 const h=boot();const [a,b]=await Promise.all([h.api.getClient(),h.api.getClient()]);assert.equal(a,b);assert.equal(h.made.length,1);
 // The shared storage changes without calling configure in this tab.
 h.map.set('sela.supabase.config.v1',JSON.stringify({url:'https://two.supabase.co',key:'sb_publishable_new'}));const c=await h.api.getClient();assert.equal(c.url,'https://two.supabase.co');assert.ok(a.stopped);
 h.map.set('sela.supabase.config.v1',JSON.stringify({url:'https://two.supabase.co',key:'sb_publishable_rotated'}));assert.equal((await h.api.getClient()).key,'sb_publishable_rotated');assert.ok(c.stopped);
}
// Read context pins writes to both the confirmed account and project, including first backup.
{
 const h=boot(),remote=await h.api.load();assert.equal(remote.data,null);assert.equal(remote.revision,0);assert.equal(remote.context.userId,'A');
 h.setUser('B');await assert.rejects(h.api.save({version:2},remote.revision,remote.context),/Akun atau proyek/);assert.equal(h.writes.length,0);
 h.setUser('A');h.api.configure('https://two.supabase.co','sb_publishable_test');await assert.rejects(h.api.save({version:2},0,remote.context),/Akun atau proyek/);assert.equal(h.writes.length,0);
 const correct=await h.api.load();await h.api.save({version:2},0,correct.context);assert.equal(h.writes[0].args.p_expected_user_id,'A');assert.equal(h.writes[0].args.p_expected_revision,0);assert.equal(h.writes[0].url,'https://two.supabase.co');
 await assert.rejects(h.api.save({version:2},0),/Akun atau proyek/);
 h.setRPCError({message:'ACCOUNT_CHANGED'});await assert.rejects(h.api.save({version:2},0,correct.context),/Akun atau proyek/);
 h.setRPCError({message:'CLOUD_CONFLICT'});await assert.rejects(h.api.save({version:2},0,correct.context),/berubah dari perangkat lain/);
}
// An in-flight read from an invalidated client cannot become a new confirmation.
{
 const h=boot(),d=deferred();h.setQueryGate(d.promise);const op=h.api.load();await Promise.resolve();await Promise.resolve();await Promise.resolve();h.api.configure('https://two.supabase.co','sb_publishable_test');d.resolve();await assert.rejects(op,/Konfigurasi/);
}
// Initialization errors allow retries and credential validation remains strict.
{
 let offline=true;const h=boot(createClient=>offline?Promise.reject(Error('offline')):Promise.resolve({createClient}));await assert.rejects(h.api.getClient(),/Koneksi/);offline=false;assert.equal((await h.api.getClient()).url,'https://one.supabase.co');
 for(const url of ['http://one.supabase.co','https://one.supabase.co/path','https://supabase.co.evil.test'])assert.throws(()=>h.api.configure(url,'sb_publishable_test'),/HTTPS/);
 assert.throws(()=>h.api.configure('https://one.supabase.co','sb_secret_test'),/secret/);
 assert.ok(messageText(await h.api.authenticate('test@example.invalid','test-password','login')).includes('Terhubung'));assert.ok(messageText(await h.api.authenticate('test@example.invalid','test-password','signup')).includes('Periksa email'));await h.api.signOut();
}
// Auth codes select fixed messages; raw server wording is never shown in the app.
for(const locale of ['id-ID','en-GB','en-US','es-ES','fr-FR','ru-RU']){
 setLocale(locale,{persist:false});const h=boot();
 for(const [error,key] of [[{code:'invalid_credentials'},'error.authCredentials'],[{code:'email_not_confirmed'},'error.authUnconfirmed'],[{code:'weak_password'},'error.authWeak'],[{code:'over_request_rate_limit'},'error.authRate'],[{status:500},'error.cloudNetwork'],[{code:'unknown_code'},'error.authGeneric']]){
  h.setAuthError({...error,message:'Raw English from server'});await assert.rejects(h.api.authenticate('test@example.invalid','test-password','login'),e=>e.key===key&&!e.message.includes('Raw English'));
 }
}
setLocale('id-ID',{persist:false});
console.log('PASS: cloud initialization races, deduplication, cross-tab config/key changes, account/project pinning, first backup, RPC guard/conflict, invalidated read, retry, credential validation and localised Auth error codes in six languages.');

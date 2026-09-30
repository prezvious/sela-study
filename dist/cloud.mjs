import {LocalisedError,message} from './i18n.mjs';
const KEY='sela.supabase.config.v1';
const CONFIG_CHANGED='error.configChanged';
const ACCOUNT_CHANGED='error.accountChanged';
let clientEntry=null,pendingEntry=null,connectionId=0;
export function getConfig(){try{const v=JSON.parse(localStorage.getItem(KEY));return v&&typeof v.url==='string'&&typeof v.key==='string'?v:{};}catch{return {};}}
const signature=({url='',key=''})=>url+'\n'+key;
function clearClient(){const entry=clientEntry;clientEntry=null;pendingEntry=null;entry?.subscription?.unsubscribe();entry?.client.auth.stopAutoRefresh();}
function observeIdentity(entry,userId){if(entry.userId!==undefined&&entry.userId!==userId)entry.identityRevision++;entry.userId=userId;}
function storedUser(entry){try{const raw=localStorage.getItem(entry.storageKey);if(!raw)return null;const userId=JSON.parse(raw)?.user?.id;return typeof userId==='string'?userId:null;}catch{return undefined;}}
globalThis.window?.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)clearClient();});
export function configure(url,key){
 url=String(url).trim().replace(/\/$/,'');key=String(key).trim();let parsed;
 try{parsed=new URL(url)}catch{throw new LocalisedError('error.cloudUrl');}
 if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password||parsed.port)throw new LocalisedError('error.cloudHttps');
 if(!key||key.startsWith('sb_secret_'))throw new LocalisedError('error.cloudSecret');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)){
   let payload;try{const parts=key.split('.');if(parts.length!==3)throw Error();payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw new LocalisedError('error.cloudKey');}
   if(payload.role!=='anon')throw new LocalisedError('error.cloudAnon');
 }
 localStorage.setItem(KEY,JSON.stringify({url,key}));clearClient();
}
async function getClient(){
 const config=getConfig(),stamp=signature(config),{url,key}=config;
 if(!url||!key)throw new LocalisedError('error.cloudConfigure');
 if(clientEntry?.stamp===stamp)return clientEntry.client;
 if(clientEntry)clearClient();
 if(pendingEntry?.stamp===stamp)return pendingEntry.promise;
 const entry={stamp,promise:null};pendingEntry=entry;
 entry.promise=(async()=>{
  let initializingClient=null;
  try{
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');
   if(signature(getConfig())!==stamp||pendingEntry!==entry)throw new LocalisedError(CONFIG_CHANGED);
   const storageKey='sela.supabase.auth.'+new URL(url).hostname;
   const client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey}});initializingClient=client;
   const connection={stamp,client,storageKey,id:++connectionId,userId:undefined,identityRevision:0,subscription:null};
   connection.subscription=client.auth.onAuthStateChange((event,session)=>observeIdentity(connection,session?.user?.id||null)).data.subscription;
   clientEntry=connection;initializingClient=null;
   return client;
  }catch(error){initializingClient?.auth.stopAutoRefresh();if(error.key===CONFIG_CHANGED)throw error;throw new LocalisedError('error.cloudNetwork');}
  finally{if(pendingEntry===entry)pendingEntry=null;}
 })();
 return entry.promise;
}
function assertClient(c){if(clientEntry?.client!==c||clientEntry.stamp!==signature(getConfig()))throw new LocalisedError(CONFIG_CHANGED);}
export async function authenticate(email,password,mode){const c=await getClient();assertClient(c);const {data,error}=mode==='signup'?await c.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}):await c.auth.signInWithPassword({email,password});assertClient(c);if(error)throw authError(error);return data.session?message('cloud.signedIn',{email}):message('cloud.confirmEmail');}
async function current(){
 const c=await getClient();assertClient(c);const entry=clientEntry,identityRevision=entry.identityRevision,storedUserId=storedUser(entry);
 const {data,error}=await c.auth.getUser();assertClient(c);if(error||!data.user)throw new LocalisedError('error.cloudSignIn');
 const storedNow=storedUser(entry);
 if(entry.identityRevision!==identityRevision||(entry.userId!==undefined&&entry.userId!==data.user.id)||(storedUserId&&storedNow!==storedUserId)||(storedNow&&storedNow!==data.user.id))throw new LocalisedError(ACCOUNT_CHANGED);
 observeIdentity(entry,data.user.id);
 return {c,user:data.user,context:{project:getConfig().url,userId:data.user.id,connection:entry.id,identityRevision:entry.identityRevision,storedUserId:storedNow}};
}
function assertContext(actual,expected){if(!expected||actual.project!==expected.project||actual.userId!==expected.userId||actual.connection!==expected.connection||actual.identityRevision!==expected.identityRevision)throw new LocalisedError(ACCOUNT_CHANGED);}
export function assertCurrentContext(expected){
 const entry=clientEntry;if(!entry)throw new LocalisedError(ACCOUNT_CHANGED);assertClient(entry.client);
 const storedNow=storedUser(entry);
 assertContext({project:getConfig().url,userId:entry.userId,connection:entry.id,identityRevision:entry.identityRevision},expected);
 if((expected.storedUserId&&storedNow!==expected.storedUserId)||(storedNow&&storedNow!==expected.userId))throw new LocalisedError(ACCOUNT_CHANGED);
}
export async function checkContext(expected){const result=await current();assertContext(result.context,expected);assertCurrentContext(expected);return result;}
export async function load(){const {c,user,context}=await current();const {data,error}=await c.from('study_data').select('data,revision,updated_at').eq('user_id',user.id).maybeSingle();assertClient(c);assertCurrentContext(context);if(error)throw new LocalisedError('error.cloudLoad');return {...(data||{data:null,revision:0}),context};}
export async function save(data,revision,expected){const {c,user}=await checkContext(expected);assertClient(c);assertCurrentContext(expected);const {error}=await c.rpc('save_study_data',{p_data:data,p_expected_revision:revision,p_expected_user_id:user.id});if(error){if(String(error.message||'').includes('ACCOUNT_CHANGED'))throw new LocalisedError(ACCOUNT_CHANGED);if(String(error.message||'').includes('CLOUD_CONFLICT'))throw new LocalisedError('error.cloudConflict');throw new LocalisedError('error.cloudSave');}assertClient(c);assertCurrentContext(expected);}
export async function signOut(){const c=await getClient();const {error}=await c.auth.signOut();assertClient(c);if(error)throw new LocalisedError('error.cloudOut');}

function authError(error){
 const codes={invalid_credentials:'error.authCredentials',email_not_confirmed:'error.authUnconfirmed',user_already_exists:'error.authExists',email_exists:'error.authExists',weak_password:'error.authWeak',over_request_rate_limit:'error.authRate',over_email_send_rate_limit:'error.authRate',over_sms_send_rate_limit:'error.authRate',signup_disabled:'error.authDisabled',email_provider_disabled:'error.authDisabled',user_banned:'error.authBanned',email_address_invalid:'error.authEmail',email_address_not_authorized:'error.authEmail',session_expired:'error.authExpired',session_not_found:'error.authExpired',refresh_token_not_found:'error.authExpired',refresh_token_already_used:'error.authExpired'};
 return new LocalisedError(codes[error.code]||(error.status===429?'error.authRate':error.status>=500?'error.cloudNetwork':'error.authGeneric'));
}

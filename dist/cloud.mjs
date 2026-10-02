import {LocalisedError,message} from './i18n.mjs';
const KEY='sela.supabase.config.v1';
const CONFIG_CHANGED='error.configChanged';
const ACCOUNT_CHANGED='error.accountChanged';
export const DEFAULT_CONFIG=Object.freeze({url:'https://ivpfjzzthdwayvygahbx.supabase.co',key:'sb_publishable_a2GpBJTv5TxDh5QSJZh6nw_gWs4x54G'});
const authListeners=new Set();
let clientEntry=null,pendingEntry=null,connectionId=0;
export function getConfig(){try{const v=JSON.parse(localStorage.getItem(KEY));return v&&typeof v.url==='string'&&typeof v.key==='string'?v:{...DEFAULT_CONFIG};}catch{return {...DEFAULT_CONFIG};}}
function publishAuth(user,event='INITIAL_SESSION',error=null,connection=clientEntry){const stamp=signature(getConfig()),revision=connection?.identityRevision;Promise.resolve().then(()=>{if(stamp!==signature(getConfig())||connection&&(clientEntry!==connection||connection.identityRevision!==revision))return;for(const listener of authListeners)listener({user,event,error,project:getConfig().url});});}
export function watchAuth(listener){authListeners.add(listener);try{const user=JSON.parse(localStorage.getItem('sela.supabase.auth.'+new URL(getConfig().url).hostname))?.user;if(typeof user?.id==='string')publishAuth(user,'CACHED_SESSION');}catch{}refreshAuth();return ()=>authListeners.delete(listener);}
export async function refreshAuth(){try{const c=await getClient(),entry=clientEntry,revision=entry.identityRevision;const {data,error}=await c.auth.getSession();assertClient(c);if(entry.identityRevision!==revision)return;if(error)throw authError(error);publishAuth(data.session?.user||null);}catch(error){publishAuth(null,'ERROR',error);}}
function returnUrl(){const url=new URL(location.href||location.origin+'/');url.hash='';url.search='';return url.href;}
const signature=({url='',key=''})=>url+'\n'+key;
function clearClient(){const entry=clientEntry;clientEntry=null;pendingEntry=null;entry?.subscription?.unsubscribe();entry?.client.auth.stopAutoRefresh();if(authListeners.size){publishAuth(null,'CONFIG_CHANGED');refreshAuth();}}
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
   connection.subscription=client.auth.onAuthStateChange((event,session)=>{observeIdentity(connection,session?.user?.id||null);if(clientEntry===connection||event==='INITIAL_SESSION')publishAuth(session?.user||null,event,null,connection);}).data.subscription;
   clientEntry=connection;initializingClient=null;
   return client;
  }catch(error){initializingClient?.auth.stopAutoRefresh();if(error.key===CONFIG_CHANGED)throw error;throw new LocalisedError('error.cloudNetwork');}
  finally{if(pendingEntry===entry)pendingEntry=null;}
 })();
 return entry.promise;
}
function assertClient(c){if(clientEntry?.client!==c||clientEntry.stamp!==signature(getConfig()))throw new LocalisedError(CONFIG_CHANGED);}
export async function authenticate(email,password,mode){const c=await getClient();assertClient(c);const {data,error}=mode==='signup'?await c.auth.signUp({email:String(email).trim(),password,options:{emailRedirectTo:returnUrl()}}):await c.auth.signInWithPassword({email:String(email).trim(),password});assertClient(c);if(error)throw authError(error);return data.session?message('cloud.signedIn',{email}):message('cloud.confirmEmail');}
export async function requestReset(email){const c=await getClient();const {error}=await c.auth.resetPasswordForEmail(String(email).trim(),{redirectTo:returnUrl()});assertClient(c);if(error)throw authError(error);return message('account.resetSent');}
export async function updatePassword(password){const c=await getClient();const {error}=await c.auth.updateUser({password});assertClient(c);if(error)throw authError(error);return message('account.passwordUpdated');}
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
export async function save(data,revision,expected){const {c,user}=await checkContext(expected);assertClient(c);assertCurrentContext(expected);const {data:nextRevision,error}=await c.rpc('save_study_data',{p_data:data,p_expected_revision:revision,p_expected_user_id:user.id});if(error){if(String(error.message||'').includes('ACCOUNT_CHANGED'))throw new LocalisedError(ACCOUNT_CHANGED);if(String(error.message||'').includes('CLOUD_CONFLICT'))throw new LocalisedError('error.cloudConflict');throw new LocalisedError('error.cloudSave');}assertClient(c);assertCurrentContext(expected);return nextRevision??revision+1;}
export async function signOut(){const c=await getClient();const {error}=await c.auth.signOut();assertClient(c);if(error)throw new LocalisedError('error.cloudOut');}

function authError(error){
 const codes={invalid_credentials:'error.authCredentials',email_not_confirmed:'error.authUnconfirmed',user_already_exists:'error.authExists',email_exists:'error.authExists',weak_password:'error.authWeak',over_request_rate_limit:'error.authRate',over_email_send_rate_limit:'error.authRate',over_sms_send_rate_limit:'error.authRate',signup_disabled:'error.authDisabled',email_provider_disabled:'error.authDisabled',user_banned:'error.authBanned',email_address_invalid:'error.authEmail',email_address_not_authorized:'error.authEmail',session_expired:'error.authExpired',session_not_found:'error.authExpired',refresh_token_not_found:'error.authExpired',refresh_token_already_used:'error.authExpired'};
 return new LocalisedError(codes[error.code]||(error.status===429?'error.authRate':error.status>=500?'error.cloudNetwork':'error.authGeneric'));
}

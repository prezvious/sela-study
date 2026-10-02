// Browser-only SDK double. Requests stay on the intercepted local test origin.
export function createClient(url,key,{auth:options}){
 const listeners=new Set();let session=JSON.parse(localStorage.getItem(options.storageKey)||'null');
 const emit=event=>{for(const cb of listeners)cb(event,session);};
 const write=()=>{session?localStorage.setItem(options.storageKey,JSON.stringify(session)):localStorage.removeItem(options.storageKey);};
 window.addEventListener('storage',event=>{if(event.key===options.storageKey){session=JSON.parse(event.newValue||'null');emit(session?'SIGNED_IN':'SIGNED_OUT');}});
 const request=async(method,args={})=>{const result=await fetch('/__mock/data',{method,headers:{'content-type':'application/json','x-user':session?.user.id||''},...(method==='POST'?{body:JSON.stringify(args)}:{})});return result.json();};
 return {auth:{
  onAuthStateChange(cb){listeners.add(cb);queueMicrotask(()=>cb('INITIAL_SESSION',session));return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};},
  stopAutoRefresh(){},getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:session?.user||null}}),
  async signInWithPassword({email,password}){if(password!=='test-password')return {data:{},error:{code:'invalid_credentials'}};session={user:{id:email.startsWith('bob')?'B':'A',email}};write();emit('SIGNED_IN');return {data:{session}};},
  signUp:async()=>({data:{session:null}}),
  async signOut(){if(window.__fixtureSignOutFailure)return {error:{message:'fixture sign-out failure'}};session=null;write();emit('SIGNED_OUT');return {};},
  resetPasswordForEmail:async()=>({}),updateUser:async()=>({})
 },from(){let user;return {select(){return this;},eq(name,id){user=id;return this;},async maybeSingle(){const row=await request('GET');return {data:row.data};}};},rpc:async(name,args)=>request('POST',args)};
}

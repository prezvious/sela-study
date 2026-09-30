import http from 'node:http';
import fs from 'node:fs';
const module=fs.readFileSync(new URL('../dist/storage.mjs',import.meta.url));
const html=`<!doctype html><html lang="id"><meta charset="utf-8"><title>Uji penguncian lokal</title><h1>Uji fallback IndexedDB</h1><button id="run">Jalankan uji</button><pre id="result">Belum dijalankan.</pre><script type="module">
import {withStudyLock} from './storage.mjs';
document.querySelector('#run').onclick=async()=>{
 const button=document.querySelector('#run');button.disabled=true;const result=document.querySelector('#result');
 const original=Object.getOwnPropertyDescriptor(navigator,'locks');Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
 try{
  let count=0;const values=await Promise.all(Array.from({length:24},()=>withStudyLock(()=>++count)));
  if(count!==24||values.some((x,i)=>x!==i+1))throw Error('Transaksi tidak serial.');
  let expectedError=false;try{await withStudyLock(()=>{throw Error('Uji penolakan');});}catch(e){expectedError=e.message==='Uji penolakan';}
  const resumed=await withStudyLock(()=>++count);
  if(!expectedError||resumed!==25)throw Error('Lock tidak dilepas sesudah gagal.');
  result.textContent='PASS: 24 transaksi IndexedDB serial; penolakan diteruskan; transaksi berikutnya berhasil. Modul storage.mjs asli.';
 }catch(e){result.textContent='FAIL: '+e.message;}
 finally{if(original)Object.defineProperty(navigator,'locks',original);else delete navigator.locks;button.disabled=false;}
};
</script></html>`;
http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/storage.mjs'){res.setHeader('Content-Type','text/javascript');res.end(module);}else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}else{res.statusCode=404;res.end();}}).listen(4320,'127.0.0.1',()=>console.log('Lock smoke at http://127.0.0.1:4320/'));

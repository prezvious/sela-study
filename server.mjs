import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.sql':'text/plain; charset=utf-8','.json':'application/json'};
async function errorResponse(res,status){
 try{const page=await readFile(path.join(root,'error-page.html'),'utf8');res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page.replace('data-error-code="404"',`data-error-code="${status}"`));}
 catch{res.writeHead(status);res.end();}
}
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname),target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root+path.sep)){await errorResponse(res,403);return;}
  const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{await errorResponse(res,404);}
}).listen(4318,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4318'));

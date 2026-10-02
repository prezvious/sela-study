import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import http from 'node:http';
import path from 'node:path';
const modulePath=process.argv[2];if(!modulePath)throw Error('Pass the absolute path to playwright/index.mjs');
const {chromium}=await import(pathToFileURL(modulePath));
const root=fileURLToPath(new URL('../dist/',import.meta.url)),types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css'};
const preview=http.createServer(async(req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,'http://fixture.invalid').pathname),target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end();return;}const bytes=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(bytes);}
 catch{res.writeHead(404);res.end();}
});
await new Promise((resolve,reject)=>{preview.once('error',reject);preview.listen(0,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+preview.address().port;
const browser=await chromium.launch({headless:true,...(process.argv[3]?{channel:process.argv[3]}:{})}).catch(error=>{preview.close();throw error;});
const sdk=await fs.readFile(new URL('fixtures/account-sdk.mjs',import.meta.url),'utf8'),rows=new Map(),errors=[];
await fs.mkdir(new URL('../work/account-qa/',import.meta.url),{recursive:true});
async function context(width=1280){
 const c=await browser.newContext({viewport:{width,height:900}});
 await c.addInitScript(()=>localStorage.setItem('sela.locale.v1','en-GB'));
 await c.route('https://esm.sh/**',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
 await c.route('**/__mock/data',async route=>{
  const request=route.request(),user=request.headers()['x-user'];let response;
  if(request.method()==='GET')response={data:rows.get(user)||null};
  else{const args=request.postDataJSON(),row=rows.get(user);if((row?.revision||0)!==args.p_expected_revision)response={error:{message:'CLOUD_CONFLICT'}};else{const revision=(row?.revision||0)+1;rows.set(user,{data:args.p_data,revision});response={data:revision};}}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
 });
 return c;
}
async function page(c){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/');return p;}
async function waitGoal(p,goal){await p.waitForFunction(goal=>{const key=Object.keys(localStorage).find(key=>key.startsWith('sela.account.v1.')&&key.endsWith('.A'));return key&&JSON.parse(localStorage.getItem(key)).settings.goal===goal;},goal);}
async function login(p,email='alice@example.invalid'){
 await p.locator('.account-entry').click();await p.locator('#cloud-auth input[name=email]').fill(email);await p.locator('#cloud-auth input[name=password]').fill('test-password');await p.locator('#cloud-auth button[type=submit]').click();await p.locator('.account-email').waitFor();await p.waitForFunction(()=>document.querySelector('.sync-label')?.textContent==='Saved to your account');
}
try{
 const desktop=await context(),a=await page(desktop);await a.locator('.account-entry').click();await a.locator('[data-action="account-mode"][data-value="signup"]').click();
 await a.locator('#cloud-auth input[name=email]').fill('alice@example.invalid');await a.locator('#cloud-auth input[name=password]').fill('test-password');await a.locator('#cloud-auth input[name=confirmation]').fill('wrong-password');await a.locator('#cloud-auth button[type=submit]').click();await a.getByText('The passwords do not match.',{exact:true}).first().waitFor();
 await a.locator('#cloud-auth input[name=email]').fill('alice@example.invalid');await a.locator('#cloud-auth input[name=password]').fill('test-password');await a.locator('#cloud-auth input[name=confirmation]').fill('test-password');await a.locator('#cloud-auth button[type=submit]').click();await a.locator('.account-message').waitFor();assert.match(await a.locator('.account-message').innerText(),/email/i);
 await a.locator('[data-action="account-mode"][data-value="login"]').click();await a.locator('[data-action="account-mode"][data-value="reset"]').click();await a.locator('#cloud-auth input[name=email]').fill('alice@example.invalid');await a.locator('#cloud-auth button[type=submit]').click();await a.locator('.account-message').waitFor();assert.match(await a.locator('.account-message').innerText(),/reset link/i);
 await a.locator('[data-action="account-mode"][data-value="login"]').click();await a.screenshot({path:'work/account-qa/desktop-signin.png',fullPage:true});
 await login(a);await a.locator('[data-action="nav"][data-view="study"]').first().click();await a.locator('[data-action="add-subject"]').first().click();await a.locator('#modal input[name=name]').fill('Mathematics');await a.locator('#modal button[type=submit]').click();await a.locator('#modal').waitFor({state:'hidden'});await a.waitForFunction(()=>document.querySelector('.sync-label')?.textContent==='Saved to your account');assert.equal(rows.get('A').data.subjects[0].name,'Mathematics');

 // Clean polls leave the existing date input connected and keep its partial draft.
 const originalDate=await a.locator('#task-date').inputValue(),input=await a.locator('#task-date').elementHandle();
 await a.locator('#task-date').fill('02/');await a.waitForTimeout(11000);
 assert.equal(await input.evaluate(node=>node.isConnected),true);assert.equal(await a.locator('#task-date').inputValue(),'02/');
 // A real remote update still preserves the draft and its focus.
 rows.get('A').data.settings.goal=45;rows.get('A').revision++;await waitGoal(a,45);
 assert.equal(await a.locator('#task-date').inputValue(),'02/');assert.equal(await a.evaluate(()=>document.activeElement.id),'task-date');
 await a.locator('#task-date').fill(originalDate);await a.locator('#task-date').press('Tab');
 await a.locator('[data-date-open="task-date"]').click();await a.locator('[data-date-month="1"]').click();
 const pickerMonth=await a.locator('.date-picker-top strong').innerText();
 rows.get('A').data.settings.goal=60;rows.get('A').revision++;await waitGoal(a,60);
 assert.equal(await a.locator('.date-picker').count(),1);assert.equal(await a.locator('.date-picker-top strong').innerText(),pickerMonth);
 await a.keyboard.press('Escape');
 // Modal pickers also survive remote updates and locale-driven redraws.
 await a.locator('[data-action="add-task"]').click();await a.locator('#modal input[name=title]').fill('Unsaved modal draft');
 await a.locator('[data-date-open="task-edit-date"]').click();await a.locator('#modal [data-date-month="1"]').click();
 const modalMonth=await a.locator('#modal .date-picker-top strong').innerText();
 rows.get('A').data.settings.goal=75;rows.get('A').revision++;await waitGoal(a,75);
 assert.equal(await a.locator('#modal .date-picker').count(),1);assert.equal(await a.locator('#modal .date-picker-top strong').innerText(),modalMonth);
 assert.equal(await a.locator('#modal input[name=title]').inputValue(),'Unsaved modal draft');
 await a.locator('#modal [data-date-close]').focus();rows.get('A').data.settings.goal=90;rows.get('A').revision++;await waitGoal(a,90);
 assert.equal(await a.evaluate(()=>document.activeElement.hasAttribute('data-date-close')),true);
 await a.locator('#modal .date-picker [role=gridcell][tabindex="0"]').focus();
 const pickerFocus=await a.evaluate(()=>document.activeElement.dataset.datePick);
 await a.evaluate(async()=>{const {setLocale}=await import('./i18n.mjs');setLocale('fr-FR');});
 assert.equal(await a.locator('#modal .date-picker').count(),1);assert.equal(await a.evaluate(()=>document.activeElement.dataset.datePick),pickerFocus);
 await a.evaluate(async()=>{const {setLocale}=await import('./i18n.mjs');setLocale('en-GB');});
 await a.locator('#modal [data-action="close-modal"]').first().click();
 await a.waitForFunction(()=>document.querySelector('.sync-label')?.textContent==='Saved to your account');
 const mobile=await context(390),b=await page(mobile);await b.locator('.account-entry').click();await b.screenshot({path:'work/account-qa/mobile-signin.png',fullPage:true});assert.ok(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await login(b);await b.locator('[data-action="nav"][data-view="study"]').first().click();assert.ok(await b.locator('#timer-subject').innerText().then(t=>t.includes('Mathematics')));
 await a.locator('[data-action="toggle-timer"]').click();await a.waitForFunction(()=>document.querySelector('.sync-label')?.textContent==='Saved to your account');await b.locator('.account-entry').click();await b.locator('[data-action="sync-now"]').click();await b.locator('[data-action="nav"][data-view="study"]').first().click();await b.waitForFunction(()=>document.querySelector('[data-action="toggle-timer"]')?.dataset.running==='true');
 await b.locator('[data-action="toggle-timer"]').click();await b.waitForFunction(()=>document.querySelector('.sync-label')?.textContent==='Saved to your account');await a.locator('.account-entry').click();await a.locator('[data-action="sync-now"]').click();await a.locator('[data-action="nav"][data-view="study"]').first().click();await a.waitForFunction(()=>document.querySelector('[data-action="toggle-timer"]')?.dataset.running==='false');
 await a.locator('.account-entry').click();await a.screenshot({path:'work/account-qa/desktop-account.png',fullPage:true});await b.locator('.account-entry').click();await b.screenshot({path:'work/account-qa/mobile-account.png',fullPage:true});assert.ok(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Repair a damaged metadata envelope without losing the paused stopwatch or records.
 const corrupt=await b.evaluate(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('sela.account.v1.')&&key.endsWith('.A')),doc=JSON.parse(localStorage.getItem(key));doc._sync.revision=-1;const raw=JSON.stringify(doc);localStorage.setItem(key,raw);return raw;});
 await b.reload();await b.locator('[data-action="repair-account-cache"]').waitFor();
 const [backup]=await Promise.all([b.waitForEvent('download'),b.locator('[data-action="repair-account-cache"]').click()]);
 assert.equal(await fs.readFile(await backup.path(),'utf8'),corrupt);
 await b.waitForFunction(()=>document.querySelector('.sync-label')?.textContent==='Saved to your account');
 const repaired=await b.evaluate(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('sela.account.v1.')&&key.endsWith('.A'));return JSON.parse(localStorage.getItem(key));});
 assert.deepEqual(repaired.timer,JSON.parse(corrupt).timer);assert.deepEqual(repaired.subjects,JSON.parse(corrupt).subjects);
 await b.locator('.account-entry').click();
 await b.evaluate(()=>window.__fixtureSignOutFailure=true);await b.locator('[data-action="cloud-out"]').click();
 await b.waitForFunction(()=>document.querySelector('#toast')?.textContent==='Could not sign out of Supabase. Try again.');
 assert.equal(await b.locator('[data-action="cloud-out"]').isEnabled(),true);await b.evaluate(()=>window.__fixtureSignOutFailure=false);
 await b.locator('[data-action="cloud-out"]').click();await b.locator('#cloud-auth').waitFor();
 await b.waitForFunction(()=>document.querySelector('#cloud-auth input[name=email]')?.disabled===false);
 assert.equal(await b.locator('#cloud-auth input[name=password]').isEnabled(),true);assert.equal(await b.locator('#cloud-auth button[type=submit]').isEnabled(),true);
 await login(b,'bob@example.invalid');assert.equal(rows.get('B').data.subjects.length,0);await b.locator('[data-action="nav"][data-view="study"]').first().click();assert.equal(await b.locator('#timer-subject').innerText(),'Add a subject');
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile Auth and timer sync, unchanged/changed polls preserve date drafts/focus/picker month, modal picker locale redraw, metadata repair and original-byte download, failed/successful sign-out controls, account isolation, no page errors or horizontal overflow. SDK/server are intercepted fixtures.');
}finally{await browser.close();preview.closeAllConnections();await new Promise(resolve=>preview.close(resolve));}

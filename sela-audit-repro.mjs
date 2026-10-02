import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const ownDir=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(process.argv[2]||(fs.existsSync(path.join(ownDir,'dist'))?ownDir:'C:/Users/camar/Documents/Coding/sela-study'));
const names=['core','regressions','empty-state','ui-regressions','backup','storage','hidden-ui','cloud','sync','localisation','audit-regressions','cloud-audit','ui-audit','confirmed-bugs','stress'];
const evidence={phase:'after-2026-10-03-confirmed-fixes',checkedAt:new Date().toISOString(),node:process.version,project,tests:[]};
for(const name of names){
 const file=path.join(project,'tests',name+'.test.mjs');
 try{const output=execFileSync(process.execPath,[file],{cwd:project,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});evidence.tests.push({name,result:'PASS',output:output.trim()});process.stdout.write(output);}
 catch(error){evidence.tests.push({name,result:'FAIL',output:String(error.stdout||error.message)});process.exitCode=1;break;}
}
evidence.result=evidence.tests.length===names.length&&evidence.tests.every(x=>x.result==='PASS')?'PASS':'FAIL';
fs.writeFileSync(path.join(ownDir,'sela-fix-evidence.json'),JSON.stringify(evidence,null,2));
console.log(evidence.result+': '+evidence.tests.length+'/'+names.length+' regression scripts; fixes and verification are documented in FIX-VERIFICATION-2026-10-03.md; stress coverage is documented in STRESS-TESTS.md.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newState,restoreLocalState,startTimer,pauseTimer,finishTimer,validateState} from '../dist/core.mjs';
import {studyState} from './fixtures.mjs';
const now=Date.now()-120000;
function empty(s){assert.equal(s.version,2);for(const k of ['subjects','tasks','sessions'])assert.deepEqual(s[k],[]);assert.equal(s.timer.subjectId,'');assert.equal(s.timer.startedAt,null);assert.equal(s.timer.elapsedMs,0);assert.ok(!('demo' in s));validateState(s);}
empty(newState());empty(restoreLocalState(null).state);
const legacy=studyState(now);startTimer(legacy,now);pauseTimer(legacy,now+30000);startTimer(legacy,now+60000);legacy.tasks.push({id:'old-task',title:'Old task',date:'2026-09-30',done:false,subjectId:legacy.subjects[0].id});legacy.settings.theme='dark';legacy.settings.themeKey='violet-ruler';legacy.settings.interfaceStyle='opaline';legacy.version=1;
for(const demo of [true,false]){
 const restored=restoreLocalState(JSON.stringify({...legacy,demo}));assert.equal(restored.reset,true);empty(restored.state);assert.deepEqual(restored.state.settings,legacy.settings);
 const repeated=restoreLocalState(JSON.stringify(restored.state));assert.equal(repeated.reset,false);empty(repeated.state);
}
const personal=studyState(now);startTimer(personal,now);finishTimer(personal,now+45000);const retained=restoreLocalState(JSON.stringify(personal));assert.equal(retained.reset,false);assert.equal(retained.state.sessions[0].durationMs,45000);assert.equal(retained.state.subjects.length,4);
assert.throws(()=>validateState({...legacy,demo:true}),/contoh/);assert.equal(validateState({...personal,version:1}).version,2);
empty(restoreLocalState(JSON.stringify({version:1,subjects:'broken'})).state);
const app=fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');assert.ok(!/state\.demo|action==='demo'|action==='use-own'|Data contoh|Gunakan data saya|Lihat data contoh/.test(app));assert.ok(app.includes('restoreLocalState(storedRaw)'));
const core=fs.readFileSync(new URL('../dist/core.mjs',import.meta.url),'utf8');assert.ok(!/Latihan persamaan|if \(demo\)/.test(core));
console.log('PASS: completely empty new users, one-time reset of all legacy users, appearance preserved, new personal records retained, legacy demo imports rejected, and demo UI/generator removed.');

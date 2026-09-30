// Optional: pass the absolute path of an installed @electric-sql/pglite/dist/index.js.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite(),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; insert into auth.users values ('${A}'),('${B}'); create function public.save_study_data(jsonb,bigint) returns bigint language sql as $$select 0::bigint$$;`);
 const schema=fs.readFileSync(new URL('../dist/supabase-schema.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
 assert.equal((await db.query("select to_regprocedure('public.save_study_data(jsonb,bigint)') as old")).rows[0].old,null);
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const save=(rev,user=A,version=2)=>db.query('select public.save_study_data($1::jsonb,$2::bigint,$3::uuid) as revision',[JSON.stringify({version}),rev,user]);
 assert.equal((await save(0)).rows[0].revision,1);await assert.rejects(save(0),/CLOUD_CONFLICT/);assert.equal((await save(1)).rows[0].revision,2);await assert.rejects(save(1),/CLOUD_CONFLICT/);
 await assert.rejects(save(2,B),/ACCOUNT_CHANGED/);await assert.rejects(save(2,null),/ACCOUNT_CHANGED/);await assert.rejects(save(2,A,1),/INVALID_DATA/);assert.equal((await db.query('select revision from study_data')).rows[0].revision,2);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);assert.equal((await db.query('select * from study_data')).rows.length,0);await assert.rejects(save(0,A),/ACCOUNT_CHANGED/);assert.equal((await save(0,B)).rows[0].revision,1);
 await assert.rejects(db.query('insert into study_data(user_id,data) values($1,$2)',[A,'{"version":2}']),/row-level security/);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(save(0,B),/AUTH_REQUIRED/);
 await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from study_data'),/permission denied/);await assert.rejects(save(0,B),/permission denied/);
 console.log('PASS: PostgreSQL schema installation/rerun, old signature removal, insert/update revisions, stale revision rejection, account guard, invalid data, RLS isolation, anonymous restrictions and missing auth.');
}finally{await db.close();}

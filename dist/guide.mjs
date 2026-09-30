import {LANGUAGES,getLocale,setLocale,onLocaleChange,t,applyDocumentLocale} from './i18n.mjs';
import {esc} from './core.mjs';
import {applySavedAppearance,observeSavedAppearance} from './saved-appearance.mjs';
const guide=document.querySelector('#guide');
function renderGuide(){
 applyDocumentLocale();applySavedAppearance();document.title=t('guide.title')+' — sela.';
 const ht=(key,params)=>esc(t(key,params)),link=(url,key,extra='')=>`<a href="${url}" ${extra}>${ht(key)}</a>`;
 guide.innerHTML=`<header class="guide-header"><a href="/">${ht('guide.back')}</a><label>${ht('settings.language')}<select id="guide-language">${LANGUAGES.map(l=>`<option value="${l.code}" lang="${l.code}" ${l.code===getLocale()?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label></header><h1>${ht('guide.title')}</h1><p>${ht('guide.intro')}</p><ol><li>${t('guide.step1',{dashboard:link('https://supabase.com/dashboard','guide.dashboard','target="_blank" rel="noopener"')})}</li><li>${t('guide.step2',{schema:'<a href="supabase-schema.sql" download>supabase-schema.sql</a>'})}</li><li>${ht('guide.step3')}</li><li>${t('guide.step4',{url:`<code>${esc(location.origin)}</code>`})}</li><li>${ht('guide.step5')}</li><li>${t('guide.step6',{save:`<strong>${ht('cloud.save')}</strong>`,load:`<strong>${ht('cloud.load')}</strong>`})}</li></ol><h2>${ht('guide.storageTitle')}</h2><p>${ht('guide.storageText')}</p><h2>${ht('guide.failureTitle')}</h2><p>${ht('guide.failureText')}</p><h2>${ht('guide.references')}</h2><ul><li>${link('https://supabase.com/docs/reference/javascript/auth-signinwithpassword','guide.authReference','target="_blank" rel="noopener"')}</li><li>${link('https://supabase.com/docs/guides/database/postgres/row-level-security','guide.rlsReference','target="_blank" rel="noopener"')}</li></ul>`;
}
guide.addEventListener('change',e=>{if(e.target.id==='guide-language')setLocale(e.target.value);});onLocaleChange(renderGuide);
observeSavedAppearance();renderGuide();
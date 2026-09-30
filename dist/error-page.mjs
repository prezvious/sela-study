import {LANGUAGES,getLocale,setLocale,onLocaleChange,t,applyDocumentLocale} from './i18n.mjs';
import {applySavedAppearance,observeSavedAppearance} from './saved-appearance.mjs';
const errorPage=document.querySelector('#error-page'),errorCode=document.body.dataset.errorCode==='403'?'403':'404';
function renderErrorPage(){
 applyDocumentLocale();applySavedAppearance();document.title=t('errorPage.title'+errorCode)+' — sela.';
 errorPage.innerHTML=`<header class="guide-header"><a href="/">${t('guide.back')}</a><label>${t('settings.language')}<select id="error-language">${LANGUAGES.map(l=>`<option value="${l.code}" lang="${l.code}" ${l.code===getLocale()?'selected':''}>${l.name}</option>`).join('')}</select></label></header><h1>${t('errorPage.title'+errorCode)}</h1><p>${t('errorPage.text'+errorCode)}</p>`;
}
errorPage.addEventListener('change',event=>{if(event.target.id==='error-language')setLocale(event.target.value);});onLocaleChange(renderErrorPage);observeSavedAppearance();renderErrorPage();

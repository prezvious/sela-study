import {getThemeTokens} from './vendor/themes.mjs';
export function applySavedAppearance(){
 let settings={};try{settings=JSON.parse(localStorage.getItem('sela.study.v1'))?.settings||{};}catch{}
 const mode=settings.theme==='dark'||settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
 const tokens=getThemeTokens(settings.themeKey||'carbon-paper',mode);
 for(const [key,value] of Object.entries(tokens))if(typeof value==='string')document.documentElement.style.setProperty('--'+key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),value);
 document.documentElement.style.colorScheme=mode;
}
export function observeSavedAppearance(){window.addEventListener('storage',event=>{if(event.key==='sela.study.v1'||event.key===null)applySavedAppearance();});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applySavedAppearance);}

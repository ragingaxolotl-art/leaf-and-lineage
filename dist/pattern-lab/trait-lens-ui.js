(async function(){
'use strict';
await globalThis.PatternLabReady;
const A=PatternLabApp,L=PatternTraitLens,B=PatternBeetles,R=PatternSumoRating,$=id=>document.getElementById(id),popup=$('trait-lens-popup'),enabled=$('trait-lens-enabled');
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let choices=[],keys=['size','antennaLength','horn'],selected=null,anchor={x:0,y:0},lastBox=null;
const full=()=>A.canViewGenetics();
function hide(){popup.hidden=true;selected=null;}
function position(){const w=popup.offsetWidth,h=popup.offsetHeight;popup.style.left=Math.max(8,Math.min(innerWidth-w-8,anchor.x+18))+'px';popup.style.top=Math.max(8,Math.min(innerHeight-h-8,anchor.y+14))+'px';}
function show(id,box){if(!enabled.checked||A.isBlocked())return hide();const modal=document.querySelector('dialog[open]');if(modal&&modal.id!=='keep')return hide();const b=A.getState().beetles[id];if(!b)return hide();const parent=box.id==='keep-bugs'?$('keep'):document.body;if(popup.parentElement!==parent)parent.append(popup);selected=id;lastBox=box;const values=L.rows(b,keys.filter(Boolean),{full:full()});popup.innerHTML=R.markup(R.evaluate(b))+'<div class="lens-portrait">'+B.draw(b,'lens')+'</div><div class="lens-readings"><strong>'+esc(b.name?b.name+' · '+b.id:b.id)+'</strong><dl>'+values.map(t=>'<div><dt>'+esc(t.label)+'</dt><dd><b>'+esc(t.display)+'</b>'+(t.unit?'<small>'+esc(t.unit)+'</small>':'')+'</dd></div>').join('')+'</dl></div>';popup.hidden=false;position();}
const inputs=[1,2,3].map(i=>$('lens-trait-'+i));
let openSlot=-1,active=-1,filtered=[];
function closeMenus(){for(let i=0;i<3;i++){inputs[i].setAttribute('aria-expanded','false');inputs[i].removeAttribute('aria-activedescendant');$('lens-options-'+(i+1)).hidden=true;}openSlot=-1;active=-1;}
function labelFor(key){return choices.find(t=>t.key===key)?.label||'';}
function menu(i,query=''){
 closeMenus();openSlot=i;
 filtered=[{key:'',label:'No trait'},...choices.filter(t=>!keys.some((k,j)=>j!==i&&k===t.key))].filter(t=>t.label.toLowerCase().includes(query.toLowerCase()));
 const list=$('lens-options-'+(i+1));
 list.innerHTML=filtered.length?filtered.map((t,n)=>'<span role="option" id="lens-option-'+i+'-'+n+'" data-lens-choice="'+n+'" aria-selected="'+String(t.key===keys[i])+'">'+esc(t.label)+'</span>').join(''):'<span class="lens-empty">No matching traits</span>';
 list.hidden=false;inputs[i].setAttribute('aria-expanded','true');
}
function choose(i,n){const t=filtered[n];if(!t)return;keys[i]=t.key;inputs[i].value=t.label==='No trait'?'':t.label;closeMenus();inputs[i].removeAttribute('aria-invalid');if(selected&&lastBox)show(selected,lastBox);}
function populate(){choices=L.options(full()).sort((a,b)=>a.label.localeCompare(b.label));keys=Array.from({length:3},(_,i)=>choices.some(t=>t.key===keys[i])?keys[i]:'');for(let i=0;i<3;i++){if(document.activeElement!==inputs[i])inputs[i].value=labelFor(keys[i]);inputs[i].disabled=A.isBlocked();}enabled.disabled=A.isBlocked();if(selected&&lastBox){const live=lastBox.querySelector(lastBox.id==='jars'?'.parent-bug[data-inspect="'+selected+'"]':'[data-id="'+selected+'"],[data-keep="'+selected+'"]');if(live)show(selected,lastBox);else hide();}}
for(let i=0;i<3;i++){
 const input=inputs[i],list=$('lens-options-'+(i+1));
 input.addEventListener('click',()=>menu(i));
 input.addEventListener('input',()=>menu(i,input.value));
 input.addEventListener('blur',()=>{input.value=labelFor(keys[i]);closeMenus();});
 document.querySelector('[data-lens-open="'+(i+1)+'"]').addEventListener('mousedown',e=>e.preventDefault());
 document.querySelector('[data-lens-open="'+(i+1)+'"]').addEventListener('click',()=>{if(A.isBlocked())return;const wasOpen=openSlot===i;input.focus();if(wasOpen)closeMenus();else menu(i);});
 list.addEventListener('mousedown',e=>e.preventDefault());
 list.addEventListener('click',e=>{const option=e.target.closest('[data-lens-choice]');if(option){e.preventDefault();choose(i,Number(option.dataset.lensChoice));}});
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape'){input.value=labelFor(keys[i]);closeMenus();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(openSlot!==i)menu(i);if(!filtered.length)return;active=(active+(e.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length;for(const [n,el] of [...list.querySelectorAll('[role="option"]')].entries())el.classList.toggle('active',n===active);const option=$('lens-option-'+i+'-'+active);input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
  if(e.key==='Enter'&&openSlot===i){e.preventDefault();const n=active>=0?active:filtered.findIndex(t=>t.label.toLowerCase()===input.value.toLowerCase());if(n>=0)choose(i,n);}
 });
}
const sources=['tank-bugs','keep-bugs','jars'];
const target=(box,node)=>box.id==='jars'?node.closest('.parent-bug[data-inspect]'):node.closest('button[data-id],button[data-keep]');
const targetId=bug=>bug.dataset.id||bug.dataset.keep||bug.dataset.inspect;
enabled.onchange=()=>{for(const id of sources)$(id).classList.toggle('lens-active',enabled.checked);if(!enabled.checked)hide();};
for(const id of sources){const box=$(id);
 box.addEventListener('pointermove',e=>{if(!enabled.checked||e.buttons)return;anchor={x:e.clientX,y:e.clientY};const bug=target(box,e.target);if(bug){if(targetId(bug)!==selected)show(targetId(bug),box);else if(selected&&!popup.hidden)position();}else if(id==='jars')hide();else if(selected&&!popup.hidden)position();});
 box.addEventListener('focusin',e=>{const bug=target(box,e.target);if(!bug){if(id==='jars')hide();return;}const r=bug.getBoundingClientRect();anchor={x:r.right,y:r.top};show(targetId(bug),box);});
 box.addEventListener('focusout',e=>{if(!e.relatedTarget||!box.contains(e.relatedTarget)||id==='jars'&&!target(box,e.relatedTarget))hide();});
 box.addEventListener('pointerleave',hide);box.addEventListener('pointerdown',hide);
}
window.addEventListener('scroll',()=>{const bug=lastBox&&document.activeElement&&lastBox.contains(document.activeElement)?target(lastBox,document.activeElement):null;if(selected&&bug&&targetId(bug)===selected){const r=bug.getBoundingClientRect();anchor={x:r.right,y:r.top};position();}else hide();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('#trait-lens-controls'))hide();});window.addEventListener('resize',hide);window.addEventListener('pattern-state',populate);document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});$('keep').addEventListener('close',hide);populate();
})();

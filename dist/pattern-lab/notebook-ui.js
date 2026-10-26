(async function(){
'use strict';
await globalThis.PatternLabReady;
const N=PatternNotebook,A=PatternLabApp,$=id=>document.getElementById(id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page=0,data=[];const PAGE=50;
const fmt=v=>v===null?'Unavailable':Number(v.toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4});
const filters=()=>({jar:$('notebook-jar').value,origin:$('notebook-origin').value,order:$('notebook-group').value});
function render(){
 const trait=N.byKey[$('notebook-trait').value];if(!trait)return;
 data=N.rows(A.getState(),trait.key,filters());
 const count=data.filter(r=>r.value!==null).length,missing=data.length-count,imported=data.filter(r=>r.origin==='imported').length;
 $('notebook-unit').textContent=trait.label+' · '+trait.unit;
 $('notebook-coverage').textContent=count+' measured beetles · '+missing+' unavailable older records · '+imported+' imported beetles. '+(missing?'Older missing measurements cannot be reconstructed. ':'')+'Retained measurements include beetles that have left the tank.';
 const pages=Math.max(1,Math.ceil(data.length/PAGE));page=Math.min(page,pages-1);
 $('notebook-rows').innerHTML=data.slice(page*PAGE,(page+1)*PAGE).map(r=>`<tr><td>${esc(r.name?r.name+' · '+r.id:r.id)}</td><td>${r.generation}</td><td>${r.round===null?'—':r.round}</td><td>${esc(r.jar||r.origin)}</td><td>${esc(r.status)}</td><td>${esc(fmt(r.value))}</td></tr>`).join('')||'<tr><td colspan="6">No individual measurements yet.</td></tr>';
 $('notebook-value-heading').textContent=trait.label;$('notebook-page').textContent=data.length+' beetles · page '+(page+1)+' of '+pages;$('notebook-prev').disabled=page===0;$('notebook-next').disabled=page===pages-1;
 $('notebook-raw-csv').disabled=data.length===0;
}
function download(){const key=$('notebook-trait').value,content=N.rawCSV(A.getState(),key,filters());const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Pattern-Lab-'+key+'-individuals.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('notebook-trait').innerHTML=[...new Set(N.traits.map(t=>t.group))].map(group=>`<optgroup label="${esc(group)}">${N.traits.filter(t=>t.group===group).map(t=>`<option value="${t.key}">${esc(t.label)}</option>`).join('')}</optgroup>`).join('');
$('notebook-open').onclick=()=>{page=0;render();$('trait-notebook').showModal();};
for(const id of ['notebook-trait','notebook-group','notebook-jar','notebook-origin'])$(id).onchange=()=>{page=0;render();};
$('notebook-prev').onclick=()=>{page--;render();};$('notebook-next').onclick=()=>{page++;render();};
$('notebook-raw-csv').onclick=download;
window.addEventListener('pattern-state',()=>{if($('trait-notebook').open)render();});
})();

(function(){
'use strict';
const N=PatternNotebook,A=PatternLabApp,$=id=>document.getElementById(id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let page=0,data=[],summary=[],chartId=0;const PAGE=50;
const fmt=v=>v===null?'Unavailable':Number(v.toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4});
const filters=()=>({jar:$('notebook-jar').value,origin:$('notebook-origin').value});
const groupLabel=()=> $('notebook-group').value==='round'?'Breeding round':'Lineage generation';
function chart(trait){
 const finite=summary.filter(s=>s.mean!==null);if(!finite.length){$('notebook-chart').innerHTML='<p>No recorded measurements for this selection yet.</p>';return;}
 const W=820,H=245,L=70,R=28,T=20,B=48,x0=summary[0].group,x1=summary.at(-1).group;
 let lo=Infinity,hi=-Infinity;for(const s of finite){lo=Math.min(lo,s.min);hi=Math.max(hi,s.max);}const pad=Math.max((hi-lo)*.12,(trait.max-trait.min)*.025);lo=Math.max(trait.min,lo-pad);hi=Math.min(trait.max,hi+pad);if(hi<=lo)hi=lo+1;
 const x=v=>x0===x1?(W+L-R)/2:L+(v-x0)/(x1-x0)*(W-L-R),y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
 const ticks=Array.from(new Set([x0,...summary.filter((s,i)=>i%Math.max(1,Math.ceil(summary.length/6))===0).map(s=>s.group),x1]));
 let path='',connected=false;for(const s of summary){if(s.mean===null){connected=false;continue;}path+=(connected?'L':'M')+x(s.group).toFixed(2)+','+y(s.mean).toFixed(2);connected=true;}
 const title='trait-chart-'+(++chartId);$('notebook-chart').innerHTML=`<p class="data-chart-title">${esc(trait.label)} · ${esc(trait.unit)}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${title}"><title id="${title}">${esc(trait.label)}: mean by ${groupLabel().toLowerCase()}. Vertical lines show minimum to maximum. Exact values are in the tables.</title>${[lo,(lo+hi)/2,hi].map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="data-grid"/><text x="${L-10}" y="${y(v)+4}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" class="data-axis"/>${ticks.map(v=>`<text x="${x(v)}" y="${H-B+20}" text-anchor="middle">${v}</text>`).join('')}<path d="${path}" fill="none" class="data-trend"/>${finite.map(s=>`<g><title>${groupLabel()} ${s.group}: mean ${fmt(s.mean)}, min ${fmt(s.min)}, max ${fmt(s.max)}, n ${s.count}</title><line x1="${x(s.group)}" x2="${x(s.group)}" y1="${y(s.min)}" y2="${y(s.max)}" class="data-range"/><circle cx="${x(s.group)}" cy="${y(s.mean)}" r="4" class="data-point"/></g>`).join('')}<text x="${(L+W-R)/2}" y="${H-5}" text-anchor="middle">${groupLabel()}</text></svg><p class="hint">Dots and line: group average. Vertical bars: individual minimum–maximum. One dot means only one measured group so far.</p>`;
}
function render(){
 const trait=N.byKey[$('notebook-trait').value];if(!trait)return;
 data=N.rows(A.getState(),trait.key,filters());summary=N.summarize(data,$('notebook-group').value);
 const count=data.filter(r=>r.value!==null).length,missing=data.length-count,imported=data.filter(r=>r.origin==='imported').length;
 $('notebook-unit').textContent=trait.label+' · '+trait.unit;
 $('notebook-coverage').textContent=count+' measured beetles · '+missing+' unavailable older records · '+imported+' imported beetles. '+(missing?'Older missing measurements cannot be reconstructed. ':'')+'Retained measurements include beetles that have left the tank.';
 $('notebook-summary-title').textContent=groupLabel()+' summary';
 $('notebook-summary-head').innerHTML=`<tr><th>${groupLabel()}</th><th>Measured n</th><th>Unavailable n</th><th>Mean</th><th>Minimum</th><th>Maximum</th></tr>`;
 $('notebook-summary').innerHTML=summary.map(s=>`<tr><td>${s.group}</td><td>${s.count}</td><td>${s.missing}</td><td>${s.mean===null?'—':fmt(s.mean)}</td><td>${s.min===null?'—':fmt(s.min)}</td><td>${s.max===null?'—':fmt(s.max)}</td></tr>`).join('')||'<tr><td colspan="6">No beetles match these filters yet.</td></tr>';
 const pages=Math.max(1,Math.ceil(data.length/PAGE));page=Math.min(page,pages-1);
 $('notebook-rows').innerHTML=data.slice(page*PAGE,(page+1)*PAGE).map(r=>`<tr><td>${esc(r.name?r.name+' · '+r.id:r.id)}</td><td>${r.generation}</td><td>${r.round===null?'—':r.round}</td><td>${esc(r.jar||r.origin)}</td><td>${esc(r.status)}</td><td>${esc(fmt(r.value))}</td></tr>`).join('')||'<tr><td colspan="6">No individual measurements yet.</td></tr>';
 $('notebook-value-heading').textContent=trait.label;$('notebook-page').textContent=data.length+' beetles · page '+(page+1)+' of '+pages;$('notebook-prev').disabled=page===0;$('notebook-next').disabled=page===pages-1;
 $('notebook-raw-csv').disabled=data.length===0;$('notebook-summary-csv').disabled=summary.length===0;chart(trait);
}
function download(summaryOnly){const key=$('notebook-trait').value,group=$('notebook-group').value,content=summaryOnly?N.summaryCSV(A.getState(),key,filters(),group):N.rawCSV(A.getState(),key,filters());const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Pattern-Lab-'+key+'-'+(summaryOnly?group+'-summary':'individuals')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('notebook-trait').innerHTML=[...new Set(N.traits.map(t=>t.group))].map(group=>`<optgroup label="${esc(group)}">${N.traits.filter(t=>t.group===group).map(t=>`<option value="${t.key}">${esc(t.label)}</option>`).join('')}</optgroup>`).join('');
$('notebook-open').onclick=()=>{page=0;render();$('trait-notebook').showModal();};
for(const id of ['notebook-trait','notebook-group','notebook-jar','notebook-origin'])$(id).onchange=()=>{page=0;render();};
$('notebook-prev').onclick=()=>{page--;render();};$('notebook-next').onclick=()=>{page++;render();};
$('notebook-raw-csv').onclick=()=>download(false);$('notebook-summary-csv').onclick=()=>download(true);
window.addEventListener('pattern-state',()=>{if($('trait-notebook').open)render();});
})();

(function(root){
'use strict';
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=x=>typeof x==='number'?String(x):Array.isArray(x)?'RGB ['+x.join(', ')+']':x&&typeof x==='object'?(x.rgb?'RGB ['+x.rgb.join(', ')+']':x.value)+'; expression='+x.expression:String(x);
function snapshot(beetle){
 const b=G.clone(beetle),p=G.phenotype(b),rows=[];
 for(const c of G.chromosomes)for(const [index,l] of c.loci.entries()){
  const cp=G.copies(b,l.key);let effect=value(G.expressed(b,l.key));
  if(l.key==='plain')effect=p.visibleLayers===0?'S present: markings suppressed':'ss: markings permitted';
  if(l.key==='layers')effect=(cp.some(a=>a.value==='T')?'T present: at most one pattern color':'tt: two pattern colors permitted')+'; currently visible='+p.visibleLayers;
  if(l.key==='hairGate')effect=cp.some(a=>a.value==='H')?'H present: fine antenna hairs suppressed':'hh: fine hairs permitted; expressed density='+p.hairs;
  rows.push({record:c.id+'.'+String(index+1).padStart(2,'0'),chromosome:c.id,key:l.key,label:l.label,type:l.type,model:l.model==='quantitative'?'QNT · many-gene estimate':'MEN · inherited copies',copies:cp,effect,mutated:b.mutations.includes(l.key),range:l.type==='number'?[l.min,l.max]:null});
 }
 return {beetle:b,rows,derived:[
  {key:'size',label:'Overall body size',value:p.size,rule:'sqrt(bodyLength × bodyWidth) × 2^bodyGrowth; continuous relative scale'},
  ...['body','antenna','leg','horn','head','jaw'].map(part=>({key:part+'Factor',label:part+' growth multiplier',value:p[part+'Factor'],rule:'2 raised to the mean log2 growth contribution'})),
  {key:'visibleHorns',label:'Visible horn count',value:p.visibleHorns,rule:'Horn count allele expressed when horn length exceeds nub threshold'},
  {key:'speed',label:'Walking speed',value:p.speed,rule:'Derived from motor, stride and legLength; body lengths per second'},
  {key:'strengthIndex',label:'Displayed strength index',value:p.strengthIndex,rule:'round(1 + 99 × strength); game index'},
  {key:'visibleLayers',label:'Visible pattern colors',value:p.visibleLayers,rule:'S suppresses marks; ss permits marks; T caps at one color; tt permits two'},
  {key:'hairs',label:'Expressed fine-hair density',value:p.hairs,rule:'H suppresses fine hairs; hh uses hairDensity'}
 ],fingerprint:G.fingerprint(b)};
}
function tables(report){return `<h3>Paired records · ${report.rows.length} factors</h3><div class="genome-table"><table><thead><tr><th>Record</th><th>Factor / key</th><th>Model / range</th><th>Copy 1</th><th>Copy 2</th><th>Expression / gate effect</th><th>Birth mutation</th></tr></thead><tbody>${report.rows.map(r=>`<tr><td>${esc(r.record)}</td><td><strong>${esc(r.label)}</strong><br><code>${esc(r.key)}</code></td><td>${esc(r.model)}${r.range?'<br>'+r.range.map(esc).join(' … '):''}</td><td>${esc(value(r.copies[0]))}</td><td>${esc(value(r.copies[1]))}</td><td>${esc(r.effect)}</td><td>${r.mutated?'Recorded':'—'}</td></tr>`).join('')}</tbody></table></div><h3>Derived traits and expression gates</h3><div class="genome-table"><table><thead><tr><th>Measurement</th><th>Value</th><th>Rule</th></tr></thead><tbody>${report.derived.map(r=>`<tr><td>${esc(r.label)}<br><code>${esc(r.key)}</code></td><td>${esc(r.value)}</td><td>${esc(r.rule)}</td></tr>`).join('')}</tbody></table></div>`;}
function document(report){const packet=JSON.stringify(G.packet(report.beetle)).replace(/</g,'\\u003c');return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.beetle.name||report.beetle.id)} · Full genetics report</title><style>body{font:14px/1.5 system-ui;color:#254b3e;margin:30px}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #cbd5c3;padding:8px;text-align:left;overflow-wrap:anywhere}th{background:#edf1e6}pre{white-space:pre-wrap;overflow-wrap:anywhere}.genome-table{overflow:auto}@media print{button{display:none}thead{display:table-header-group}}</style><h1>Full genetics report · ${esc(report.beetle.name||report.beetle.id)}</h1><p>${esc(report.beetle.id)} · lineage generation ${report.beetle.lineageGeneration} · fingerprint ${esc(report.fingerprint)}</p><p>Original teaching model, not a real-species genetic test. QNT records estimate many small genetic effects; MEN records carry actual inherited copies. Copy numbers do not identify a real gene or guarantee an offspring outcome. All stored numeric precision is shown.</p><button onclick="window.print()">Print / Save as PDF</button>${tables(report)}<h3>Complete stored beetle record</h3><pre>${esc(JSON.stringify(report.beetle,null,2))}</pre><script type="application/json" id="pattern-beetle-data">${packet}</script></html>`;}
const api={snapshot,tables,document};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternGeneticsReport=api;
})(typeof globalThis!=='undefined'?globalThis:this);

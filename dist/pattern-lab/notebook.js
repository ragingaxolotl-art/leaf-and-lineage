(function(root){
'use strict';
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
const traits=G.studentTraits,byKey=Object.fromEntries(traits.map(t=>[t.key,t]));
function rows(state,key,{jar='all',origin='all',order='generation'}={}){
 if(!Object.hasOwn(byKey,key))throw Error('Choose a supported student measurement.');
 if(!['generation','round'].includes(order))throw Error('Choose generation or breeding round.');
 if(!['all','jar-1','jar-2'].includes(jar)||!['all','local','imported'].includes(origin))throw Error('Choose a valid notebook filter.');
 return Object.values({...state.retired,...state.beetles}).filter(b=>!b.dataExpired||state.beetles[b.id]).map(b=>{
  const live=!!state.beetles[b.id],source=b.origin||(b.provenance?'imported':b.parents.length?'bred':live?'founder':'unknown');
  if(jar!=='all'&&b.sourceJarId!==jar||origin==='local'&&!['bred','founder'].includes(source)||origin==='imported'&&source!=='imported')return null;
  const data=live?G.measurements(b):b.measurements;
  return {id:b.id,name:b.name,generation:b.lineageGeneration,round:b.broodId?Number(b.broodId.slice(6)):source==='founder'?0:source==='imported'?(b.arrivedRound??null):null,jar:b.sourceJarId||'',origin:source,status:live?G.container(state,b.id):b.reason||'left tank',parent1:b.parents[0]||'',parent2:b.parents[1]||'',value:data?.[key]??null};
 }).filter(Boolean).sort((a,b)=>(a[order]??Infinity)-(b[order]??Infinity)||a.generation-b.generation||(a.round??0)-(b.round??0)||Number(a.id.slice(1))-Number(b.id.slice(1)));
}
function summarize(data,group='generation'){
 if(!['generation','round'].includes(group))throw Error('Choose generation or breeding round.');
 const groups=new Map();for(const row of data){const k=row[group];if(k===null)continue;let s=groups.get(k);if(!s){s={group:k,count:0,missing:0,mean:null,min:null,max:null};groups.set(k,s);}if(row.value===null){s.missing++;continue;}s.count++;s.mean=s.count===1?row.value:s.mean+(row.value-s.mean)/s.count;s.min=s.min===null?row.value:Math.min(s.min,row.value);s.max=s.max===null?row.value:Math.max(s.max,row.value);}
 return [...groups.values()].sort((a,b)=>a.group-b.group);
}
// Prefix formula-like TEXT cells; leave numeric measurements (including negatives) numeric.
function cell(v){if(v===null||v===undefined)return '';let s=String(v);if(typeof v==='string'&&/^[\s\u0000-\u0020]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(lines){return '\uFEFF'+lines.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
function rawCSV(state,key,filters){const trait=byKey[key];if(!trait)throw Error('Choose a supported student measurement.');return csv([['Trait','Unit','Beetle ID','Name','Lineage generation','Birth or arrival round','Parent 1','Parent 2','Jar','Origin','Status','Value'],...rows(state,key,filters).map(r=>[trait.label,trait.unit,r.id,r.name,r.generation,r.round,r.parent1,r.parent2,r.jar,r.origin,r.status,r.value])]);}
function summaryCSV(state,key,filters,group='generation'){const trait=byKey[key];if(!trait)throw Error('Choose a supported student measurement.');return csv([['Trait','Unit','Grouped by','Group','Measured beetles','Unavailable beetles','Mean','Minimum','Maximum'],...summarize(rows(state,key,filters),group).map(s=>[trait.label,trait.unit,group,s.group,s.count,s.missing,s.mean,s.min,s.max])]);}
const api={traits,byKey,rows,summarize,rawCSV,summaryCSV};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternNotebook=api;
})(typeof globalThis!=='undefined'?globalThis:this);

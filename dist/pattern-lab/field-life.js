/* Learned relationships, small tank events and expeditions; never inherited DNA. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PatternFieldLife=api;})(globalThis,function(){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),value=(p,k)=>clamp(Number.isFinite(p[k])?p[k]:.5),finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b,idOK=id=>typeof id==='string'&&/^B[1-9]\d*$/.test(id);
const sites={
 log:{name:'Fallen log',duration:36,color:'#947451',find:'arch',stages:[
  {name:'A crack in the bark',methods:[['squeeze','Squeeze through the crack',{small:.55,bodyNarrow:.25,caution:.2}],['clear','Shift a loose bark chip',{strength:.5,jawReach:.3,brace:.2}],['probe','Find an opening with antennae',{antennaReach:.55,tracking:.25,curiosity:.2}]]},
  {name:'The mossy ridge',methods:[['grasp','Grip the mossy ridge',{grip:.35,claw:.25,footing:.25,focus:.15}],['stride','Step across the ridge',{legReach:.5,lateralBalance:.25,endurance:.25}],['detour','Follow the sheltered edge',{caution:.35,persistence:.35,tracking:.3}]]},
  {name:'A hidden hollow',methods:[['sense','Probe beneath the bark',{antennaReach:.45,curiosity:.35,focus:.2}],['trace','Trace the hollow patiently',{tracking:.35,persistence:.4,focus:.25}],['lift','Lift a soft bark flap',{strength:.4,hornReach:.35,brace:.25}]]}]},
 garden:{name:'Garden',duration:42,color:'#81975e',find:'seed',stages:[
  {name:'The stem crossing',methods:[['grasp','Clasp a low stem',{claw:.35,grip:.3,footing:.35}],['stride','Step between stems',{legReach:.5,lateralBalance:.3,focus:.2}],['ground','Take the ground route',{small:.3,endurance:.35,persistence:.35}]]},
  {name:'A scented seed head',methods:[['sense','Inspect the seed head',{antennaReach:.5,curiosity:.3,tracking:.2}],['wait','Wait and watch for a route',{focus:.4,caution:.3,persistence:.3}],['reach','Reach from a broad leaf',{legReach:.4,lateralBalance:.3,grip:.3}]]},
  {name:'A seed in the soil',methods:[['carry','Nudge a loose seed free',{strength:.4,mass:.3,jawReach:.3}],['probe','Find a smaller seed',{antennaReach:.3,small:.4,curiosity:.3}],['search','Search the loose soil',{persistence:.5,tracking:.3,endurance:.2}]]}]},
 litter:{name:'Leaf-litter maze',duration:48,color:'#a68c60',find:'seed',stages:[
  {name:'The forked trail',methods:[['trace','Trace the sheltered trail',{tracking:.4,focus:.4,persistence:.2}],['scout','Scout the open branch',{curiosity:.45,speed:.3,reaction:.25}],['probe','Probe under a curled leaf',{antennaReach:.4,small:.4,caution:.2}]]},
  {name:'The curled-leaf tunnel',methods:[['squeeze','Slip through the tunnel',{small:.6,bodyNarrow:.25,caution:.15}],['lift','Lift the leaf edge',{strength:.45,hornReach:.35,brace:.2}],['detour','Walk around the curl',{endurance:.4,speed:.25,persistence:.35}]]},
  {name:'A clearing beyond the leaves',methods:[['sense','Investigate the clearing',{antennaReach:.4,curiosity:.35,focus:.25}],['search','Search beneath loose leaves',{persistence:.45,tracking:.3,claw:.25}],['balance','Cross a twig to look farther',{lateralBalance:.4,footing:.35,legReach:.25}]]}]}
};
function rng(seed){let x=seed>>>0;return()=>{x=(x+0x6D2B79F5)>>>0;let t=Math.imul(x^(x>>>15),x|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function features(p){const n=(k,d=1)=>Number.isFinite(p[k])?p[k]:d;return {...p,small:clamp((2-Math.log2(n('bodyFactor')))/5),bodyNarrow:clamp((1.3-n('bodyWidth'))/.58),antennaReach:clamp(Math.log2(1+n('antennaLength')*n('antennaFactor'))/2.5),legReach:clamp(Math.log2(1+n('legLength')*n('legFactor'))/2.2),hornReach:p.visibleHorns>0?clamp(n('horn',0)*n('hornFactor')/1.5):0,jawReach:clamp(n('jaw',0)*n('jawFactor')),footing:clamp(.45*value(p,'grip')+.3*clamp((n('foot')-.5)/1.3)+.25*clamp((n('legSpread')-.7)/.7)),speed:clamp((n('speed')-.25)/1.7)};}
function approach(p,stage){const f=features(p);return stage.methods.map(([id,label,weights])=>({id,label,score:Object.entries(weights).reduce((sum,[key,w])=>sum+value(f,key)*w,0)})).sort((a,b)=>b.score-a.score)[0];}
function create(){return {nextId:1,active:null,history:[],finds:{seed:0,arch:0}};}
function life(){return {clock:0,nextDrama:8,relationships:{},events:[]};}
function ensure(s){if(s.fieldwork===undefined)s.fieldwork=create();return s.fieldwork;}
function ensureLife(t){if(t.life===undefined)t.life=life();return t.life;}
function away(s,id){return Boolean(s.fieldwork?.active?.party.includes(id));}
function note(l,kind,actors,objectId=null,detail=0){l.events.unshift({kind,actors:actors.map(a=>({id:a.id,name:String(a.name||a.id).slice(0,40)})),objectId,time:l.clock,detail});l.events=l.events.slice(0,20);}
function key(a,b){return [a,b].sort().join('~');}
function bond(l,a,b){return l?.relationships[key(a,b)]||null;}
function relate(l,a,b,kind,objectId=null){
 if(!l||a.id===b.id)return;const k=key(a.id,b.id);let r=l.relationships[k];
 if(!r){if(Object.keys(l.relationships).length>=192){const oldest=Object.entries(l.relationships).sort((a,b)=>a[1].last-b[1].last)[0];delete l.relationships[oldest[0]];}r=l.relationships[k]={a:[a.id,b.id].sort()[0],b:[a.id,b.id].sort()[1],familiarity:0,rivalry:0,meetings:0,last:l.clock,rest:0};}
 if(r.meetings>0&&l.clock-r.last<2.5)return;
 const oldF=r.familiarity,oldR=r.rivalry;r.meetings=Math.min(1000000,r.meetings+1);r.last=l.clock;
 if(kind==='greet'||kind==='rest')r.familiarity=clamp(r.familiarity+(kind==='rest'?.1:.07+.09*(value(a.traits||{},'sociality')+value(b.traits||{},'sociality'))/2));
 if(kind==='contest'&&value(a.traits||{},'pushDrive')>.55&&value(b.traits||{},'pushDrive')>.55)r.rivalry=clamp(r.rivalry+.16);
 if(oldF<.4&&r.familiarity>=.4)note(l,'familiar',[a,b],objectId);if(oldR<.35&&r.rivalry>=.35)note(l,'rival',[a,b],objectId);
}
function drama(l,kind,actors,o,rng){
 const duration=kind==='bridge'?1.8:kind==='leaf'?2.6:3.2;
 for(const a of actors){a.behavior.drama={kind,objectId:o?.id||null,remaining:duration,role:actors.indexOf(a),resumeCrossing:kind==='bridge'&&a.behavior.mode==='crossing',resumeRemaining:a.behavior.remaining,load:kind==='leaf'?clamp(.3+.35*value(a.traits||{},'mass')+.2*(a.traits?.bodyFactor||1)):0};a.behavior.dramaWait=35;}
 note(l,kind,actors,o?.id||null,actors[0].behavior.drama.load);l.nextDrama=l.clock+14+rng()*20;
}
function tickLife(agents,{life:l,objects,width,height,dt,rng:random=Math.random}){
 if(!l)return;l.clock=Math.min(1e9,l.clock+dt);
 for(const a of agents){const m=a.behavior;if(a.held)continue;m.dramaWait=Math.max(0,(m.dramaWait||0)-dt);if(m.drama){m.drama.remaining-=dt;if(m.drama.remaining<=0){const d=m.drama;m.drama=null;m.mode='explore';m.decision=0;m.remaining=0;if(d.kind==='bridge'){if(d.resumeCrossing){m.mode='crossing';m.remaining=m.decision=Math.max(6,d.resumeRemaining||0);m.bridgeYield=d.role?1.2:0;}else m.heading=a.angle+(d.role?-.7:.7);}}}}
 for(let i=0;i<agents.length;i++)for(let j=i+1;j<agents.length;j++){const a=agents[i],b=agents[j];if(a.held||b.held)continue;const r=bond(l,a.id,b.id);if(!r)continue;if(['rest','settle','restmate'].includes(a.behavior.mode)&&['rest','settle','restmate'].includes(b.behavior.mode)&&Math.hypot((a.x-b.x)*width,(a.y-b.y)*height)<90){r.rest+=dt;if(r.rest>=5){r.rest=0;relate(l,a,b,'rest');}}}
 if(l.clock<l.nextDrama||agents.some(a=>a.behavior.drama)||random()>dt*.7)return;
 const ready=agents.filter(a=>!a.held&&!a.behavior.dramaWait&&!a.behavior.intent&&!['rest','settle','restmate'].includes(a.behavior.mode));
 for(const o of objects){const dx=a=>(a.x-o.x)*width,dy=a=>(a.y-o.y)*height,c=Math.cos(o.angle*Math.PI/180),s=Math.sin(o.angle*Math.PI/180),local=a=>({x:c*dx(a)+s*dy(a),y:-s*dx(a)+c*dy(a)}),base=Math.min(width,height);
  if(o.kind==='bridge'){const close=ready.filter(a=>{const p=local(a);const toward=(Math.sin(a.angle)*-dx(a)-Math.cos(a.angle)*-dy(a))/Math.max(1,Math.hypot(dx(a),dy(a)));return Math.abs(p.x)<base*.24&&Math.abs(p.y)<base*.08&&(a.behavior.mode==='crossing'||toward>.1);});for(let i=0;i<close.length;i++)for(let j=i+1;j<close.length;j++)if(local(close[i]).x*local(close[j]).x<0){drama(l,'bridge',[close[i],close[j]],o,random);return;}}
  if(o.kind==='leaf'){const a=ready.find(a=>{const p=local(a),load=value(a.traits||{},'mass')*(a.traits?.bodyFactor||1);return load>.45&&Math.hypot(p.x/(base*.135),p.y/(base*.067))<1;});if(a){drama(l,'leaf',[a],o,random);return;}}
 }
 const a=ready.find(a=>a.behavior.mode==='eat'&&a.traits?.visibleHorns>0&&(a.traits.horn*a.traits.hornFactor)>.06);if(a)drama(l,'crumb',[a],null,random);
}
function begin(s,party,site,G,seed){
 const f=ensure(s);if(f.active)throw Error('Finish or recall the current expedition first.');
 if(!sites[site]||!Array.isArray(party)||party.length<1||party.length>3||new Set(party).size!==party.length||party.some(id=>!s.beetles[id]||s.jars.some(j=>j.members.includes(id))||s.tradeLocks.includes(id)))throw Error('Choose one to three beetles outside the parent jars and pending trades.');
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid expedition seed.');
 f.active={id:f.nextId++,site,party:party.slice(),elapsed:0,duration:sites[site].duration,seed,paused:false,speed:1,results:[],names:party.map(id=>({id,name:s.beetles[id].name||id}))};return f.active;
}
function advance(s,dt,G){
 const f=ensure(s),a=f.active;if(!a||a.paused||!(dt>0))return false;
 a.elapsed=Math.min(a.duration,a.elapsed+Math.min(dt,.1)*a.speed);
 const route=sites[a.site];for(let stage=a.results.length;stage<3&&a.elapsed>=a.duration*(stage+1)/3;stage++){
  const choices=a.party.map(id=>({actor:id,...approach(G.phenotype(s.beetles[id]),route.stages[stage])})).sort((a,b)=>b.score-a.score),best=choices[0],roll=rng(a.seed+stage*7919)();a.results.push({stage,actor:best.actor,method:best.id,score:best.score,success:roll<.25+.65*best.score});
 }
 if(a.elapsed<a.duration)return false;
 const successes=a.results.filter(r=>r.success).length,random=rng(a.seed^0x5fa921);random();const reward=successes?(route.find==='seed'&&random()>.65?'arch':route.find):null;
 if(reward)f.finds[reward]=Math.min(999,f.finds[reward]+1);
 f.history.unshift({...a,recalled:false,reward});f.history=f.history.slice(0,20);f.active=null;return true;
}
function recall(s){const f=ensure(s);if(!f.active)return false;f.history.unshift({...f.active,recalled:true,reward:null});f.history=f.history.slice(0,20);f.active=null;return true;}
function install(s,find,target,H){const f=ensure(s);if(!['seed','arch'].includes(find)||!['tank','keep'].includes(target)||!f.finds[find])throw Error('Choose an available discovery and a tank.');const o=H.add(H.ensure(s)[target],find==='seed'?'sprout':'arch');f.finds[find]--;return o;}
function prune(s){ensure(s);for(const t of Object.values(s.habitat||{})){const l=ensureLife(t);for(const [k,r] of Object.entries(l.relationships))if(!s.beetles[r.a]||!s.beetles[r.b])delete l.relationships[k];}}
function validateLife(l,beetles){
 if(!l||!finite(l.clock,0,1e9)||!finite(l.nextDrama,0,1e9+100)||!l.relationships||typeof l.relationships!=='object'||Array.isArray(l.relationships)||Object.keys(l.relationships).length>192||!Array.isArray(l.events)||l.events.length>20)throw Error('Invalid tank life record.');
 for(const [k,r] of Object.entries(l.relationships))if(!r||!idOK(r.a)||!idOK(r.b)||r.a===r.b||k!==key(r.a,r.b)||!Object.hasOwn(beetles,r.a)||!Object.hasOwn(beetles,r.b)||!finite(r.familiarity,0,1)||!finite(r.rivalry,0,1)||!Number.isInteger(r.meetings)||!finite(r.meetings,0,1000000)||!finite(r.last,0,l.clock)||!finite(r.rest,0,5.1))throw Error('Invalid learned relationship.');
 for(const e of l.events)if(!e||!['bridge','leaf','crumb','familiar','rival'].includes(e.kind)||!Array.isArray(e.actors)||e.actors.length<1||e.actors.length>2||e.actors.some(a=>!idOK(a.id)||typeof a.name!=='string'||a.name.length>40)||!finite(e.time,0,l.clock)||!finite(e.detail,0,1)||e.objectId!==null&&(typeof e.objectId!=='string'||!/^[a-z]+-[a-z0-9]+$/.test(e.objectId)))throw Error('Invalid tank observation.');
}
function validate(s){
 const f=ensure(s);if(!f||!Number.isInteger(f.nextId)||f.nextId<1||!f.finds||!['seed','arch'].every(k=>Number.isInteger(f.finds[k])&&finite(f.finds[k],0,999))||!Array.isArray(f.history)||f.history.length>20)throw Error('Invalid field notebook.');
 const seen=new Set();for(const [a,active] of [[f.active,true],...f.history.map(h=>[h,false])]){if(!a){if(active)continue;throw Error('Invalid expedition.');}
  if(!Number.isInteger(a.id)||a.id<1||a.id>=f.nextId||seen.has(a.id)||!sites[a.site]||a.duration!==sites[a.site].duration||!finite(a.elapsed,0,a.duration)||!Number.isInteger(a.seed)||!finite(a.seed,0,4294967295)||typeof a.paused!=='boolean'||![1,2,5,10].includes(a.speed)||!Array.isArray(a.party)||a.party.length<1||a.party.length>3||new Set(a.party).size!==a.party.length||a.party.some(id=>!idOK(id)||active&&(!Object.hasOwn(s.beetles,id)||s.jars.some(j=>j.members.includes(id))||s.tradeLocks.includes(id)))||!Array.isArray(a.names)||a.names.length!==a.party.length||a.names.some((n,i)=>n.id!==a.party[i]||typeof n.name!=='string'||n.name.length>40)||!Array.isArray(a.results)||a.results.length>3)throw Error('Invalid expedition record.');seen.add(a.id);
  for(const [i,r] of a.results.entries())if(!r||r.stage!==i||!a.party.includes(r.actor)||!sites[a.site].stages[i].methods.some(m=>m[0]===r.method)||!finite(r.score,0,1)||typeof r.success!=='boolean'||a.elapsed+1e-7<a.duration*(i+1)/3)throw Error('Invalid expedition observation.');
  if(active&&(a.elapsed===a.duration||a.results.length===3)||!active&&(typeof a.recalled!=='boolean'||![null,'seed','arch'].includes(a.reward)||!a.recalled&&(a.elapsed!==a.duration||a.results.length!==3)||a.recalled&&a.reward!==null))throw Error('Invalid expedition return.');
 }return f;
}
return {sites,create,life,ensure,ensureLife,validate,validateLife,prune,away,begin,advance,recall,install,features,approach,bond,relate,tickLife};
});

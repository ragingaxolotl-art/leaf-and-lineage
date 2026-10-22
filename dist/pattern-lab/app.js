/* Pattern Lab v1 — browser-local, no accounts, no trackers, no external assets. */
(function(){
'use strict';
const G=PatternGenetics,B=PatternBeetles,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE='leaf-lineage-pattern-PL1',MAX=3000,views=new Map(),motionRandom=G.seeded(crypto.getRandomValues(new Uint32Array(1))[0]),inheritanceRandom=G.seeded(crypto.getRandomValues(new Uint32Array(1))[0]);
let state,selected=null,running=!matchMedia('(prefers-reduced-motion: reduce)').matches,animationSpeed=1,last=0,toastTimer,saveTimer,browseType='all',browsePage=0,dragId=null,classConfig=null,resumeState=null,storageKey=SAVE,blocked=false;
const hash=G.checksum,validConfig=G.validConfig,encode=G.encodeConfig,decode=G.decodeConfig;
function newState(config){const s=G.createState(config?.seed||42);if(config)Object.assign(s.settings,{mutation:config.mutation,showStats:config.stats,allowBackdrop:config.environment,backdrop:config.backdrop,allowSumo:config.sumo!==false});return s;}
try{const params=new URLSearchParams(location.hash.slice(1)),code=params.get('class');if(params.has('class')){classConfig=decode(code);storageKey=SAVE+'-'+hash(code);}state=newState(classConfig);}catch(e){state=G.createState();blocked=true;$('invalid-link').textContent=e.message+' The lab has not applied any replacement presets.';$('invalid-link').hidden=false;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function saveNow(){if(blocked)return;if(resumeState&&!$('resume-banner').hidden){$('save-status').textContent='Choose Resume saved tank or Start fresh above to enable auto-save. Save tank file keeps this preview separately.';return;}try{const disk=JSON.parse(localStorage.getItem(storageKey)||'null');if(disk?.pendingTrade&&disk.pendingTrade.code!==state.pendingTrade?.code)throw Error('A trade is pending in another tab.');if(state.pendingTrade&&disk?.tradeReceipts?.includes(state.pendingTrade.code)){state=enforcePermissions(G.validate(disk));render();return;}localStorage.setItem(storageKey,JSON.stringify(state));$('save-status').textContent='Auto-saved on this device. Save a tank file for a portable copy.';}catch(e){$('save-status').textContent='Device storage is unavailable or full. Use Save tank file to keep your work.';}}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,250);}
try{const raw=localStorage.getItem(storageKey);if(raw&&!blocked){resumeState=G.validate(JSON.parse(raw));$('resume-banner').hidden=false;}}catch(e){$('save-status').textContent='A previous device save could not be read. You can open a saved tank file.';}
function name(b){return b.name?b.name+' · '+b.id:b.id;}
function shortName(b){return b?.name||b?.id||'Unknown ancestor';}
function checkpoint(next=state){const disk=JSON.parse(localStorage.getItem(storageKey)||'null');if(disk?.pendingTrade&&disk.pendingTrade.code!==state.pendingTrade?.code)throw Error('Finish the trade in the other tab before changing this tank.');if(resumeState&&!$('resume-banner').hidden)throw Error('Choose Resume saved tank or Start fresh before trading.');localStorage.setItem(storageKey,JSON.stringify(next));}
function noPending(){if(state.pendingTrade)throw Error('Finish or cancel your pending trade first.');}
function cool(mist=true){running=false;$('tank').classList.add('cooled');$('motion').textContent='▶ Run tank';$('motion-state').textContent='Cooled & paused';$('motion-state').classList.add('cold');if(mist){$('mist').classList.remove('cooling');void $('mist').offsetWidth;$('mist').classList.add('cooling');setTimeout(()=>$('mist').classList.remove('cooling'),1100);}}
function run(){if(blocked)return;running=true;$('tank').classList.remove('cooled');$('motion').textContent='❄ Cool & pause';$('motion-state').textContent='Wandering';$('motion-state').classList.remove('cold');}
function ensureView(id){if(!views.has(id)){const p=G.phenotype(state.beetles[id]);views.set(id,{x:.08+motionRandom()*.84,y:.1+motionRandom()*.8,angle:motionRandom()*Math.PI*2,turn:0,speed:p.speed,traits:p,el:null});}return views.get(id);}
function renderTank(){
 const box=$('tank-bugs'),present=new Set(state.tank);
 for(const el of [...box.children])if(!present.has(el.dataset.id)){el.remove();const v=views.get(el.dataset.id);if(v)v.el=null;}
 for(const id of views.keys())if(!state.beetles[id])views.delete(id);
 for(const id of state.tank){let el=[...box.children].find(e=>e.dataset.id===id);if(!el){el=document.createElement('button');el.className='tank-bug';el.dataset.id=id;el.draggable=true;el.innerHTML=B.draw(state.beetles[id],'tank');el.addEventListener('click',()=>inspect(id));el.addEventListener('dragstart',e=>{dragId=id;cool(false);e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';el.classList.add('dragging');});el.addEventListener('dragend',()=>{dragId=null;el.classList.remove('dragging');document.querySelectorAll('.drag-over').forEach(e=>e.classList.remove('drag-over'));});box.append(el);}el.setAttribute('aria-label','Inspect '+name(state.beetles[id]));el.title=name(state.beetles[id]);const v=ensureView(id);v.el=el;}
 $('tank-count').textContent=state.tank.length+' / 48 in tank';$('nursery-count').textContent=state.nursery.length;$('collection-count').textContent=state.collection.length;
 $('round').textContent=state.round;$('highest-generation').textContent=Object.values({...state.retired,...state.beetles}).reduce((n,b)=>Math.max(n,b.lineageGeneration),0);
 $('backdrop').value=state.settings.backdrop;$('tank').className='tank '+state.settings.backdrop+(running?'':' cooled');$('backdrop-field').hidden=!state.settings.allowBackdrop;
 $('tank-hint').textContent=state.tank.length?'Click a beetle for a closer look':'Return a beetle from a jar, nursery or collection';
}
function forecastHtml(jar){const f=G.forecast(state,jar);if(!f)return '';const pct=n=>Math.round(100*n/f.n)+'%',top=Object.entries(f.antennae).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>G.antennaNames[k]+' '+pct(v)).join(' · ');return `<div class="forecast"><strong>Estimated offspring · ${f.n} simulated babies</strong><br>Plain ${pct(f.layers[0])} · 1 pattern color ${pct(f.layers[1])} · 2 colors ${pct(f.layers[2])}<br>${top}<br>Mean speed ${(f.speed/f.n).toFixed(2)} body lengths/s · strength ${Math.round(f.strength/f.n)}/100<br><small>Sample estimates, not promises. Each birth rolls independently.</small></div>`;}
function renderJars(){
 $('jars').innerHTML=state.jars.map((j,ji)=>`<section class="jar" aria-label="Parent jar ${ji+1}"><div class="jar-top"><strong>Jar ${ji+1}</strong><label><input type="checkbox" data-active="${j.id}" ${j.active?'checked':''} ${blocked?'disabled':''}> Use this jar</label></div><div class="jar-slots">${Array.from({length:4},(_,i)=>{const id=j.members[i],b=state.beetles[id];return `<div class="slot ${b?'':'empty'}" data-drop="${j.id}">${b?`<button class="parent-bug" data-inspect="${id}" aria-label="Inspect ${esc(name(b))}">${B.draw(b,'jar'+ji)}</button><span class="parent-label">${esc(shortName(b)).slice(0,16)}</span><button class="remove-parent" data-remove="${id}" aria-label="Remove ${esc(name(b))} from jar">×</button>`:`<button data-pick="${j.id}" aria-label="Choose a beetle for jar ${ji+1}">+</button><span>Click or drop a beetle</span>`}</div>`;}).join('')}</div><div class="jar-status">${j.members.length} / 4 parents · ${j.members.length>=2?G.pairs(j.members).length+' possible '+(j.members.length===2?'pair':'pairs'):'needs at least 2'}</div>${state.settings.showStats?forecastHtml(j):''}</section>`).join('');
 const active=state.jars.filter(j=>j.active&&j.members.length>=2),incomplete=state.jars.filter(j=>j.active&&j.members.length<2);
 $('breed').disabled=!active.length||blocked||Object.keys(state.beetles).length>MAX-20;
 $('jar-help').textContent=active.length?(active.length===1?'One complete jar will produce all 10–20 babies.':'Two complete jars will split 10–20 babies.')+(incomplete.length?' Incomplete jars are skipped.':''):'Add at least two beetles to a jar and check “Use this jar.”';
 if(Object.keys(state.beetles).length>MAX-20)$('jar-help').textContent='This tank has reached its 3,000-beetle save limit. Save a file before starting a new tank.';
}
function render(){renderTank();renderJars();renderKeepTank();$('notes').value=state.notes||'';$('hero-beetle').innerHTML=(Object.keys(state.beetles).length?B.draw(state.beetles.B7||Object.values(state.beetles)[0],'hero'):'');window.dispatchEvent(new Event('pattern-state'));}
function renderKeepTank(){
 $('collection-count').textContent=state.collection.length+' / 10';$('keep-count').textContent=state.collection.length+' / 10 favorites';$('keep-tank').className='tank keep-tank cooled '+state.settings.backdrop;
 state.keepLayout=state.keepLayout||{};
 $('keep-bugs').innerHTML=state.collection.map((id,i)=>{if(!state.keepLayout[id]){const cells=Array.from({length:10},(_,k)=>({x:.15+(k%5)*.17,y:k<5?.35:.73}));const free=cells.find(c=>!state.collection.some(other=>other!==id&&state.keepLayout[other]&&Math.hypot(c.x-state.keepLayout[other].x,c.y-state.keepLayout[other].y)<.07))||cells[i];state.keepLayout[id]={...free,angle:(motionRandom()-.5)*1.2};}const v=state.keepLayout[id];return `<button class="keep-bug" data-keep="${id}" style="left:${v.x*100}%;top:${v.y*100}%;transform:translate(-50%,-50%) rotate(${v.angle}rad)" aria-label="Inspect ${esc(name(state.beetles[id]))}">${B.draw(state.beetles[id],'keep')}</button>`;}).join('');
 $('keep-empty').hidden=state.collection.length>0;
}
function safely(fn){try{fn();}catch(e){toast(e.message);}}
function move(id,target){safely(()=>{G.move(state,id,target);render();saveSoon();if($('browse').open)renderBrowse();toast(shortName(G.record(state,id))+' moved to '+target.replace('-',' ')+'.');});}
function inspect(id){
 if(!state.beetles[id]){toast('This beetle has left the tank. Its family record is preserved.');return;}selected=id;cool();const b=state.beetles[id],p=G.phenotype(b);$('inspect-title').textContent='Meet '+shortName(b);$('beetle-name').value=b.name;$('specimen-svg').innerHTML=B.draw(b,'inspect');
 $('trait-summary').innerHTML=`<div class="swatches"><span><i class="swatch" style="background:${B.rgb(p.body)}"></i>Body</span>${p.visibleLayers?`<span><i class="swatch" style="background:${B.rgb(p.primary)}"></i>Pattern</span>`:''}${p.visibleLayers===2?`<i class="swatch" style="background:${B.rgb(p.secondary)}"></i>`:''}</div><div class="traits"><span class="trait">${p.visibleLayers===0?'Plain shell':p.shape+' · '+p.visibleLayers+' pattern '+(p.visibleLayers===1?'color':'colors')}</span><span class="trait">${G.antennaNames[p.antenna]}</span><span class="trait">${G.legNames[p.leg]}</span><span class="trait">${p.speed<.75?'Unhurried':p.speed<1.3?'Steady':'Quick'} walker</span><span class="trait">${p.strengthIndex<34?'Light':p.strengthIndex<68?'Medium':'Strong'} strength</span>${p.hairs>.2?'<span class="trait">Fine antenna hairs</span>':''}</div>`;
 $('parent-summary').textContent=(b.parents.length?'Parents: '+b.parents.map(id=>name(G.record(state,id))).join(' + ')+' · '+b.sourceJarId.replace('-',' ')+' · '+b.broodId.replace('-',' '):(b.provenance?'Imported beetle · source '+b.provenance.sourceId:'Founder · part of the starting family'))+' · Lineage generation '+b.lineageGeneration+' · In '+G.container(state,id).replace('-',' ');
 for(let i=1;i<=2;i++){const j=state.jars[i-1];$('add-jar-'+i).disabled=blocked||j.members.includes(id)||j.members.length>=4;}
 $('return-tank').disabled=state.tank.includes(id)||state.tank.length>=48||blocked;$('archive-beetle').disabled=state.collection.includes(id)||state.collection.length>=10||blocked;
 $('keep-capacity').hidden=state.collection.length<10||state.collection.includes(id);
 $('genetic-details').hidden=!state.settings.showStats;
 if(state.settings.showStats){const allele=(a,l)=>l.type==='number'?a.toFixed(2):l.type==='color'?'RGB '+a.rgb.join(',')+' · exp '+a.expression.toFixed(2):a.value+' · exp '+a.expression.toFixed(2);$('genetic-details').innerHTML=`<h3>Behind the shell</h3><p class="hint">Strength is a many-gene breeding-value approximation. Babies normally stay near the parents’ average, with small variation; rare larger strength mutations can shift it further. Other simple genes inherit actual parental copies.</p><p>${p.speed} body lengths/s · strength ${p.strengthIndex}/100<br>Antenna length ${(p.antennaLength).toFixed(2)} × body · ${Math.round(p.segments)} segments<br>${b.mutations.length} mutated copies at birth · ${G.loci.length} paired records (including the strength estimate)<br>Hidden pattern colors: ${p.primary.join(', ')} / ${p.secondary.join(', ')}</p><details><summary>Paired gene copies and strength contributions</summary>${G.chromosomes.map(c=>`<h3>Chromosome ${c.id}</h3><table><thead><tr><th>Gene</th><th>Copy 1</th><th>Copy 2</th></tr></thead><tbody>${c.loci.map(l=>{const cp=G.copies(b,l.key);return `<tr><td>${l.label}</td><td>${allele(cp[0],l)}</td><td>${allele(cp[1],l)}</td></tr>`;}).join('')}</tbody></table>`).join('')}</details>`;}
 if(!$('inspector').open)$('inspector').showModal();
}
function browse(type='all',targetJar=null){browseType=type;browsePage=0;$('browse').dataset.target=targetJar||'';renderBrowse();if(!$('browse').open)$('browse').showModal();cool();}
function renderBrowse(){
 const all=Object.keys(state.beetles),ids=browseType==='all'?all:state[browseType],target=$('browse').dataset.target;
 const eligible=target?ids.filter(id=>!G.container(state,id)?.startsWith('jar-')):ids;
 const maxPage=Math.max(0,Math.ceil(eligible.length/24)-1);browsePage=Math.min(browsePage,maxPage);
 $('browse-title').textContent=target?'Choose for '+target.replace('-',' '):browseType==='all'?'Every beetle':browseType==='nursery'?'The nursery':'Your collection';
 $('browse-hint').textContent=target?'Click a beetle to add it. To move a parent between jars, remove it from its current jar first.':(browseType==='nursery'?'Extra offspring wait here until their brood ages out. Click to inspect, return to the tank, or choose as parents.':'Click a beetle for its enlarged view, family and jar options.');
 $('browse-grid').innerHTML=eligible.slice(browsePage*24,browsePage*24+24).map(id=>{const b=state.beetles[id];return `<button class="browse-card" data-browse="${id}" aria-label="${target?'Choose':'Inspect'} ${esc(name(b))}">${B.draw(b,'browse')}<span>${esc(shortName(b))}</span><small>${id} · Gen ${b.lineageGeneration} · ${G.container(state,id).replace('-',' ')}</small></button>`;}).join('')||'<p class="hint">No beetles here yet.</p>';
 $('page-info').textContent=eligible.length+' beetles · Page '+(browsePage+1)+' of '+(maxPage+1);$('page-prev').disabled=browsePage===0;$('page-next').disabled=browsePage>=maxPage;
}
function configFromForm(){if(!$('class-seed').value.trim()||!$('class-mutation').value.trim())throw Error('Enter both a population seed and a mutation percentage.');return validConfig({v:1,seed:Number($('class-seed').value),mutation:Number($('class-mutation').value)/100,backdrop:$('class-backdrop').value,stats:$('class-stats').checked,environment:$('class-environment').checked,speed:Number($('class-speed').value),sumo:$('class-sumo').checked});}
function download(filename,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function enforcePermissions(s){if(classConfig)Object.assign(s.settings,{showStats:classConfig.stats,allowBackdrop:classConfig.environment,mutation:classConfig.mutation,allowSumo:classConfig.sumo!==false,...(!classConfig.environment?{backdrop:classConfig.backdrop}:{})});return s;}
function restore(s){noPending();state=enforcePermissions(s);resumeState=null;views.clear();selected=null;$('resume-banner').hidden=true;render();saveSoon();cool(false);toast('Tank restored. Your beetles, jars, names and genes are here.');}
function showHistory(){
 $('history-list').innerHTML=state.history.slice().reverse().slice(0,100).map(h=>`<article class="history-item"><strong>Round ${h.broodId.split('-')[1]} · ${h.total} babies</strong><p>${h.allocations.map(a=>a.jarId.replace('-',' ')+': '+a.count+' babies from '+a.parents.map(id=>esc(shortName(G.record(state,id)))).join(', ')).join('<br>')}</p>${h.offspring.map(id=>`<button class="family-link" data-family="${id}" ${state.beetles[id]?'':'disabled'}>${esc(shortName(G.record(state,id)))}${state.beetles[id]?'':' · left tank'}</button>`).join('')}</article>`).join('')||'<p>No broods yet. Choose two parents to begin.</p>';
 $('history').showModal();cool(false);
}
// All wandering randomness is isolated from the genetics stream and saved appearance.
function frame(now){
 if(now-last<1000/30){requestAnimationFrame(frame);return;}
 const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;const box=$('tank-bugs'),width=box.clientWidth,height=box.clientHeight;
 if(width&&height)for(const id of state.tank){const v=ensureView(id);if(!v.el)continue;
  if(running&&!document.hidden&&!document.querySelector('dialog[open]')){
   v.turn+=(motionRandom()-.5)*dt*(.7+3*v.traits.wander+v.traits.curiosity);v.turn*=.98;v.angle+=v.turn*dt;
   let repelX=0,repelY=0,closest=null,closestDistance=Infinity;
   for(const otherId of state.tank){if(otherId===id)continue;const other=views.get(otherId);if(!other)continue;const dx=(v.x-other.x)*width,dy=(v.y-other.y)*height,d=Math.hypot(dx,dy);if(d<closestDistance){closestDistance=d;closest=other;}if(d>0&&d<35){repelX+=dx/d*(35-d)*.3;repelY+=dy/d*(35-d)*.3;}}
   v.x+=repelX*dt/width;v.y+=repelY*dt/height;
   if(v.traits.sociality>.6){if(closest&&closestDistance>45){const target=Math.atan2(closest.x-v.x,-(closest.y-v.y));v.angle+=Math.atan2(Math.sin(target-v.angle),Math.cos(target-v.angle))*dt*v.traits.sociality*.45;}}
   const speed=v.speed*29*animationSpeed;
   v.x+=Math.sin(v.angle)*speed*dt/width;v.y-=Math.cos(v.angle)*speed*dt/height;
   const mx=Math.min(.17,43/width),my=Math.min(.2,50/height);
   if(v.x<mx){v.x=mx;v.angle=Math.abs(v.angle% (Math.PI*2));if(Math.sin(v.angle)<0)v.angle=-v.angle;}
   if(v.x>1-mx){v.x=1-mx;if(Math.sin(v.angle)>0)v.angle=-v.angle;}
   if(v.y<my){v.y=my;if(Math.cos(v.angle)>0)v.angle=Math.PI-v.angle;}
   if(v.y>1-my){v.y=1-my;if(Math.cos(v.angle)<0)v.angle=Math.PI-v.angle;}
  }
  const bw=v.el.offsetWidth,bh=v.el.offsetHeight;v.el.style.transform=`translate(${v.x*width-bw/2}px,${v.y*height-bh/2}px) rotate(${v.angle}rad)`;
 }
 requestAnimationFrame(frame);
}
document.querySelector('a.skip').onclick=e=>{e.preventDefault();$('tank').scrollIntoView({block:'start'});$('motion').focus({preventScroll:true});};
$('motion').onclick=()=>running?cool():run();$('speed').onchange=()=>animationSpeed=Number($('speed').value);
$('backdrop').onchange=()=>{if(!state.settings.allowBackdrop)return;state.settings.backdrop=$('backdrop').value;renderTank();saveSoon();};
$('breed').onclick=()=>safely(()=>{
 if(blocked)return;if(Object.keys(state.beetles).length>MAX-20)throw Error('Save your tank, then start a new one. This save is at its beetle limit.');
 const h=G.breedRound(state,{rng:inheritanceRandom});for(const id of views.keys())if(!state.beetles[id])views.delete(id);render();saveSoon();const text=h.total+' babies born! '+h.allocations.map(a=>a.jarId.replace('-',' ')+' → '+a.count).join(' · ')+(state.nursery.length?' · Extra babies are in the nursery.':'');$('last-brood').textContent=text;$('last-brood').hidden=false;toast(text);
});
$('jars').addEventListener('change',e=>{if(e.target.dataset.active){state.jars.find(j=>j.id===e.target.dataset.active).active=e.target.checked;renderJars();saveSoon();}});
$('jars').addEventListener('click',e=>{const inspectButton=e.target.closest('[data-inspect]'),remove=e.target.closest('[data-remove]'),pick=e.target.closest('[data-pick]');if(inspectButton)inspect(inspectButton.dataset.inspect);if(remove)move(remove.dataset.remove,state.tank.length<48?'tank':'nursery');if(pick)browse('all',pick.dataset.pick);});
$('jars').addEventListener('dragover',e=>{const slot=e.target.closest('[data-drop]');if(slot){e.preventDefault();e.dataTransfer.dropEffect='move';slot.classList.add('drag-over');}});
$('jars').addEventListener('dragleave',e=>e.target.closest('[data-drop]')?.classList.remove('drag-over'));
$('jars').addEventListener('drop',e=>{const slot=e.target.closest('[data-drop]');if(!slot)return;e.preventDefault();slot.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id===dragId&&state.tank.includes(id))move(id,slot.dataset.drop);});
for(let i=1;i<=2;i++)$('add-jar-'+i).onclick=()=>{if(!selected)return;move(selected,'jar-'+i);inspect(selected);};
$('return-tank').onclick=()=>{if(selected){move(selected,'tank');inspect(selected);}};$('archive-beetle').onclick=()=>{if(selected){move(selected,'collection');inspect(selected);}};
$('beetle-name').oninput=()=>{if(!selected)return;state.beetles[selected].name=$('beetle-name').value.slice(0,40);$('inspect-title').textContent='Meet '+shortName(state.beetles[selected]);saveSoon();};
$('inspector').addEventListener('close',()=>{render();if($('browse').open)renderBrowse();});
$('clear-unsaved').onclick=()=>safely(()=>{if(blocked)return;if(!confirm('Clear all unsaved beetles from the tank and nursery? Keep tank favorites, jar parents and pending trade beetles stay. This cannot be undone.'))return;const ids=G.cleanup(state,{all:true});for(const id of ids)views.delete(id);selected=null;render();saveSoon();toast(ids.length+' unsaved beetles cleared. Favorites and parents are safe.');});
$('open-nursery').onclick=()=>browse('nursery');$('open-collection').onclick=()=>{cool(false);renderKeepTank();$('keep').showModal();};$('open-all').onclick=()=>browse();
$('keep-bugs').onclick=e=>{const el=e.target.closest('[data-keep]');if(el)inspect(el.dataset.keep);};
$('keep-save').onclick=()=>{saveNow();download('Pattern-Lab-keep-tank-round-'+state.round+'.json',state);toast('Saved the Keep tank, all genes and the experiment’s family records.');};
$('browse-grid').onclick=e=>{const el=e.target.closest('[data-browse]');if(!el)return;const target=$('browse').dataset.target;if(target){move(el.dataset.browse,target);if(state.jars.find(j=>j.id===target).members.includes(el.dataset.browse))$('browse').close();}else inspect(el.dataset.browse);};
$('page-prev').onclick=()=>{browsePage--;renderBrowse();};$('page-next').onclick=()=>{browsePage++;renderBrowse();};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$ (button.dataset.close).close();
for(const id of ['guide','teacher'])$(id+'-open').onclick=()=>{cool(false);if(id==='teacher'){if(classConfig){toast('This is a student class link. Open the teacher edition to make a new link.');return;}$('class-seed').value=state.seed;$('class-mutation').value=state.settings.mutation*100;$('class-backdrop').value=state.settings.backdrop;$('class-stats').checked=state.settings.showStats;$('class-environment').checked=state.settings.allowBackdrop;$('class-speed').value=animationSpeed;$('class-sumo').checked=state.settings.allowSumo!==false;}$(id).showModal();};
if(classConfig)$('teacher-open').hidden=true;
$('create-link').onclick=()=>safely(()=>{const code=encode(configFromForm()),u=new URL(location.protocol==='file:'?'https://ragingaxolotl-art.github.io/leaf-and-lineage/pattern-lab/':location.href);u.search='?v=PL2-20261022-3';u.hash='class='+code;$('student-link').value=u.href;$('copy-link').disabled=false;$('link-status').textContent='Ready. The link starts a fresh student tank with these presets.';});
$('try-settings').onclick=()=>safely(()=>{noPending();const c=configFromForm();if(!confirm('Start a new teacher tank with these presets? Save your current tank file first to keep it.'))return;state=newState(c);animationSpeed=c.speed;$('speed').value=c.speed;resumeState=null;views.clear();$('resume-banner').hidden=true;$('last-brood').hidden=true;$('teacher').close();render();cool(false);saveSoon();toast('Teacher presets applied.');});
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('student-link').value);$('link-status').textContent='Copied. Share this full link with your class.';}catch(e){$('student-link').select();$('link-status').textContent='Select and copy the link above.';}};
$('notes').oninput=()=>{state.notes=$('notes').value.slice(0,10000);saveSoon();};$('notes').maxLength=10000;
$('save').onclick=()=>{saveNow();download('Pattern-Lab-round-'+state.round+'.json',state);toast('Tank file saved. It includes every beetle and its genes.');};
$('load').onclick=()=>$('load-file').click();$('load-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>32*1024*1024)throw Error('This file is too large. Choose a Pattern Lab tank file under 32 MB.');const s=G.validate(JSON.parse(await f.text()));if(confirm('Open this saved tank? Save your current tank file first if you want to keep it.'))restore(s);}catch(err){toast('Could not open tank: '+err.message);}e.target.value='';};
$('restart').onclick=()=>safely(()=>{noPending();if(confirm('Start a new tank? Save a tank file first to keep these beetles.')){state=newState(classConfig);views.clear();render();$('last-brood').hidden=true;$('resume-banner').hidden=true;saveSoon();toast('A fresh tank. Founders repeat; breeding rolls are new.');}});
$('resume').onclick=()=>restore(resumeState);$('dismiss-resume').onclick=()=>{$('resume-banner').hidden=true;resumeState=null;saveSoon();};
$('history-open').onclick=showHistory;$('history-list').onclick=e=>{const button=e.target.closest('[data-family]');if(button)inspect(button.dataset.family);};
$('export-data').onclick=()=>{if(state.settings.showStats)download('Pattern-Lab-family-data.json',state);else download('Pattern-Lab-family-records.json',{rounds:state.history,beetles:Object.values(state.beetles).map(b=>({id:b.id,name:b.name,parents:b.parents,sourceJarId:b.sourceJarId,broodId:b.broodId,lineageGeneration:b.lineageGeneration}))});};
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden)saveNow();});window.addEventListener('pagehide',saveNow);
globalThis.PatternLabApp={getState:()=>state,checkpoint,tradeBegin:info=>{if(blocked)throw Error('Open a valid class link first.');noPending();const b=state.beetles[info.outgoing];if(!b||G.container(state,b.id)?.startsWith('jar-'))throw Error('Choose a beetle from the tank or Keep tank, outside the parent jars.');const next=G.clone(state);next.pendingTrade=info;next.tradeLocks=[b.id];checkpoint(next);state=next;render();},tradeCancel:()=>{const next=G.clone(state);next.pendingTrade=null;next.tradeLocks=[];checkpoint(next);state=next;render();},tradeComplete:incoming=>{const next=G.clone(state);if(!next.pendingTrade)throw Error('Open the original tank to collect this trade.');const b=G.finishTrade(next,{...next.pendingTrade,incoming});next.pendingTrade=null;checkpoint(next);state=next;render();return b;},getSelected:()=>selected,inspect,cool,toast,refresh:render,save:saveSoon,isBlocked:()=>blocked,addBeetle:packet=>{if(blocked)throw Error('Open a valid class link first.');const b=G.importPacket(state,packet);render();saveSoon();return b;}};
if(resumeState?.pendingTrade)restore(resumeState);
animationSpeed=classConfig?.speed||1;$('speed').value=animationSpeed;render();if(!running)cool(false);if(blocked){cool(false);$('motion').disabled=true;document.querySelectorAll('[data-pick]').forEach(b=>b.disabled=true);}
if(!classConfig&&!blocked&&new URLSearchParams(location.search).has('teacher'))$('teacher-open').click();
requestAnimationFrame(frame);
})();

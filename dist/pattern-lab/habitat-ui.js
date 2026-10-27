/* Arrange each tank with pointer or keyboard; favorite markers stay outside beetle art. */
(async function(){
'use strict';
await PatternLabReady;
const H=PatternHabitat,A=PatternLabApp,$=id=>document.getElementById(id),panels={},esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active=null,selection=null,drag=null,resume=false,lastState=null;
const tankState=kind=>H.ensure(A.getState())[kind];
function selected(){return active?tankState(active).objects.find(o=>o.id===selection):null;}
function announce(kind,message){panels[kind].status.textContent=message;}
function edit(kind,on){
 if(on&&A.isBlocked())return;
 if(on){if(active)edit(active,false);resume=!$('tank').classList.contains('cooled');A.cool(false);active=kind;selection=null;}
 else {active=null;selection=null;if(resume&&!document.hidden)$('motion').click();resume=false;}
 for(const k of ['tank','keep']){const editing=active===k,p=panels[k];p.box.classList.toggle('habitat-editing',editing);p.tools.hidden=!editing;p.toggle.setAttribute('aria-pressed',String(editing));p.toggle.textContent=editing?'Finish arranging':'Arrange habitat';}
 render();if(on)announce(kind,'Choose an object. Drag it, or use arrow keys to move it. R rotates it.');
}
function save(kind,message){A.save();render();announce(kind,message);}
function choose(kind,id){selection=id;for(const e of panels[kind].layer.querySelectorAll('[data-habitat-object]'))e.setAttribute('aria-pressed',String(e.dataset.habitatObject===id));updateTools(kind);}
function updateTools(kind){const o=active===kind?selected():null,p=panels[kind];p.rotate.disabled=p.remove.disabled=!o;p.choice.textContent=o?H.names[o.kind]:'Choose an object';for(const b of p.tools.querySelectorAll('[data-add-object]'))b.disabled=tankState(kind).objects.length>=12;}
function position(el,o,kind){const box=$(kind==='tank'?'tank-bugs':'keep-bugs'),q=H.shape(o,box.clientWidth,box.clientHeight);el.style.left=o.x*100+'%';el.style.top=o.y*100+'%';el.style.width=q.rx*2+'px';el.style.height=q.ry*2+'px';el.style.transform='translate(-50%,-50%) rotate('+o.angle+'deg)';}
function render(){
 for(const kind of ['tank','keep']){const p=panels[kind];if(!p)continue;const t=tankState(kind),existing=new Map([...p.layer.querySelectorAll('[data-habitat-object]')].map(e=>[e.dataset.habitatObject,e]));
  for(const o of t.objects){let el=existing.get(o.id);existing.delete(o.id);if(!el){el=document.createElement('button');el.type='button';el.className='habitat-object habitat-'+o.kind;el.dataset.habitatObject=o.id;el.innerHTML='<span class="habitat-art" aria-hidden="true"><i></i></span>';p.layer.append(el);bind(el,kind,o.id);}el.tabIndex=active===kind?0:-1;el.setAttribute('aria-label',H.names[o.kind]+'. Drag or use arrow keys to move; R to rotate.');el.setAttribute('aria-pressed',String(active===kind&&selection===o.id));el.title=H.names[o.kind];position(el,o,kind);}
  for(const el of existing.values())el.remove();updateTools(kind);
 }update();
}
function rotate(kind){const o=selected();if(!o)return;o.angle=(o.angle+15+360)%360;save(kind,H.names[o.kind]+' rotated.');}
function remove(kind){const o=selected();if(!o)return;tankState(kind).objects=tankState(kind).objects.filter(x=>x!==o);selection=null;save(kind,H.names[o.kind]+' removed.');}
function bind(el,kind,id){
 el.addEventListener('focus',()=>{if(active===kind)choose(kind,id);});el.addEventListener('click',()=>{if(active===kind)choose(kind,id);});
 el.addEventListener('pointerdown',e=>{if(active!==kind||e.button!==0||A.isBlocked())return;e.preventDefault();choose(kind,id);el.focus({preventScroll:true});const o=selected(),rect=panels[kind].layer.getBoundingClientRect();drag={id,kind,pointer:e.pointerId,dx:e.clientX-rect.left-o.x*rect.width,dy:e.clientY-rect.top-o.y*rect.height};el.setPointerCapture(e.pointerId);});
 el.addEventListener('pointermove',e=>{if(!drag||drag.id!==id||drag.kind!==kind||drag.pointer!==e.pointerId)return;const rect=panels[kind].layer.getBoundingClientRect(),o=selected();if(!o||!rect.width||!rect.height)return;o.x=H.clamp((e.clientX-rect.left-drag.dx)/rect.width,.08,.92);o.y=H.clamp((e.clientY-rect.top-drag.dy)/rect.height,.1,.9);position(el,o,kind);});
 const release=e=>{if(drag?.id!==id||drag.pointer!==e.pointerId)return;drag=null;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);save(kind,'Habitat position saved.');};
 el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
 el.addEventListener('keydown',e=>{if(active!==kind)return;const o=tankState(kind).objects.find(o=>o.id===id),step=e.shiftKey?.005:.02;if(!o)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();o.x=H.clamp(o.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),.08,.92);o.y=H.clamp(o.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0),.1,.9);save(kind,'Habitat position saved.');}
  else if(e.key.toLowerCase()==='r'){e.preventDefault();choose(kind,id);rotate(kind);}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();choose(kind,id);remove(kind);panels[kind].toggle.focus();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();edit(kind,false);panels[kind].toggle.focus();}
 });
}
function update(){
 const s=A.getState();if(lastState!==s){lastState=s;requestAnimationFrame(render);}
 for(const kind of ['tank','keep']){const p=panels[kind],t=tankState(kind),ids=kind==='tank'?s.tank:s.collection,count=ids.filter(id=>t.memories[id]).length;p.memory.textContent=count?count+' beetle'+(count===1?' has':'s have')+' learned a favorite spot.':'Favorite spots develop as beetles rest and explore.';
  const show=p.show.checked;p.markers.hidden=!show;const signature=show?JSON.stringify(ids.map(id=>[id,t.memories[id],s.beetles[id]?.name])):'';
  if(p.signature!==signature){p.signature=signature;p.markers.innerHTML=show?ids.filter(id=>t.memories[id]).map(id=>{const m=t.memories[id],b=s.beetles[id],o=t.objects.find(o=>o.id===m.objectId),label=(b.name||id)+' · '+(o?H.names[o.kind]:'Remembered resting place');return '<span class="favorite-marker" style="left:'+m.x*100+'%;top:'+m.y*100+'%" title="'+esc(label)+'"><span>'+esc(b.name||id)+'</span></span>';}).join(''):'';}
 }
 if($('inspector').open){const id=A.getSelected(),kind=s.collection.includes(id)?'keep':'tank',m=tankState(kind).memories[id],o=m&&tankState(kind).objects.find(o=>o.id===m.objectId);$('favorite-summary').textContent=m?'Favorite place: '+(o?H.names[o.kind].toLowerCase():'a remembered resting spot')+' · '+m.visits+' visit'+(m.visits===1?'':'s')+'. This preference was learned in this tank.':'This beetle is still discovering its favorite places.';}
}
for(const kind of ['tank','keep']){
 const box=$(kind==='tank'?'tank':'keep-tank'),controls=document.createElement('section');controls.className='habitat-controls';controls.setAttribute('aria-label',kind==='tank'?'Breeder habitat controls':'Keep habitat controls');
 controls.innerHTML='<div class="habitat-control-row"><button type="button" class="habitat-toggle" aria-pressed="false">Arrange habitat</button><label><input type="checkbox" class="show-favorites"> Show favorite spots</label></div><div class="habitat-tools" hidden><div class="habitat-add"><button type="button" data-add-object="leaf">+ Leaf</button><button type="button" data-add-object="bark">+ Bark tunnel</button><button type="button" data-add-object="stone">+ Stone</button><button type="button" data-add-object="bridge">+ Twig bridge</button></div><div class="habitat-selection"><span class="habitat-choice">Choose an object</span><button type="button" class="habitat-rotate" disabled>Rotate ↻</button><button type="button" class="habitat-remove" disabled>Remove object</button></div><p class="hint">Drag objects, or focus one and use arrow keys. R rotates; Delete removes. Up to 12 objects per tank.</p></div><p class="habitat-memory hint"></p><p class="habitat-status hint" role="status" aria-live="polite"></p>';
 box.after(controls);const layer=document.createElement('div');layer.className='habitat-layer';layer.setAttribute('aria-label','Movable habitat objects');box.append(layer);const markers=document.createElement('div');markers.className='favorite-layer';markers.hidden=true;markers.setAttribute('aria-hidden','true');box.append(markers);
 const p=panels[kind]={box,layer,markers,controls,toggle:controls.querySelector('.habitat-toggle'),tools:controls.querySelector('.habitat-tools'),choice:controls.querySelector('.habitat-choice'),rotate:controls.querySelector('.habitat-rotate'),remove:controls.querySelector('.habitat-remove'),show:controls.querySelector('.show-favorites'),memory:controls.querySelector('.habitat-memory'),status:controls.querySelector('.habitat-status')};
 p.toggle.onclick=()=>edit(kind,active!==kind);p.rotate.onclick=()=>rotate(kind);p.remove.onclick=()=>remove(kind);p.show.onchange=update;
 for(const b of p.tools.querySelectorAll('[data-add-object]'))b.onclick=()=>{try{const o=H.add(tankState(kind),b.dataset.addObject);selection=o.id;save(kind,H.names[o.kind]+' added.');p.layer.querySelector('[data-habitat-object="'+o.id+'"]').focus();}catch(e){announce(kind,e.message);}};
 p.toggle.disabled=A.isBlocked();
}
const detail=document.createElement('p');detail.id='favorite-summary';detail.className='hint';$('parent-summary').after(detail);
$('open-collection').addEventListener('click',()=>requestAnimationFrame(render));
$('keep').addEventListener('close',()=>{if(active==='keep')edit('keep',false);});
window.addEventListener('resize',render);window.addEventListener('pattern-state',render);
globalThis.PatternHabitatUI={render,update};render();
})();

/* Harmless, temporary tank behavior. Never reads or writes genomes or breeding RNG. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./habitat.js'):root.PatternHabitat,typeof module==='object'&&module.exports?require('./field-life.js'):root.PatternFieldLife,typeof module==='object'&&module.exports?require('./living-world.js'):root.PatternLivingWorld);if(typeof module==='object'&&module.exports)module.exports=api;else root.PatternTankBehavior=api;})(globalThis,function(H,F,W){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const labels={explore:'Exploring',investigate:'Investigating',follow:'Following',greet:'Greeting',avoid:'Making space',shove:'Gentle shove',yield:'Backing away',rest:'Resting',food:'Finding food',eat:'Eating',water:'Finding water',drink:'Drinking',warm:'Seeking warmth',bask:'Warming up',held:'Being held',home:'Returning to favorite spot',settle:'Resting under cover',search:'Looking for moved shelter',groom:'Grooming',shelter:'Investigating shelter',companion:'Approaching familiar neighbor',restmate:'Resting with familiar neighbor',contest:'Contesting a perch',crossing:'Crossing twig bridge',wait:'Waiting for a clear route'};
const stations=[{kind:'food',x:.16,y:.72},{kind:'water',x:.82,y:.75},{kind:'warm',x:.78,y:.22}];
const value=(p,k)=>clamp(Number.isFinite(p[k])?p[k]:.5,0,1);
const needKey={food:'hunger',water:'thirst',warm:'chill'},taskMode={food:'food',eat:'food',water:'water',drink:'water',warm:'warm',bask:'warm'};
function drives(p){return {food:.001+.006*value(p,'appetite'),water:.001+.008*value(p,'thirstDrive'),warm:.0005+.005*value(p,'heatPreference')};}
function threshold(p,kind){return kind==='warm'?.88-.36*value(p,'heatPreference'):.82-.24*value(p,kind==='food'?'appetite':'thirstDrive');}
function hold(a){if(!a.behavior)return;const m=a.behavior;if(taskMode[m.mode]){m.intent=taskMode[m.mode];m.intentAge=0;}m.mode='held';m.wasHeld=true;}
function release(a){if(!a.behavior)return;const m=a.behavior,focus=value(a.traits||{},'focus');m.wasHeld=false;m.mode='explore';m.target=null;m.decision=0;m.remaining=0;m.heading=a.angle;m.distraction=(1-focus)*2.5;}
function memory(rng){return {mode:'explore',target:null,decision:0,remaining:0,cooldown:0,socialWait:0,energy:.7+rng()*.3,heading:rng()*Math.PI*2,bubble:0,hunger:.2+rng()*.5,thirst:.2+rng()*.5,chill:.2+rng()*.5};}
// Anatomy changes detection, footing and clearance gradually; personality still matters.
function anatomy(p){
 const n=(key,fallback=1)=>Number.isFinite(p[key])?p[key]:fallback;
 const antenna=clamp(n('antennaLength')*n('antennaFactor'),.1,8);
 const stance=clamp((n('legSpread')-.7)/.7,0,1),foot=clamp((n('foot')-.5)/1.3,0,1);
 return {sense:60+36*Math.sqrt(antenna)+12*value(p,'hairs')+12*value(p,'branchLength'),footing:clamp(.3+.3*value(p,'grip')+.2*stance+.15*foot+(['hooked','sturdy','spiny'].includes(p.leg)?.05:0),0,1),size:clamp(n('bodyFactor'),.125,4)};
}
function comfort(p,o){return ['bark','arch'].includes(o.kind)?.45+.45*value(p,'caution')+.1*(1-value(p,'wander')):['leaf','sprout'].includes(o.kind)?.4+.3*value(p,'curiosity')+.15*value(p,'caution'):0;}
function remember(a,m,memories,o){
 if(!memories)return;const old=memories[a.id],score=o?comfort(a.traits||{},o):.35;
 if(!old||old.objectId===(o?.id||null)||score>old.comfort+.06){memories[a.id]={objectId:o?.id||null,x:o?.x??a.x,y:o?.y??a.y,visits:Math.min(1000000,(old?.objectId===(o?.id||null)?old.visits:0)+1),comfort:score};}
 m.learned=true;
}
function pose(a){if(a.held)return 'held';if(a.behavior?.tableau)return 'alert';if(a.behavior?.mode==='crossing'&&a.behavior.bridgePhase===1)return 'balance';if(a.behavior?.drama)return {bridge:'look',leaf:'balance',crumb:'groom'}[a.behavior.drama.kind];const mode=a.held?'held':a.behavior?.mode;return ['rest','settle','restmate'].includes(mode)?'rest':mode==='groom'?'groom':['investigate','shelter','search'].includes(mode)?'look':['food','eat','drink','water'].includes(mode)?(mode==='eat'||mode==='drink'?'eat':'look'):mode==='bask'?'bask':['avoid','yield','shove','greet'].includes(mode)?'alert':mode==='held'?'held':'walk';}
// Pick a stable clear approach point when an object overlaps a dish or resting target.
function accessGoal(r,point,solids,width,height,stamp){
 const pad=r.r+4,mx=Math.min(width*.48,r.a.radius||24),my=Math.min(height*.48,r.a.radius||24),base={x:clamp(point.x,mx,width-mx),y:clamp(point.y,my,height-my)};
 const clear=p=>solids.every(q=>{const c=Math.cos(q.angle),s=Math.sin(q.angle),dx=p.x-q.x,dy=p.y-q.y;return Math.hypot((c*dx+s*dy)/(q.rx+pad),(-s*dx+c*dy)/(q.ry+pad))>=1.03;});
 if(clear(base))return {...base,shift:Math.hypot(base.x-point.x,base.y-point.y)};
 const key=point.x+','+point.y+','+pad+','+mx+','+my+','+stamp;
 if(r.m.access?.key===key)return r.m.access.goal;
 let best=null,cost=Infinity;const reach=Math.min(width,height)*.7;
 for(let radius=12;radius<=reach;radius+=12){for(let i=0;i<32;i++){const a=i*Math.PI/16,p={x:clamp(base.x+Math.cos(a)*radius,mx,width-mx),y:clamp(base.y+Math.sin(a)*radius,my,height-my)};if(!clear(p))continue;const score=Math.hypot(p.x-point.x,p.y-point.y)+.12*Math.hypot(p.x-r.x,p.y-r.y);if(score<cost){best=p;cost=score;}}if(best&&radius>Math.hypot(best.x-base.x,best.y-base.y)+24)break;}
 const goal=best?{...best,shift:Math.hypot(best.x-point.x,best.y-point.y)}:null;r.m.access={key,goal};return goal;
}
function solid(o,p){return o.kind==='stone'||o.kind==='droplet'&&((p.legLength||1)*(p.legFactor||1)<1.6||value(p,'grip')<.65);}
function planBridge(r,o,width,height){const ends=H.bridgeEnds(o,width,height,r.a.radius||24),first=Math.hypot(ends[0].x-r.x,ends[0].y-r.y)<=Math.hypot(ends[1].x-r.x,ends[1].y-r.y)?0:1,m=r.m;m.mode='crossing';m.objectId=o.id;m.bridgePhase=0;m.point={x:ends[first].x,y:ends[first].y,nx:ends[first].x/width,ny:ends[first].y/height};m.bridgeExit={x:ends[1-first].x/width,y:ends[1-first].y/height};m.bridgeStamp=[o.x,o.y,o.angle,width,height].join(',');m.remaining=m.decision=42;}
function step(agents,{width,height,dt,rng=Math.random,stations:places=stations,objects=[],memories,life,world}={}){
 if(!(width>0&&height>0&&dt>0))return;
 dt=Math.min(dt,.05);
 // All decisions see the same position snapshot; each contact pair is resolved once.
 const rows=agents.map(a=>{a.behavior=a.behavior||memory(rng);const radius=clamp((a.radius||30)*.55,11,Math.min(width,height)*.36);return {a,m:a.behavior,p:a.traits||{},x:a.x*width,y:a.y*height,r:radius,dx:0,dy:0};});
 W.tick(agents,objects,{world,width,height,dt,H,rng});
 F.tickLife(agents,{life,objects,width,height,dt,rng});
 const byId=new Map(rows.map(r=>[r.a.id,r])),solids=objects.filter(o=>['stone','droplet'].includes(o.kind)).map(o=>({...H.shape(o,width,height),kind:o.kind})),layoutStamp=[width,height,...objects.filter(o=>['stone','droplet'].includes(o.kind)).flatMap(o=>[o.id,o.x,o.y,o.angle])].join(',');
 for(const r of rows){const {a,m,p}=r;
  m.cooldown=Math.max(0,m.cooldown-dt);m.socialWait=Math.max(0,(m.socialWait||0)-dt);m.bubble=Math.max(0,m.bubble-dt);m.decision-=dt;m.remaining-=dt;
  if(a.held){hold(a);continue;}
  if(m.wasHeld)release(a);
  if(m.tableau){m.mode='faceoff';m.remaining=m.decision=.1;continue;}
  if(m.bridgeYield>0){m.bridgeYield=Math.max(0,m.bridgeYield-dt);continue;}
  if(m.drama&&m.drama.kind!=='leaf'){m.bubble=.5;continue;}
  const rates=drives(p);for(const kind of Object.keys(needKey)){const k=needKey[kind];m[k]=clamp((m[k]||0)+dt*rates[kind],0,1);}
  const focus=value(p,'focus');m.distraction=Math.max(0,(m.distraction||0)-dt);m.intentAge=(m.intentAge||0)+dt;
  if(m.intent&&(m[needKey[m.intent]]<.24||m.intentAge>10+180*focus||!places.some(q=>q.kind===m.intent))){m.intent=null;m.intentAge=0;}
  m.bridgeWait=Math.max(0,(m.bridgeWait||0)-dt);
  m.familiarWait=Math.max(0,(m.familiarWait??(10+Math.abs(m.heading)*3))-dt);m.groomWait=Math.max(0,(m.groomWait??(18+Math.abs(m.heading)*4))-dt);
  const body=anatomy(p),shelters=objects.filter(o=>['leaf','bark','arch','sprout'].includes(o.kind)),favorite=memories?.[a.id];
  const sensed=shelters.filter(o=>Math.hypot(o.x*width-r.x,o.y*height-r.y)<body.sense+60*value(p,'tracking')).sort((a,b)=>comfort(p,b)-comfort(p,a));
  let currentObject=objects.find(o=>o.id===m.objectId);
  const bridge=objects.filter(o=>o.kind==='bridge').map(o=>({o,d:Math.hypot(o.x*width-r.x,o.y*height-r.y)})).filter(v=>v.d<body.sense+H.shape(v.o,width,height).rx).sort((a,b)=>a.d-b.d)[0]?.o;
  if(m.mode==='crossing'){if(!currentObject||currentObject.kind!=='bridge'){m.mode='explore';m.remaining=m.decision=0;m.bridgeWait=5;}else if(m.bridgeStamp!==[currentObject.x,currentObject.y,currentObject.angle,width,height].join(','))planBridge(r,currentObject,width,height);}
  if(m.mode==='shelter'&&currentObject)m.point={x:currentObject.x*width,y:currentObject.y*height,nx:currentObject.x,ny:currentObject.y};
  if(['shelter','settle'].includes(m.mode)&&(!currentObject||currentObject.kind==='stone')){m.mode='search';m.remaining=2;m.decision=2;}
  if(m.mode==='settle'&&currentObject&&Math.hypot(currentObject.x*width-r.x,currentObject.y*height-r.y)>Math.max(30,r.r)){m.mode='search';m.remaining=2;m.decision=2;}
  if(['shelter','home'].includes(m.mode)&&m.point){m.point.x=m.point.nx*width;m.point.y=m.point.ny*height;}
  if(['settle','groom','restmate'].includes(m.mode)&&m.remaining<=0){m.mode='explore';m.heading=a.angle+Math.PI/2;m.remaining=2;m.decision=2;m.familiarWait=14+20*(1-value(p,'persistence'));m.groomWait=25;}

  const social=value(p,'sociality'),caution=value(p,'caution'),curious=value(p,'curiosity'),persist=value(p,'persistence'),wander=value(p,'wander');
  const neighbors=rows.filter(o=>o!==r).map(o=>({o,d:Math.hypot(o.x-r.x,o.y-r.y)})).sort((x,y)=>x.d-y.d),near=neighbors[0],sense=40+body.sense+70*value(p,'tracking')+80*social;
  const friends=neighbors.filter(n=>F.bond(life,a.id,n.o.a.id)?.familiarity>=.4),friend=friends.find(n=>n.d<sense),rival=neighbors.find(n=>n.d<sense&&F.bond(life,a.id,n.o.a.id)?.rivalry>=.35),nearBond=near&&F.bond(life,a.id,near.o.a.id);
  const target=byId.get(m.target);
  if(m.mode==='greet'&&m.remaining<=0){m.mode='explore';m.heading=target?Math.atan2(r.x-target.x,-(r.y-target.y)):a.angle+Math.PI;m.target=null;m.socialWait=3;m.remaining=1.3;m.decision=1.3;}
  if(m.decision<=0||m.remaining<=0||m.target&&!target||m.mode==='held'){
   m.decision=.6+1.4*(1-value(p,'reaction'))+rng()*.4;m.remaining=1.2+persist*3+value(p,'focus');m.target=null;
   if(m.energy<.18||m.mode==='rest'&&m.energy<.72){
    if(friend&&m.energy>.08){m.mode='companion';m.target=friend.o.a.id;m.remaining=12;m.decision=12;}
    else if(favorite&&m.energy>.08){m.mode='home';m.point={nx:favorite.x,ny:favorite.y,x:favorite.x*width,y:favorite.y*height};m.objectId=favorite.objectId;m.remaining=14;m.decision=14;}
    else {m.mode='rest';m.remaining=2;m.decision=1;}
   }
   else if(m.distraction<=0&&places.length&&(m.intent||places.some(q=>m[needKey[q.kind]]>=threshold(p,q.kind)))){
    const wanted=m.intent||places.slice().sort((a,b)=>m[needKey[b.kind]]/threshold(p,b.kind)-m[needKey[a.kind]]/threshold(p,a.kind))[0].kind,foodObject=wanted==='food'?W.food(objects,a,width,height):null,place=foodObject||places.find(q=>q.kind===wanted);
    if(place&&(!m.intent||rng()<.2+.8*focus)){
     m.foodObjectId=foodObject?.id||null;if(!m.intent)m.intentAge=0;m.intent=wanted;m.mode=wanted;m.point={x:place.x*width,y:place.y*height};m.remaining=1.2+8*focus+2*persist;m.decision=m.remaining;
    }else {m.mode='explore';m.heading=a.angle+(rng()-.5)*2;m.remaining=1+2*(1-focus);m.decision=m.remaining;}
   }
   else if(near&&near.d<sense&&caution>.6&&social<.6&&!(nearBond?.familiarity>=.4)){m.mode='avoid';m.target=near.o.a.id;}
   else if(near&&near.d<sense&&m.socialWait<=0&&rng()<social*(1-.45*wander)){m.mode='follow';m.target=near.o.a.id;}
   else if(friend&&m.familiarWait<=0){m.mode='companion';m.target=friend.o.a.id;m.remaining=12;m.decision=12;m.familiarWait=25;}
   else if(rival&&m.cooldown<=0&&value(p,'pushDrive')>.55&&objects.some(o=>Math.hypot(o.x*width-r.x,o.y*height-r.y)<100)){m.mode='contest';m.target=rival.o.a.id;m.remaining=2;m.decision=2;}
   else if(memories&&favorite&&m.familiarWait<=0){m.mode='home';m.objectId=favorite.objectId;m.point={nx:favorite.x,ny:favorite.y,x:favorite.x*width,y:favorite.y*height};m.remaining=16;m.decision=16;m.familiarWait=20;}
   else if(bridge&&m.bridgeWait<=0&&rng()<.25+.5*curious){planBridge(r,bridge,width,height);}
   else if(memories&&sensed.length&&(m.familiarWait<=0||!favorite)&&rng()<.22+.5*curious+.25*caution){const o=sensed[0];m.mode='shelter';m.objectId=o.id;m.point={nx:o.x,ny:o.y,x:o.x*width,y:o.y*height};m.remaining=12;m.decision=12;}
   else if(memories&&m.groomWait<=0){m.mode='groom';m.remaining=1.6+1.2*value(p,'recovery');m.decision=m.remaining;m.groomWait=25;}
   else if(world?.active&&world.visitors.length&&curious>.4&&rng()<curious*.3){const v=world.visitors[Math.floor(rng()*world.visitors.length)];m.mode='investigate';m.point={x:v.x*width,y:v.y*height};}
   else if(rng()<curious*.7){m.mode='investigate';m.point={x:width*(.12+rng()*.76),y:height*(.14+rng()*.72)};}
   else {m.mode='explore';m.heading=a.angle+(rng()-.5)*(1+4*wander);}
  }
  currentObject=objects.find(o=>o.id===m.objectId);
  if(['food','eat'].includes(m.mode)&&m.foodObjectId){const crumb=objects.find(o=>o.id===m.foodObjectId);if(crumb)m.point={x:crumb.x*width,y:crumb.y*height};else {m.foodObjectId=null;m.mode='explore';m.remaining=m.decision=0;}}
  let desired=a.angle,pace=1;
  const goal=m.point&&['home','shelter','food','eat','water','drink','warm','bask','crossing'].includes(m.mode)?accessGoal(r,m.point,solids.filter(q=>solid(q,p)),width,height,layoutStamp):null;
  if(m.point&&['home','shelter','food','eat','water','drink','warm','bask','crossing'].includes(m.mode)&&!goal){m.mode='wait';m.remaining=m.decision=1;}
  const other=byId.get(m.target),distance=other?Math.hypot(other.x-r.x,other.y-r.y):Infinity;
  if(['rest','settle','restmate','groom','search','wait'].includes(m.mode)){pace=0;
   if(m.mode==='rest'&&!m.learned)remember(a,m,memories,null);
   if(m.mode==='settle'){m.dwell=(m.dwell||0)+dt;if(m.dwell>1.5&&!m.learned)remember(a,m,memories,currentObject);}
   if(m.mode==='search'){a.angle+=dt*.7;if(sensed.length){const o=sensed[0];m.mode='shelter';m.objectId=o.id;m.point={nx:o.x,ny:o.y,x:o.x*width,y:o.y*height};m.remaining=12;m.decision=12;}else if(m.remaining<.1){if(memories&&favorite)delete memories[a.id];m.familiarWait=8;}}
m.energy=Math.min(1,m.energy+dt*(.09+.13*value(p,'recovery')));}
  else {
   if(m.mode==='crossing'&&goal){desired=Math.atan2(goal.x-r.x,-(goal.y-r.y));pace=m.bridgePhase===1?.4+.55*body.footing:.75;if(Math.hypot(goal.x-r.x,goal.y-r.y)<Math.max(14,r.r*.55)){if(m.bridgePhase===0){m.bridgePhase=1;m.point={x:m.bridgeExit.x*width,y:m.bridgeExit.y*height,nx:m.bridgeExit.x,ny:m.bridgeExit.y};}else {m.crossings=(m.crossings||0)+1;m.mode='explore';m.heading=a.angle;m.point=null;m.bridgeWait=20+15*(1-curious);m.remaining=m.decision=2;}}}
   else if(m.mode==='companion'&&other){desired=Math.atan2(other.x-r.x,-(other.y-r.y));pace=.65;if(distance<r.r+other.r+30){m.mode='restmate';m.remaining=3+3*social;m.decision=m.remaining;F.relate(life,a,other.a,'rest');pace=0;}}
   else if(['home','shelter','crossing'].includes(m.mode)&&m.point){
    desired=Math.atan2(goal.x-r.x,-(goal.y-r.y));pace=.6+.25*curious;
    const arrived=Math.hypot(goal.x-r.x,goal.y-r.y)<Math.max(16,r.r*.6);
    if(arrived){const found=currentObject&&Math.hypot(currentObject.x*width-r.x,currentObject.y*height-r.y)<Math.max(30,r.r)+(goal?.shift||0);
     if(m.objectId&&!found){m.mode='search';m.remaining=2.5;m.decision=2.5;}
     else {m.mode='settle';m.dwell=0;m.learned=false;m.remaining=3+4*caution+2*persist;m.decision=m.remaining;}pace=0;m.bubble=.6;
    }
   }else if(['food','eat','water','drink','warm','bask'].includes(m.mode)&&m.point){
    desired=Math.atan2(goal.x-r.x,-(goal.y-r.y));
    if(Math.hypot(goal.x-r.x,goal.y-r.y)<Math.max(23,r.r+12,(a.radius||24)*.75)){
     if(['food','water','warm'].includes(m.mode)){const duration=m.mode==='warm'?1.5+4*value(p,'heatPreference'):3;m.mode={food:'eat',water:'drink',warm:'bask'}[m.mode];m.remaining=duration;m.decision=duration;}
     pace=0;m.bubble=.4;m.energy=Math.min(1,m.energy+dt*(.035+.025*value(p,'recovery')));
     if(m.mode==='eat'&&m.foodObjectId)W.consume(objects,m.foodObjectId,dt);
     const need={eat:'hunger',drink:'thirst',bask:'chill'}[m.mode];m[need]=Math.max(0,m[need]-dt*.23);
    }else {m.mode={eat:'food',drink:'water',bask:'warm'}[m.mode]||m.mode;pace=.8;}
   }else if((m.mode==='follow'||m.mode==='greet'||m.mode==='contest')&&other){
    const gap=r.r+other.r+22;
    desired=Math.atan2(other.x-r.x,-(other.y-r.y));
    if(distance<gap+12){if(m.mode==='contest'){pace=.2;m.bubble=.4;}else {if(m.mode!=='greet'){m.remaining=.8+.5*social;m.decision=m.remaining;F.relate(life,a,other.a,'greet');}m.mode='greet';pace=.1;m.bubble=.4;}}
    else {if(m.mode!=='contest')m.mode='follow';pace=.85;}
   }else if((m.mode==='avoid'||m.mode==='yield')&&other){desired=Math.atan2(r.x-other.x,-(r.y-other.y));pace=m.mode==='yield'?1.12:.9;}
   else if(m.mode==='shove'&&other){desired=Math.atan2(other.x-r.x,-(other.y-r.y));pace=m.tableau?.kind==='tactics'?.75:.25;}
   else if(m.mode==='investigate'&&m.point){desired=Math.atan2(m.point.x-r.x,-(m.point.y-r.y));pace=.65+.3*curious;if(Math.hypot(m.point.x-r.x,m.point.y-r.y)<20)m.remaining=0;}
   else {m.heading+=(rng()-.5)*dt*(1+5*wander);desired=m.heading;}
   // Cautious beetles take a wider, slower turn near walls; center preference affects exploration.
   const margin=35+45*caution,wallX=r.x<margin?1:r.x>width-margin?-1:0,wallY=r.y<margin?1:r.y>height-margin?-1:0;
   if((wallX||wallY)&&!['food','eat','water','drink','warm','bask','home','shelter','crossing'].includes(m.mode)){desired=Math.atan2(wallX,-wallY);pace*=1-.45*caution;}
   else if(m.mode==='explore'&&value(p,'centerDrive')>.55){const center=Math.atan2(width/2-r.x,-(height/2-r.y));desired+=turn(desired,center)*(.12*value(p,'centerDrive'));}
   // Smooth stones are solid: steer around their outline, with room for the beetle's body.
   for(const o of objects.filter(o=>solid(o,p))){const q=H.shape(o,width,height),dx=r.x-q.x,dy=r.y-q.y,clear=Math.max(q.rx,q.ry)+r.r+10;
    if(Math.hypot(dx,dy)<clear+28&&!(goal&&Math.hypot(goal.x-r.x,goal.y-r.y)<55)){const away=Math.atan2(dx,-dy),diff=turn(desired,away);desired+=diff*(1-(Math.max(0,Math.hypot(dx,dy)-clear)/28));pace*=.55+.4*body.footing;}
   }
   if(m.drama?.kind==='leaf')pace*=.35;
   if(m.tableau?.kind==='tactics'&&m.tableau.role===0&&other)desired+=.8;
   a.angle+=clamp(turn(a.angle,desired),-(.8+3*value(p,'turnRate'))*dt,(.8+3*value(p,'turnRate'))*dt);
   const speed=Math.max(.1,a.speed||p.speed||1)*38*pace*(m.worldPace||1)*(.55+.45*m.energy);
   r.dx+=Math.sin(a.angle)*speed*dt;r.dy-=Math.cos(a.angle)*speed*dt;
   m.energy=clamp(m.energy-dt*.012*pace*(1-.7*value(p,'endurance')),0,1);
  }
 }
 // Pair contacts: a shove costs energy, then both beetles get a cooldown and separate.
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),contact=a.r+b.r+7;
  if(d>contact+4)continue;
  const nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0;
  if(!a.a.held&&!b.a.held&&a.m.cooldown<=0&&b.m.cooldown<=0&&!a.m.drama&&!b.m.drama&&!(a.m.mode==='eat'&&b.m.mode==='eat'&&value(a.p,'sociality')+value(b.p,'sociality')>.8)&&!['rest','settle','restmate','groom'].includes(a.m.mode)&&!['rest','settle','restmate','groom'].includes(b.m.mode)){
   const urge=r=>value(r.p,'pushDrive')*(1-.65*value(r.p,'caution'))*(r.m.intent?1-.95*value(r.p,'focus'):1);
   const first=urge(a)>urge(b)?a:b,second=first===a?b:a;
   if(urge(first)>.48&&first.m.energy>.3&&rng()<urge(first)*.8){
    first.m.mode='shove';first.m.target=second.a.id;first.m.remaining=.65;first.m.decision=.65;first.m.bubble=.8;first.m.energy=Math.max(0,first.m.energy-.045);
    second.m.mode='yield';second.m.target=first.a.id;second.m.remaining=.85;second.m.decision=.85;second.m.bubble=.8;
    if(objects.some(o=>Math.hypot(o.x*width-first.x,o.y*height-first.y)<100))F.relate(life,first.a,second.a,'contest');
    const encounter=W.confront(world,first.a,second.a,rng);if(encounter){first.a.angle=Math.atan2(second.x-first.x,-(second.y-first.y));second.a.angle=first.a.angle+Math.PI;first.m.heading=first.a.angle;second.m.heading=second.a.angle;}if(encounter==='lift'&&first.m.tableau.success)second.m.energy=Math.max(0,second.m.energy-.015);
    const force=(5+7*value(first.p,'strength'))/((.8+.7*value(second.p,'mass'))*Math.sqrt(anatomy(second.p).size));
    const sign=first===a?1:-1;second.dx+=nx*force*sign;second.dy+=ny*force*sign;if(encounter==='tactics'){const sidestep=5+7*value(first.p,'tactics');first.dx+=-ny*sidestep*sign;first.dy+=nx*sidestep*sign;first.a.angle+=.35*sign;first.m.heading=first.a.angle;}
   }else if(value(a.p,'sociality')+value(b.p,'sociality')>1&&![a,b].some(r=>r.m.intent&&rng()<value(r.p,'focus'))){
    F.relate(life,a.a,b.a,'greet');
    for(const [r,o] of [[a,b],[b,a]]){r.m.mode='greet';r.m.target=o.a.id;r.m.remaining=.8;r.m.decision=.8;r.m.bubble=.8;}
   }
   a.m.cooldown=3+4*(1-value(a.p,'persistence'))+rng()*2;b.m.cooldown=3+4*(1-value(b.p,'persistence'))+rng()*2;
  }
  // Non-destructive personal space, including when another beetle is held still.
  const overlap=Math.max(0,contact-d),share=a.a.held||b.a.held?1:.5,shift=Math.min(overlap,70*dt)*share;
  if(!a.a.held){a.dx-=nx*shift;a.dy-=ny*shift;}if(!b.a.held){b.dx+=nx*shift;b.dy+=ny*shift;}
 }
 for(const row of rows){const {a}=row;if(a.held)continue;
  // Resolve overlap against the actual rotated ellipse, never against shelter canopies.
  for(const o of objects.filter(o=>solid(o,row.p))){const q=H.shape(o,width,height),c=Math.cos(q.angle),s=Math.sin(q.angle),px=row.x+row.dx-q.x,py=row.y+row.dy-q.y,x=c*px+s*py,y=-s*px+c*py,rx=q.rx+row.r,ry=q.ry+row.r,d=Math.hypot(x/rx,y/ry);
   if(d<1){const ux=d>1e-6?x/d:rx,uy=d>1e-6?y/d:0;row.dx+=c*(ux-x)-s*(uy-y);row.dy+=s*(ux-x)+c*(uy-y);}
  }
  const {dx,dy}=row;const mx=Math.min(.48,(a.radius||24)/width),my=Math.min(.48,(a.radius||28)/height);a.x=clamp(a.x+dx/width,mx,1-mx);a.y=clamp(a.y+dy/height,my,1-my);}
 W.record(agents,objects,{world,life,H,width,height});
}
function activity(agent){if(!agent.held&&agent.behavior?.tableau){const t=agent.behavior.tableau;return t.kind==='lift'?(t.role===0?'Trying a horn lift':t.success?'Briefly lifted':'Bracing against a lift'):t.kind==='tactics'?'Changing the pushing angle':'Facing off in a gentle push';}if(!agent.held&&agent.behavior?.mode==='explore'&&agent.behavior.onSoil)return 'Walking through loose soil';if(!agent.held&&agent.behavior?.mode==='explore'&&agent.behavior.onDroplet)return 'Wading across a droplet';if(agent.behavior?.drama&&!agent.held)return {bridge:'Pausing at narrow bridge',leaf:'Balancing on a bending leaf',crumb:'Grooming a crumb from its horn'}[agent.behavior.drama.kind];if(!agent.held&&agent.behavior?.mode==='settle'&&!agent.behavior.objectId)return 'Resting at favorite spot';return labels[agent.held?'held':agent.behavior?.mode]||'Exploring';}
return {step,activity,labels,stations,anatomy,comfort,pose,drives,hold,release};
});

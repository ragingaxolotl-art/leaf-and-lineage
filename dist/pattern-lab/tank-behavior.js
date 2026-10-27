/* Harmless, temporary tank behavior. Never reads or writes genomes or breeding RNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PatternTankBehavior=api;})(globalThis,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const labels={explore:'Exploring',investigate:'Investigating',follow:'Following',greet:'Greeting',avoid:'Making space',shove:'Gentle shove',yield:'Backing away',rest:'Resting',food:'Finding food',eat:'Eating',water:'Finding water',drink:'Drinking',warm:'Seeking warmth',bask:'Warming up',held:'Being held'};
const stations=[{kind:'food',x:.16,y:.72},{kind:'water',x:.82,y:.75},{kind:'warm',x:.78,y:.22}];
const value=(p,k)=>clamp(Number.isFinite(p[k])?p[k]:.5,0,1);
const needKey={food:'hunger',water:'thirst',warm:'chill'},taskMode={food:'food',eat:'food',water:'water',drink:'water',warm:'warm',bask:'warm'};
function drives(p){return {food:.001+.006*value(p,'appetite'),water:.001+.008*value(p,'thirstDrive'),warm:.0005+.005*value(p,'heatPreference')};}
function threshold(p,kind){return kind==='warm'?.88-.36*value(p,'heatPreference'):.82-.24*value(p,kind==='food'?'appetite':'thirstDrive');}
function hold(a){if(!a.behavior)return;const m=a.behavior;if(taskMode[m.mode]){m.intent=taskMode[m.mode];m.intentAge=0;}m.mode='held';m.wasHeld=true;}
function release(a){if(!a.behavior)return;const m=a.behavior,focus=value(a.traits||{},'focus');m.wasHeld=false;m.mode='explore';m.target=null;m.decision=0;m.remaining=0;m.heading=a.angle;m.distraction=(1-focus)*2.5;}
function memory(rng){return {mode:'explore',target:null,decision:0,remaining:0,cooldown:0,socialWait:0,energy:.7+rng()*.3,heading:rng()*Math.PI*2,bubble:0,hunger:.2+rng()*.5,thirst:.2+rng()*.5,chill:.2+rng()*.5};}
function step(agents,{width,height,dt,rng=Math.random,stations:places=stations}={}){
 if(!(width>0&&height>0&&dt>0))return;
 dt=Math.min(dt,.05);
 // All decisions see the same position snapshot; each contact pair is resolved once.
 const rows=agents.map(a=>{a.behavior=a.behavior||memory(rng);const radius=clamp((a.radius||30)*.55,11,45);return {a,m:a.behavior,p:a.traits||{},x:a.x*width,y:a.y*height,r:radius,dx:0,dy:0};});
 const byId=new Map(rows.map(r=>[r.a.id,r]));
 for(const r of rows){const {a,m,p}=r;
  m.cooldown=Math.max(0,m.cooldown-dt);m.socialWait=Math.max(0,(m.socialWait||0)-dt);m.bubble=Math.max(0,m.bubble-dt);m.decision-=dt;m.remaining-=dt;
  if(a.held){hold(a);continue;}
  if(m.wasHeld)release(a);
  const rates=drives(p);for(const kind of Object.keys(needKey)){const k=needKey[kind];m[k]=clamp((m[k]||0)+dt*rates[kind],0,1);}
  const focus=value(p,'focus');m.distraction=Math.max(0,(m.distraction||0)-dt);m.intentAge=(m.intentAge||0)+dt;
  if(m.intent&&(m[needKey[m.intent]]<.24||m.intentAge>10+180*focus||!places.some(q=>q.kind===m.intent))){m.intent=null;m.intentAge=0;}
  const social=value(p,'sociality'),caution=value(p,'caution'),curious=value(p,'curiosity'),persist=value(p,'persistence'),wander=value(p,'wander');
  const neighbors=rows.filter(o=>o!==r).map(o=>({o,d:Math.hypot(o.x-r.x,o.y-r.y)})).sort((x,y)=>x.d-y.d),near=neighbors[0],sense=100+90*value(p,'tracking')+100*social;
  const target=byId.get(m.target);
  if(m.mode==='greet'&&m.remaining<=0){m.mode='explore';m.heading=target?Math.atan2(r.x-target.x,-(r.y-target.y)):a.angle+Math.PI;m.target=null;m.socialWait=3;m.remaining=1.3;m.decision=1.3;}
  if(m.decision<=0||m.remaining<=0||m.target&&!target||m.mode==='held'){
   m.decision=.6+1.4*(1-value(p,'reaction'))+rng()*.4;m.remaining=1.2+persist*3+value(p,'focus');m.target=null;
   if(m.energy<.18||m.mode==='rest'&&m.energy<.72){m.mode='rest';m.remaining=2;m.decision=1;}
   else if(m.distraction<=0&&places.length&&(m.intent||places.some(q=>m[needKey[q.kind]]>=threshold(p,q.kind)))){
    const wanted=m.intent||places.slice().sort((a,b)=>m[needKey[b.kind]]/threshold(p,b.kind)-m[needKey[a.kind]]/threshold(p,a.kind))[0].kind,place=places.find(q=>q.kind===wanted);
    if(place&&(!m.intent||rng()<.2+.8*focus)){
     if(!m.intent)m.intentAge=0;m.intent=wanted;m.mode=wanted;m.point={x:place.x*width,y:place.y*height};m.remaining=1.2+8*focus+2*persist;m.decision=m.remaining;
    }else {m.mode='explore';m.heading=a.angle+(rng()-.5)*2;m.remaining=1+2*(1-focus);m.decision=m.remaining;}
   }
   else if(near&&near.d<sense&&caution>.6&&social<.6){m.mode='avoid';m.target=near.o.a.id;}
   else if(near&&near.d<sense&&m.socialWait<=0&&rng()<social*(1-.45*wander)){m.mode='follow';m.target=near.o.a.id;}
   else if(rng()<curious*.7){m.mode='investigate';m.point={x:width*(.12+rng()*.76),y:height*(.14+rng()*.72)};}
   else {m.mode='explore';m.heading=a.angle+(rng()-.5)*(1+4*wander);}
  }
  let desired=a.angle,pace=1;
  const other=byId.get(m.target),distance=other?Math.hypot(other.x-r.x,other.y-r.y):Infinity;
  if(m.mode==='rest'){pace=0;m.energy=Math.min(1,m.energy+dt*(.09+.13*value(p,'recovery')));}
  else {
   if(['food','eat','water','drink','warm','bask'].includes(m.mode)&&m.point){
    desired=Math.atan2(m.point.x-r.x,-(m.point.y-r.y));
    if(Math.hypot(m.point.x-r.x,m.point.y-r.y)<Math.max(23,r.r+12,(a.radius||24)*.75)){
     if(['food','water','warm'].includes(m.mode)){const duration=m.mode==='warm'?1.5+4*value(p,'heatPreference'):3;m.mode={food:'eat',water:'drink',warm:'bask'}[m.mode];m.remaining=duration;m.decision=duration;}
     pace=0;m.bubble=.4;m.energy=Math.min(1,m.energy+dt*(.035+.025*value(p,'recovery')));
     const need={eat:'hunger',drink:'thirst',bask:'chill'}[m.mode];m[need]=Math.max(0,m[need]-dt*.23);
    }else {m.mode={eat:'food',drink:'water',bask:'warm'}[m.mode]||m.mode;pace=.8;}
   }else if((m.mode==='follow'||m.mode==='greet')&&other){
    const gap=r.r+other.r+22;
    desired=Math.atan2(other.x-r.x,-(other.y-r.y));
    if(distance<gap+12){if(m.mode!=='greet'){m.remaining=.8+.5*social;m.decision=m.remaining;}m.mode='greet';pace=.1;m.bubble=.4;}
    else {m.mode='follow';pace=.85;}
   }else if((m.mode==='avoid'||m.mode==='yield')&&other){desired=Math.atan2(r.x-other.x,-(r.y-other.y));pace=m.mode==='yield'?1.12:.9;}
   else if(m.mode==='shove'&&other){desired=Math.atan2(other.x-r.x,-(other.y-r.y));pace=.25;}
   else if(m.mode==='investigate'&&m.point){desired=Math.atan2(m.point.x-r.x,-(m.point.y-r.y));pace=.65+.3*curious;if(Math.hypot(m.point.x-r.x,m.point.y-r.y)<20)m.remaining=0;}
   else {m.heading+=(rng()-.5)*dt*(1+5*wander);desired=m.heading;}
   // Cautious beetles take a wider, slower turn near walls; center preference affects exploration.
   const margin=35+45*caution,wallX=r.x<margin?1:r.x>width-margin?-1:0,wallY=r.y<margin?1:r.y>height-margin?-1:0;
   if((wallX||wallY)&&!['food','eat','water','drink','warm','bask'].includes(m.mode)){desired=Math.atan2(wallX,-wallY);pace*=1-.45*caution;}
   else if(m.mode==='explore'&&value(p,'centerDrive')>.55){const center=Math.atan2(width/2-r.x,-(height/2-r.y));desired+=turn(desired,center)*(.12*value(p,'centerDrive'));}
   a.angle+=clamp(turn(a.angle,desired),-(.8+3*value(p,'turnRate'))*dt,(.8+3*value(p,'turnRate'))*dt);
   const speed=Math.max(.1,a.speed||p.speed||1)*38*pace*(.55+.45*m.energy);
   r.dx+=Math.sin(a.angle)*speed*dt;r.dy-=Math.cos(a.angle)*speed*dt;
   m.energy=clamp(m.energy-dt*.012*pace*(1-.7*value(p,'endurance')),0,1);
  }
 }
 // Pair contacts: a shove costs energy, then both beetles get a cooldown and separate.
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),contact=a.r+b.r+7;
  if(d>contact+4)continue;
  const nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0;
  if(!a.a.held&&!b.a.held&&a.m.cooldown<=0&&b.m.cooldown<=0&&a.m.mode!=='rest'&&b.m.mode!=='rest'){
   const urge=r=>value(r.p,'pushDrive')*(1-.65*value(r.p,'caution'))*(r.m.intent?1-.95*value(r.p,'focus'):1);
   const first=urge(a)>urge(b)?a:b,second=first===a?b:a;
   if(urge(first)>.48&&first.m.energy>.3&&rng()<urge(first)*.8){
    first.m.mode='shove';first.m.target=second.a.id;first.m.remaining=.65;first.m.decision=.65;first.m.bubble=.8;first.m.energy=Math.max(0,first.m.energy-.045);
    second.m.mode='yield';second.m.target=first.a.id;second.m.remaining=.85;second.m.decision=.85;second.m.bubble=.8;
    const force=(5+7*value(first.p,'strength'))/(.8+.7*value(second.p,'mass'));
    const sign=first===a?1:-1;second.dx+=nx*force*sign;second.dy+=ny*force*sign;
   }else if(value(a.p,'sociality')+value(b.p,'sociality')>1&&![a,b].some(r=>r.m.intent&&rng()<value(r.p,'focus'))){
    for(const [r,o] of [[a,b],[b,a]]){r.m.mode='greet';r.m.target=o.a.id;r.m.remaining=.8;r.m.decision=.8;r.m.bubble=.8;}
   }
   a.m.cooldown=3+4*(1-value(a.p,'persistence'))+rng()*2;b.m.cooldown=3+4*(1-value(b.p,'persistence'))+rng()*2;
  }
  // Non-destructive personal space, including when another beetle is held still.
  const overlap=Math.max(0,contact-d),share=a.a.held||b.a.held?1:.5,shift=Math.min(overlap,70*dt)*share;
  if(!a.a.held){a.dx-=nx*shift;a.dy-=ny*shift;}if(!b.a.held){b.dx+=nx*shift;b.dy+=ny*shift;}
 }
 for(const {a,dx,dy} of rows){if(a.held)continue;const mx=Math.min(.48,(a.radius||24)/width),my=Math.min(.48,(a.radius||28)/height);a.x=clamp(a.x+dx/width,mx,1-mx);a.y=clamp(a.y+dy/height,my,1-my);}
}
function activity(agent){return labels[agent.held?'held':agent.behavior?.mode]||'Exploring';}
return {step,activity,labels,stations,drives,hold,release};
});

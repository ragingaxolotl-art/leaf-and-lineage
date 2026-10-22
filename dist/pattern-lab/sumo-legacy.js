(function(root){
'use strict';
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
const clamp=G.clamp,TAU=Math.PI*2,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const unit=a=>({x:Math.cos(a),y:Math.sin(a)}),dot=(a,b)=>a.x*b.x+a.y*b.y;
function traits(b){const p=G.phenotype(b);return {...p,massValue:1.3+1.7*p.mass+.2*p.bodyWidth,maxSpeed:36+48*p.speed,traction:.4+.7*p.grip+.08*p.claw+.06*(p.legSpread-.7),turnSpeed:1.2+3.8*p.turnRate,pushPower:45+125*p.strength};}
function support(t,heading,pushToward){
 // pushToward points from this defender toward its attacker.
 const facing=dot(unit(heading),pushToward);
 const front=Math.max(0,facing),rear=Math.max(0,-facing),side=1-Math.abs(facing);
 return (.65+front*(.35+.35*t.brace)+side*(-.25+.3*t.lateralBalance)+rear*(-.25+.25*t.recovery))*t.traction;
}
function fighter(b,index,r){const t=traits(b);return {beetle:G.clone(b),t,index,x:index?108:-108,y:(r()-.5)*28,vx:0,vy:0,heading:index?Math.PI:0,targetHeading:index?Math.PI:0,energy:1,think:0,engaged:false,mode:'Finding the other beetle',flankSide:r()<.5?-1:1,wanderingTime:0,contactTime:0,edgeSaves:0,sideHits:0,rearHits:0,frontHits:0};}
function create(a,b,seed=Math.floor(Math.random()*4294967296),options={}){
 const rng=G.seeded(seed),match={version:'SUMO2',seed,rng,time:0,tick:0,radius:205,bodyRadius:24,maxSeconds:options.maxSeconds||60,done:false,winner:null,reason:null,events:[],lastContact:-10,contact:false,fighters:[fighter(a,0,rng),fighter(b,1,rng)]};
 const rotation=rng()*TAU,c=Math.cos(rotation),s=Math.sin(rotation);
 for(const f of match.fighters){const x=f.x;f.x=x*c-f.y*s;f.y=x*s+f.y*c;f.heading+=rotation;f.targetHeading=f.heading;}
 return match;
}
function decide(m,f,other){
 const t=f.t,r=m.rng,dx=other.x-f.x,dy=other.y-f.y,d=Math.hypot(dx,dy),rad=Math.hypot(f.x,f.y);
 const chance=clamp(.25+.55*t.pushDrive+.2*t.focus+.15*t.persistence-.45*t.wander,.03,.99);
 f.engaged=f.engaged&&r()<(.3+.45*t.focus+.2*t.persistence)?true:r()<chance;
 let tx,ty;
 if(rad>m.radius*.7&&r()<t.edgeSense*(.55+.4*t.caution)){
  tx=-f.x*.6;ty=-f.y*.6;f.mode='Guarding the edge';f.edgeSaves++;
 }else if(f.engaged){
  tx=other.x;ty=other.y;
  const enemyFront=dot(unit(other.heading),{x:-dx/Math.max(1,d),y:-dy/Math.max(1,d)});
  if(t.tactics>.45&&enemyFront>.35&&d>62&&d<190&&r()<t.tactics){
   const flank=other.heading+f.flankSide*Math.PI/2,offset=40+30*t.tactics;tx+=Math.cos(flank)*offset;ty+=Math.sin(flank)*offset;f.mode='Looking for a side push';
  }else f.mode=d<60?(t.brace>.65?'Bracing & pushing':'Pushing'):'Tracking the opponent';
 }else{
  const a=f.heading+(r()-.5)*(1.1+3*t.wander);
  tx=f.x+Math.cos(a)*80-f.x*t.centerDrive*.35;ty=f.y+Math.sin(a)*80-f.y*t.centerDrive*.35;f.mode='Wandering';
  if(r()<t.curiosity*.25){tx=other.x;ty=other.y;f.mode='Curious approach';}
 }
 const trackingNoise=(r()-.5)*(1-t.tracking)*(f.engaged?1.5:.5);
 f.targetHeading=Math.atan2(ty-f.y,tx-f.x)+trackingNoise;
 f.think=.12+(1-t.reaction)*.62;
}
function step(m){
 if(m.done)return m;
 const dt=1/60;m.tick++;m.time=m.tick/60;
 const [a,b]=m.fighters;
 for(const f of m.fighters){const other=f===a?b:a,t=f.t;f.think-=dt;if(f.think<=0)decide(m,f,other);
  const angle=wrap(f.targetHeading-f.heading),turn=t.turnSpeed/(1+.28*t.mass+.15*(f.t.maxSpeed/100));f.heading+=clamp(angle,-turn*dt,turn*dt);
  const face=unit(f.heading),speed=t.maxSpeed*(.48+.52*f.energy)*(f.engaged?1:.3+.4*t.wander);
  const desired={x:face.x*speed,y:face.y*speed},acc=(1.6+3*t.acceleration)/Math.sqrt(t.massValue);
  f.vx+=(desired.x-f.vx)*Math.min(1,acc*dt);f.vy+=(desired.y-f.vy)*Math.min(1,acc*dt);
  if(f.mode==='Wandering')f.wanderingTime+=dt;
  const fatigue=(f.engaged?.007:.002)/(1+t.endurance*1.8),regen=f.engaged?0:.012+.02*t.recovery;
  f.energy=clamp(f.energy+(regen-fatigue)*dt,.12,1);
 }
 let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),nx=dx/Math.max(.001,dist),ny=dy/Math.max(.001,dist);
 const contactRadius=43+4*(a.t.bodyWidth+b.t.bodyWidth)/2;
 m.contact=dist<contactRadius;
 if(m.contact){
  const normal={x:nx,y:ny},opposite={x:-nx,y:-ny},sa=support(a.t,a.heading,normal),sb=support(b.t,b.heading,opposite);
  const alignedA=Math.max(0,dot(unit(a.heading),normal)),alignedB=Math.max(0,dot(unit(b.heading),opposite));
  const effortA=a.engaged?1:.08,effortB=b.engaged?1:.08;
  const powerA=a.t.pushPower*a.t.traction*alignedA*effortA*(.35+.65*a.energy),powerB=b.t.pushPower*b.t.traction*alignedB*effortB*(.35+.65*b.energy);
  const net=powerA-powerB;
  a.vx-=nx*net*dt/(a.t.massValue*(.4+sa));a.vy-=ny*net*dt/(a.t.massValue*(.4+sa));
  b.vx+=nx*net*dt/(b.t.massValue*(.4+sb));b.vy+=ny*net*dt/(b.t.massValue*(.4+sb));
  // Resolve overlap and inward momentum symmetrically, weighted by mass and bracing.
  const ma=a.t.massValue*(.5+sa),mb=b.t.massValue*(.5+sb),overlap=Math.max(0,contactRadius-dist),total=ma+mb;
  a.x-=nx*overlap*mb/total;a.y-=ny*overlap*mb/total;b.x+=nx*overlap*ma/total;b.y+=ny*overlap*ma/total;
  const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
  if(closing>0){const impulse=closing/(1/ma+1/mb);a.vx-=nx*impulse/ma;a.vy-=ny*impulse/ma;b.vx+=nx*impulse/mb;b.vy+=ny*impulse/mb;}
  a.contactTime+=dt;b.contactTime+=dt;
  for(const f of [a,b]){f.energy=clamp(f.energy-dt*(.025+.04*f.t.strength)/(1+f.t.endurance*1.8),.12,1);}
  if(m.time-m.lastContact>1.3){m.lastContact=m.time;const attacker=powerA>=powerB?a:b,defender=attacker===a?b:a,dir=attacker===a?opposite:normal,face=dot(unit(defender.heading),dir);const side=face>.55?'front':face<-.55?'rear':'side';attacker[side+'Hits']++;m.events.push({time:Number(m.time.toFixed(1)),attacker:attacker.index,defender:defender.index,side});}
 }
 for(const f of m.fighters){f.x+=f.vx*dt;f.y+=f.vy*dt;}
 const out=m.fighters.map(f=>Math.hypot(f.x,f.y)>m.radius);
 if(out.some(Boolean)){m.done=true;m.winner=out[0]&&out[1]?null:out[0]?1:0;m.reason=out[0]&&out[1]?'Both centers crossed the line':'Ring-out';}
 else if(m.time>=m.maxSeconds){m.done=true;m.winner=null;m.reason='Time limit — draw';}
 return m;
}
function run(a,b,seed,options){const m=create(a,b,seed,options);while(!m.done)step(m);return m;}
function record(m){return {version:m.version,seed:m.seed,seconds:Number(m.time.toFixed(2)),winner:m.winner,reason:m.reason,events:m.events.slice(),fighters:m.fighters.map(f=>({id:f.beetle.id,name:f.beetle.name,genomeFingerprint:G.checksum(JSON.stringify(f.beetle.genome)+f.beetle.developmentSeed),wanderingSeconds:Number(f.wanderingTime.toFixed(1)),contactSeconds:Number(f.contactTime.toFixed(1)),sidePushes:f.sideHits,rearPushes:f.rearHits,frontPushes:f.frontHits}))};}
const api={traits,support,create,step,run,record};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternSumoLegacy=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
'use strict';
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
const legacy=typeof module!=='undefined'&&module.exports?require('./sumo-legacy.js'):root.PatternSumoLegacy;
const v3=typeof module!=='undefined'&&module.exports?require('./sumo-v3.js'):root.PatternSumoV3;
const v4=typeof module!=='undefined'&&module.exports?require('./sumo-v4.js'):root.PatternSumoV4;
const clamp=G.clamp,TAU=Math.PI*2,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const unit=a=>({x:Math.cos(a),y:Math.sin(a)}),dot=(a,b)=>a.x*b.x+a.y*b.y;
function traits(b){const p=G.phenotype(b),g=p.bodyGrowth,leg=p.legGrowth,ant=p.antennaGrowth,hornReach=p.horn*p.hornFactor,hornLoad=Math.min(3,hornReach*(1+.15*(p.visibleHorns-1))),burden=1+.025*Math.max(0,ant)+.035*hornLoad+.025*Math.max(0,p.headGrowth+p.jawGrowth);return {...p,
 massValue:(1.8+1.2*p.mass+.2*p.bodyWidth)*2**(.28*g),
 maxSpeed:(42+32*p.speed)*2**(-.10*g)*2**(.09*leg),
 traction:(.8+.2*p.grip+.03*p.claw+.03*(p.legSpread-.7))*2**(.025*g-.025*Math.abs(leg)),
 turnSpeed:(2+2.5*p.turnRate)*2**(-.18*g-.045*Math.abs(leg))/burden,
 pushPower:(82.5+45*p.strength)*2**(.055*g),
 tracking:clamp(p.tracking+.035*ant),reaction:clamp(p.reaction-.015*Math.max(0,ant)),
 frontBonus:.025*hornLoad+.015*Math.max(0,p.jawGrowth),
 fatigueLoad:1+.07*Math.abs(g)+.025*Math.abs(leg)+.025*hornLoad,
 bodyRadius:(21.5+2*p.bodyWidth)*2**(.40*g)};}

function support(t,heading,pushToward){
 // pushToward points from this defender toward its attacker.
 const facing=dot(unit(heading),pushToward);
 const front=Math.max(0,facing),rear=Math.max(0,-facing),side=1-Math.abs(facing);
 return (.65+front*(.35+.65*t.brace)+side*(-.25+.3*t.lateralBalance)+rear*(-.25+.25*t.recovery))*t.traction*(.9+.2*t.mass);
}
function fighter(b,index,r){const t=traits(b);return {beetle:G.clone(b),t,index,x:index?82:-82,y:(r()-.5)*28,vx:0,vy:0,heading:index?Math.PI:0,targetHeading:index?Math.PI:0,energy:1,think:0,engaged:false,mode:'Finding the other beetle',flankSide:r()<.5?-1:1,wanderingTime:0,contactTime:0,edgeSaves:0,sideHits:0,rearHits:0,frontHits:0};}
function create(a,b,seed=Math.floor(Math.random()*4294967296),options={}){
 if(options.version==='SUMO2')return legacy.create(a,b,seed,options);if(options.version==='SUMO3')return v3.create(a,b,seed,options);if(options.version==='SUMO4')return v4.create(a,b,seed,options);
 const rng=G.seeded(seed),match={version:'SUMO5',seed,rng,time:0,tick:0,radius:160,bodyRadius:24,maxSeconds:options.maxSeconds||60,done:false,winner:null,reason:null,events:[],lastContact:-10,contact:false,fighters:[fighter(a,0,rng),fighter(b,1,rng)]};
 const rotation=rng()*TAU,c=Math.cos(rotation),s=Math.sin(rotation);
 for(const f of match.fighters){const x=f.x;f.x=x*c-f.y*s;f.y=x*s+f.y*c;f.heading+=rotation;f.targetHeading=f.heading;}
 return match;
}
function decide(m,f,other,otherVx,otherVy){
 const t=f.t,r=m.rng,dx=other.x-f.x,dy=other.y-f.y,d=Math.hypot(dx,dy),rad=Math.hypot(f.x,f.y);
 const chance=clamp(.25+.55*t.pushDrive+.2*t.focus+.15*t.persistence-.45*t.wander,.03,.99);
 f.engaged=f.engaged&&r()<(.3+.45*t.focus+.2*t.persistence)?true:r()<chance;
 let tx,ty;
 if(rad>m.radius*.88&&r()<t.edgeSense*(.55+.4*t.caution)){
  tx=-f.x*.6;ty=-f.y*.6;f.mode='Guarding the edge';f.edgeSaves++;
 }else if(f.engaged){
  tx=other.x+otherVx*t.tactics*.18;ty=other.y+otherVy*t.tactics*.18;
  const enemyRadius=Math.hypot(other.x,other.y);
  // Ring tactics seeks the INNER side only when currently outside the opponent.
  // Circling from an already useful pushing position would be a wasted maneuver.
  if(t.tactics>.25&&rad>enemyRadius+12&&d>35&&d<190&&r()<t.tactics*.8){
   const tangent={x:-dy/Math.max(1,d),y:dx/Math.max(1,d)},towardCenter=(-f.x)*tangent.x+(-f.y)*tangent.y,sign=towardCenter>=0?1:-1;
   const offset=Math.min(d*.9,30+35*t.tactics);tx=other.x+tangent.x*sign*offset;ty=other.y+tangent.y*sign*offset;f.mode='Looking for a side push';
  }else f.mode=d<60?(t.brace>.65?'Bracing & pushing':'Pushing'):'Tracking the opponent';
 }else{
  const a=f.heading+(r()-.5)*(1.1+3*t.wander);
  tx=f.x+Math.cos(a)*80-f.x*t.centerDrive*.35;ty=f.y+Math.sin(a)*80-f.y*t.centerDrive*.35;f.mode='Wandering';
  if(r()<t.curiosity*.25){tx=other.x+otherVx*t.tactics*.18;ty=other.y+otherVy*t.tactics*.18;f.mode='Curious approach';}
 }
 const trackingNoise=(r()-.5)*(1-t.tracking)*(f.engaged?1.5:.5);
 f.targetHeading=Math.atan2(ty-f.y,tx-f.x)+trackingNoise;
 f.think=.12+(1-t.reaction)*.62;
}
function step(m){
 if(m.version==='SUMO2')return legacy.step(m);if(m.version==='SUMO3')return v3.step(m);if(m.version==='SUMO4')return v4.step(m);
 if(m.done)return m;
 const dt=1/60;m.tick++;m.time=m.tick/60;
 const [a,b]=m.fighters;
 // Both decisions observe the same start-of-step velocities.
 const avx=a.vx,avy=a.vy,bvx=b.vx,bvy=b.vy;
 for(const f of m.fighters){const other=f===a?b:a,t=f.t;f.think-=dt;if(f.think<=0)decide(m,f,other,f===a?bvx:avx,f===a?bvy:avy);
  const angle=wrap(f.targetHeading-f.heading),turn=t.turnSpeed/((1+.15*t.mass+.08*(f.t.maxSpeed/100))*(m.contact&&f.engaged?1+.2*t.brace:1));f.heading+=clamp(angle,-turn*dt,turn*dt);
  const distance=Math.hypot(other.x-f.x,other.y-f.y),approach=f.engaged?(f.mode==='Looking for a side push'?.7:clamp((distance-f.t.bodyRadius-other.t.bodyRadius+2)/35,.35,1)):.3+.4*t.wander;
  const face=unit(f.heading),speed=t.maxSpeed*(.48+.52*f.energy)*approach;
  const desired={x:face.x*speed,y:face.y*speed};
  // Once touching, motor speed supplies sideways movement; muscle force drives the push.
  if(m.contact&&distance>0){const nx=(other.x-f.x)/distance,ny=(other.y-f.y)/distance,toward=Math.max(0,desired.x*nx+desired.y*ny);desired.x-=toward*nx;desired.y-=toward*ny;}
  const acc=(1.6+3*t.acceleration)/Math.sqrt(t.massValue);
  f.vx+=(desired.x-f.vx)*Math.min(1,acc*dt);f.vy+=(desired.y-f.vy)*Math.min(1,acc*dt);
  if(f.mode==='Wandering')f.wanderingTime+=dt;
  const fatigue=(f.engaged?.007:.002)*t.fatigueLoad/(1+t.endurance*.45),regen=f.engaged?0:.012+.012*t.recovery;
  f.energy=clamp(f.energy+(regen-fatigue)*dt,.12,1);
 }
 let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),nx=dx/Math.max(.001,dist),ny=dy/Math.max(.001,dist);
 const contactRadius=a.t.bodyRadius+b.t.bodyRadius;
 m.contact=dist<contactRadius+(m.contact?1.5:0);
 if(m.contact){
  const normal={x:nx,y:ny},opposite={x:-nx,y:-ny},sa=support(a.t,a.heading,normal),sb=support(b.t,b.heading,opposite);
  const alignedA=Math.max(0,dot(unit(a.heading),normal)),alignedB=Math.max(0,dot(unit(b.heading),opposite));
  const effortA=a.engaged?1:.08,effortB=b.engaged?1:.08;
  const powerA=a.t.pushPower*a.t.traction*(.9+.2*a.t.mass)*alignedA*(1+a.t.frontBonus*alignedA**2)*effortA*(.15+.85*a.energy),powerB=b.t.pushPower*b.t.traction*(.9+.2*b.t.mass)*alignedB*(1+b.t.frontBonus*alignedB**2)*effortB*(.15+.85*b.energy);
  // The stronger effort moves the touching pair in ONE direction. Equal opposite
  // efforts cancel. Motor velocity cannot continually overpower the contact force.
  const ma=a.t.massValue*(.5+sa),mb=b.t.massValue*(.5+sb),total=ma+mb;
  const net=powerA/(1+.55*sb)-powerB/(1+.55*sa);
  const va=a.vx*nx+a.vy*ny,vb=b.vx*nx+b.vy*ny;
  const shared=(va*ma+vb*mb)/total+net*dt*20/total;
  a.vx+=(shared-va)*nx;a.vy+=(shared-va)*ny;
  b.vx+=(shared-vb)*nx;b.vy+=(shared-vb)*ny;
  const overlap=Math.max(0,contactRadius-dist);
  a.x-=nx*overlap*mb/total;a.y-=ny*overlap*mb/total;b.x+=nx*overlap*ma/total;b.y+=ny*overlap*ma/total;
  // An off-center shove can turn a defender. Sideways balance and mass resist it;
  // a straight head-on push has no turning moment.
  for(const [f,incoming,power] of [[a,opposite,powerB],[b,normal,powerA]]){
   const facing=unit(f.heading),cross=facing.x*incoming.y-facing.y*incoming.x,side=1-Math.abs(dot(facing,incoming));
   f.heading+=cross*side*(power/100)*dt*2*(1-f.t.lateralBalance*.8)/f.t.massValue;
  }
  a.contactTime+=dt;b.contactTime+=dt;
  for(const f of [a,b]){f.energy=clamp(f.energy-dt*(.03+.022*f.t.strength)*f.t.fatigueLoad/(1+f.t.endurance*.45),.12,1);}
  if(m.time-m.lastContact>1.3){m.lastContact=m.time;const attacker=powerA>=powerB?a:b,defender=attacker===a?b:a,dir=attacker===a?opposite:normal,face=dot(unit(defender.heading),dir);const side=face>.55?'front':face<-.55?'rear':'side';attacker[side+'Hits']++;m.events.push({time:Number(m.time.toFixed(1)),attacker:attacker.index,defender:defender.index,side});}
 }
 for(const f of m.fighters){f.x+=f.vx*dt;f.y+=f.vy*dt;}
 const out=m.fighters.map(f=>Math.hypot(f.x,f.y)>m.radius);
 if(out.some(Boolean)&&!out.every(Boolean)){m.done=true;m.winner=out[0]?1:0;m.reason='Ring-out';}
 else if(out.every(Boolean)||m.time>=m.maxSeconds){m.done=true;const distances=m.fighters.map(f=>Math.hypot(f.x,f.y));m.centerDistances=distances;if(Math.abs(distances[0]-distances[1])<.01){m.winner=null;m.reason='Center tie';}else{m.winner=distances[0]<distances[1]?0:1;m.reason='Closest to center';}}
 return m;
}
function run(a,b,seed,options){const m=create(a,b,seed,options);while(!m.done)step(m);return m;}
function record(m){if(m.version==='SUMO2')return legacy.record(m);if(m.version==='SUMO3')return v3.record(m);if(m.version==='SUMO4')return v4.record(m);return {version:m.version,seed:m.seed,seconds:Number(m.time.toFixed(2)),winner:m.winner,reason:m.reason,...(m.centerDistances?{centerDistances:m.centerDistances.map(d=>Number(d.toFixed(3)))}:{}),events:m.events.slice(),fighters:m.fighters.map(f=>({id:f.beetle.id,name:f.beetle.name,genomeFingerprint:G.fingerprint(f.beetle),wanderingSeconds:Number(f.wanderingTime.toFixed(1)),contactSeconds:Number(f.contactTime.toFixed(1)),sidePushes:f.sideHits,rearPushes:f.rearHits,frontPushes:f.frontHits}))};}
const api={traits,support,create,step,run,record};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternSumo=api;
})(typeof globalThis!=='undefined'?globalThis:this);

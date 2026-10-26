(function(root){
'use strict';
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
const legacy=typeof module!=='undefined'&&module.exports?require('./sumo-legacy.js'):root.PatternSumoLegacy;
const v3=typeof module!=='undefined'&&module.exports?require('./sumo-v3.js'):root.PatternSumoV3;
const v4=typeof module!=='undefined'&&module.exports?require('./sumo-v4.js'):root.PatternSumoV4;
const v5=typeof module!=='undefined'&&module.exports?require('./sumo-v5.js'):root.PatternSumoV5;
const v6=typeof module!=='undefined'&&module.exports?require('./sumo-v6.js'):root.PatternSumoV6;
const v7=typeof module!=='undefined'&&module.exports?require('./sumo-v7.js'):root.PatternSumoV7;
const clamp=G.clamp,TAU=Math.PI*2,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const unit=a=>({x:Math.cos(a),y:Math.sin(a)}),dot=(a,b)=>a.x*b.x+a.y*b.y;
function traits(b){const p=G.phenotype(b),g=p.bodyGrowth,leg=p.legGrowth,ant=p.antennaGrowth,hornReach=p.visibleHorns?p.horn*p.hornFactor:0,hornLoad=Math.min(3,hornReach*(1+.15*(p.visibleHorns-1))),burden=1+.025*Math.max(0,ant)+.035*hornLoad+.025*Math.max(0,p.headGrowth+p.jawGrowth);return {...p,
 massValue:(1.8+1.2*p.mass+.2*p.bodyWidth)*2**(.28*g),
 maxSpeed:1.4*(42+32*p.speed)*2**(-.10*g)*2**(.09*leg),
 traction:(.8+.2*p.grip+.03*p.claw+.03*(p.legSpread-.7))*2**(.025*g-.025*Math.abs(leg)),
 turnSpeed:1.15*(2+2.5*p.turnRate)*2**(-.18*g-.045*Math.abs(leg))/burden,
 pushPower:(82.5+45*p.strength)*2**(.055*g),
 tracking:clamp(p.tracking+.035*ant),reaction:clamp(p.reaction-.015*Math.max(0,ant)),
 frontBonus:.025*hornLoad+.015*Math.min(3,p.jaw*p.jawFactor)*Math.max(0,p.jawGrowth),
 fatigueLoad:1+.07*Math.abs(g)+.025*Math.abs(leg)+.025*hornLoad,
 bodyRadius:(21.5+2*p.bodyWidth)*2**(.40*g)};}

function support(t,heading,pushToward){
 // pushToward points from this defender toward its attacker.
 const facing=dot(unit(heading),pushToward);
 const front=Math.max(0,facing),rear=Math.max(0,-facing),side=1-Math.abs(facing);
 return (.65+front*(.35+.65*t.brace)+side*(-.25+.3*t.lateralBalance)+rear*(-.25+.25*t.recovery))*t.traction*(.9+.2*t.mass);
}
function fighter(b,index,r){const t=traits(b);return {beetle:G.clone(b),t,index,x:index?82:-82,y:(r()-.5)*28,vx:0,vy:0,heading:index?Math.PI:0,targetHeading:index?Math.PI:0,energy:1,think:0,engaged:false,mode:'Finding the other beetle',flankSide:r()<.5?-1:1,wanderingTime:0,contactTime:0,edgeSaves:0,sideHits:0,rearHits:0,frontHits:0,action:null,cooldowns:{lift:2,jump:2,puff:3},charges:2,air:0,airTotal:0,lifted:0,dizzy:0,stumble:0,lastMove:null,flipped:0,flipDuration:0,flipGrace:0};}
function create(a,b,seed=Math.floor(Math.random()*4294967296),options={}){
 if(options.version==='SUMO2')return legacy.create(a,b,seed,options);if(options.version==='SUMO3')return v3.create(a,b,seed,options);if(options.version==='SUMO4')return v4.create(a,b,seed,options);
 if(options.version==='SUMO5')return v5.create(a,b,seed,options);
 if(options.version==='SUMO6')return v6.create(a,b,seed,options);
 if(options.version==='SUMO7')return v7.create(a,b,seed,options);
 const rng=G.seeded(seed),match={version:'SUMO8',seed,rng,time:0,tick:0,radius:160,bodyRadius:24,maxSeconds:options.maxSeconds||60,done:false,winner:null,reason:null,events:[],lastContact:-10,contact:false,abilities:[],flips:[],fighters:[fighter(a,0,rng),fighter(b,1,rng)]};
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
// Every action uses fixed simulation ticks and the shared seeded random stream.
// Readiness is deliberately absent: these are temporary grappling effects, never damage.
function windup(m,f,move){if(!['lift','jump','puff'].includes(move)||f.action||f.air>0||f.flipped>0||f.cooldowns[move]>0||move==='lift'&&(!f.t.visibleHorns||f.t.horn*f.t.hornFactor<=.008)||move==='jump'&&!f.t.canJump||move==='puff'&&(!f.t.canPuff||f.charges<=0))return false;const t=f.t,cost=({lift:.09,jump:.12,puff:.14}[move])*(1.25-.6*t[move+'Efficiency']);if(f.energy<cost+.18)return false;
 f.energy-=cost;const duration=({lift:.55,jump:.4,puff:.65}[move])*(1.15-.3*t[move+'Control']);
 f.action={move,remaining:duration,heading:f.heading};f.cooldowns[move]=({lift:8,jump:10,puff:16}[move])*(1.3-.6*t[move+'Recovery']);return true;}
function consider(m,f,o,dt){if(f.action||f.air>0||f.flipped>0||f.stumble>0||f.dizzy>.5)return;const t=f.t,d=Math.hypot(o.x-f.x,o.y-f.y),contact=t.bodyRadius+o.t.bodyRadius,near=d<contact+12;
 const face=dot(unit(f.heading),{x:(o.x-f.x)/Math.max(1,d),y:(o.y-f.y)/Math.max(1,d)}),threat=f.lifted>0||f.dizzy>0||!!o.action&&o.action.move!=='jump'||Math.hypot(f.x,f.y)>m.radius*.78||near&&Math.hypot(f.x,f.y)>Math.hypot(o.x,o.y)+14;
 // Poisson hazards are time-based; a high instinct changes attempts, never guarantees success.
 const choices=[];
 if(t.canJump&&f.cooldowns.jump<=0&&(near||threat))choices.push(['jump',(.06+.5*t.jumpInstinct)*(threat?1:.08)]);
 if(t.canPuff&&f.charges>0&&f.cooldowns.puff<=0&&d<contact+18+42*t.puffReach&&face>.35)choices.push(['puff',.08+.4*t.puffInstinct]);
 if(f.engaged&&t.visibleHorns&&t.horn*t.hornFactor>.008&&f.cooldowns.lift<=0&&near&&face>.7)choices.push(['lift',(.05+.35*t.liftInstinct)*Math.sqrt(clamp((t.horn*t.hornFactor-.008)/.55))]);
 for(const [move,hazard] of choices)if(m.rng()<1-Math.exp(-hazard*dt)){windup(m,f,move);break;}}
// Lift height controls the flip roll continuously. A lift is not a guaranteed flip.
function liftOdds(t,other){
 // Visible horn anatomy sets the ceiling: hidden lift talent cannot replace a horn.
 const reach=t.visibleHorns?t.horn*t.hornFactor*(.65+.7*t.liftReach):0;
 const leverage=clamp((reach-.008)/.55),low=Math.min(1,other.bodyRadius/t.bodyRadius),resist=.35+.35*other.grip+.2*other.brace+.1*(1-low);
 const height=clamp((.18+.82*t.liftPower)*leverage/(.8+.4*other.mass));
 return {reach,leverage,height,hitChance:clamp((.35+.6*t.liftControl)*leverage**.85*(1.25-resist),0,.85),flipChance:clamp(.65*height**1.5*(1-.45*other.lateralBalance-.15*other.grip)*(.8+.2*t.liftControl),0,.65)};
}
function flip(m,attacker,target,height){if(target.flipped>0||target.flipGrace>0||target.air>0)return false;
 const t=target.t,legs=clamp((t.legLength-.55)/.95),duration=clamp((3.8-2.3*t.recovery)*(.95+.12*t.mass+.08*Math.max(0,t.bodyGrowth))/(.85+.3*legs)+.3*height,1.1,5);
 target.flipped=target.flipDuration=duration;target.flipGrace=duration+1.5;target.action=null;target.lifted=0;target.vx*=.4;target.vy*=.4;
 m.flips.push({time:Number(m.time.toFixed(3)),actor:attacker.index,defender:target.index,duration:Number(duration.toFixed(3))});return true;}
function act(m,f,o,action=f.action){const move=action.move,t=f.t,r=m.rng,dx=o.x-f.x,dy=o.y-f.y,d=Math.hypot(dx,dy),n={x:dx/Math.max(1,d),y:dy/Math.max(1,d)},face=dot(unit(f.heading),n),contact=t.bodyRadius+o.t.bodyRadius;let hit=false;
 if(move==='lift'&&(!t.visibleHorns||t.horn*t.hornFactor<=.008)||move==='jump'&&!t.canJump||move==='puff'&&(!t.canPuff||f.charges<=0)){const event={time:Number(m.time.toFixed(3)),actor:f.index,move,hit:false};m.abilities.push(event);f.lastMove=event;f.action=null;return;}
 if(move==='jump'){
  // Poor landing control can carry a beetle over the boundary; a good edge sense aims inward.
  const edge=Math.hypot(f.x,f.y)>m.radius*.7,controlled=r()<(.2+.75*t.jumpControl)*(edge?(.35+.65*t.edgeSense):1);
  const angle=controlled?Math.atan2(-f.y,-f.x):action.heading+(r()<.5?-1:1)*Math.PI/2;
  const aim=angle+(r()-.5)*(1-t.jumpControl)*2.2,distance=18+30*t.jumpReach+8*t.jumpPower;
  f.air=f.airTotal=.42+.18*t.jumpPower;f.hopVx=Math.cos(aim)*distance/f.air;f.hopVy=Math.sin(aim)*distance/f.air;f.landingNoise=(r()-.5)*(1-t.jumpControl);f.lifted=0;hit=true;
 }else if(move==='lift'){
  const odds=liftOdds(t,o.t);
  hit=o.air<=0&&o.flipped<=0&&d<contact+8+Math.min(20,odds.reach*15)&&face>.72&&r()<odds.hitChance;
  if(hit){o.lifted=Math.max(o.lifted,1.2*odds.height/(1+.35*o.t.mass));if(o.flipGrace<=0&&r()<odds.flipChance)flip(m,f,o,odds.height);}
 }else{
  f.charges--;const range=contact+18+42*t.puffReach,cone=.92-.35*t.puffControl;
  hit=o.air<=0&&d<range&&face>cone&&r()<.3+.6*t.puffControl;
  if(hit)o.dizzy=Math.max(o.dizzy,(.8+1.8*t.puffPower)/(1+.35*o.t.recovery));
 }
 const event={time:Number(m.time.toFixed(3)),actor:f.index,move,hit};m.abilities.push(event);f.lastMove=event;f.action=null;
}
function updateActions(m,dt){const ready=[];
 for(const f of m.fighters){for(const key of ['lifted','dizzy','stumble','flipped','flipGrace'])f[key]=Math.max(0,f[key]-dt);for(const key of Object.keys(f.cooldowns))f.cooldowns[key]=Math.max(0,f.cooldowns[key]-dt);
  if(f.air>0){f.air=Math.max(0,f.air-dt);if(!f.air){f.stumble=Math.abs(f.landingNoise)*1.3;f.heading+=f.landingNoise;}}
  if(f.action){f.action.remaining-=dt;if(f.action.remaining<=0)ready.push({f,action:f.action});}}
 // Resolve simultaneous launches before puffs/lifts, so corner order cannot decide a dodge.
 ready.sort((a,b)=>(a.action.move==='jump'?0:1)-(b.action.move==='jump'?0:1));for(const {f,action} of ready)act(m,f,m.fighters[1-f.index],action);
 for(const f of m.fighters)consider(m,f,m.fighters[1-f.index],dt);
}
function abilityMode(f){return f.flipped>0?'Flipped — righting itself':f.air>0?'Spring jump':f.action?'Winding up '+G.abilityNames[f.action.move].toLowerCase():f.lifted>0?'Lifted — regaining grip':f.dizzy>0?'Puff — reorienting':f.stumble>0?'Recovering landing':null;}
function step(m){
 if(m.version==='SUMO2')return legacy.step(m);if(m.version==='SUMO3')return v3.step(m);if(m.version==='SUMO4')return v4.step(m);
 if(m.version==='SUMO5')return v5.step(m);
 if(m.version==='SUMO6')return v6.step(m);
 if(m.version==='SUMO7')return v7.step(m);
 if(m.done)return m;
 const dt=1/60;m.tick++;m.time=m.tick/60;
 const [a,b]=m.fighters;updateActions(m,dt);
 // Both decisions observe the same start-of-step velocities.
 const avx=a.vx,avy=a.vy,bvx=b.vx,bvy=b.vy;
 for(const f of m.fighters){const other=f===a?b:a,t=f.t;f.think-=dt;if(f.think<=0)decide(m,f,other,f===a?bvx:avx,f===a?bvy:avy);
  const angle=wrap(f.targetHeading-f.heading),turn=t.turnSpeed/((1+.15*t.mass+.08*(f.t.maxSpeed/100))*(m.contact&&f.engaged?1+.2*t.brace:1));f.heading+=clamp(angle,-turn*dt,turn*dt)*(f.flipped>0?0:f.action?.35:f.dizzy>0?.45:1);if(f.dizzy>0)f.heading+=Math.sin(m.time*11+f.index*3)*dt*1.1;
  const distance=Math.hypot(other.x-f.x,other.y-f.y),approach=f.engaged?(f.mode==='Looking for a side push'?.7:clamp((distance-f.t.bodyRadius-other.t.bodyRadius+2)/35,.35,1)):.3+.4*t.wander;
  const face=unit(f.heading),speed=t.maxSpeed*(.48+.52*f.energy)*approach*(f.flipped>0?0:f.action?.55:f.stumble>0?.3:f.dizzy>0?.6:1);
  const desired={x:face.x*speed,y:face.y*speed};
  // Once touching, motor speed supplies sideways movement; muscle force drives the push.
  if(m.contact&&distance>0){const nx=(other.x-f.x)/distance,ny=(other.y-f.y)/distance,toward=Math.max(0,desired.x*nx+desired.y*ny);desired.x-=toward*nx;desired.y-=toward*ny;}
  const acc=1.2*(1.6+3*t.acceleration)/Math.sqrt(t.massValue);
  f.vx+=(desired.x-f.vx)*Math.min(1,acc*dt);f.vy+=(desired.y-f.vy)*Math.min(1,acc*dt);
  if(f.air>0){f.vx=f.hopVx;f.vy=f.hopVy;}
  if(f.mode==='Wandering')f.wanderingTime+=dt;
  const fatigue=(f.engaged?.007:.002)*t.fatigueLoad/(1+t.endurance*.45),regen=f.engaged?0:.012+.012*t.recovery;
  f.energy=clamp(f.energy+(regen-fatigue)*dt,.12,1);
 }
 let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),nx=dx/Math.max(.001,dist),ny=dy/Math.max(.001,dist);
 const contactRadius=a.t.bodyRadius+b.t.bodyRadius;
 m.contact=a.air<=0&&b.air<=0&&dist<contactRadius+(m.contact?1.5:0);
 if(m.contact){
  const normal={x:nx,y:ny},opposite={x:-nx,y:-ny},sa=support(a.t,a.heading,normal)*(a.flipped>0?.2:a.lifted>0?.45:a.dizzy>0?.8:1),sb=support(b.t,b.heading,opposite)*(b.flipped>0?.2:b.lifted>0?.45:b.dizzy>0?.8:1);
  const alignedA=Math.max(0,dot(unit(a.heading),normal)),alignedB=Math.max(0,dot(unit(b.heading),opposite));
  const effortA=(a.engaged?1:.08)*(a.flipped>0?0:a.action?.65:a.lifted>0?.45:a.dizzy>0?.4:1),effortB=(b.engaged?1:.08)*(b.flipped>0?0:b.action?.65:b.lifted>0?.45:b.dizzy>0?.4:1);
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
 for(const f of m.fighters){f.x+=f.vx*dt;f.y+=f.vy*dt;const mode=abilityMode(f);if(mode)f.mode=mode;}
 const out=m.fighters.map(f=>Math.hypot(f.x,f.y)>m.radius);
 if(out.some(Boolean)&&!out.every(Boolean)){m.done=true;m.winner=out[0]?1:0;m.reason='Ring-out';}
 else if(out.every(Boolean)||m.time>=m.maxSeconds){m.done=true;const distances=m.fighters.map(f=>Math.hypot(f.x,f.y));m.centerDistances=distances;if(Math.abs(distances[0]-distances[1])<.01){m.winner=null;m.reason='Center tie';}else{m.winner=distances[0]<distances[1]?0:1;m.reason='Closest to center';}}
 return m;
}
function run(a,b,seed,options){const m=create(a,b,seed,options);while(!m.done)step(m);return m;}
function record(m){if(m.version==='SUMO2')return legacy.record(m);if(m.version==='SUMO3')return v3.record(m);if(m.version==='SUMO4')return v4.record(m);if(m.version==='SUMO5')return v5.record(m);if(m.version==='SUMO6')return v6.record(m);if(m.version==='SUMO7')return v7.record(m);return {version:m.version,seed:m.seed,seconds:Number(m.time.toFixed(2)),winner:m.winner,reason:m.reason,...(m.centerDistances?{centerDistances:m.centerDistances.map(d=>Number(d.toFixed(3)))}:{}),events:m.events.slice(),abilities:m.abilities.map(e=>({...e})),flips:m.flips.map(e=>({...e})),fighters:m.fighters.map(f=>({id:f.beetle.id,name:f.beetle.name,genomeFingerprint:G.fingerprint(f.beetle),wanderingSeconds:Number(f.wanderingTime.toFixed(1)),contactSeconds:Number(f.contactTime.toFixed(1)),sidePushes:f.sideHits,rearPushes:f.rearHits,frontPushes:f.frontHits}))};}
const api={liftOdds,flip,windup,abilityMode,traits,support,create,step,run,record};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternSumoV8=api;
})(typeof globalThis!=='undefined'?globalThis:this);

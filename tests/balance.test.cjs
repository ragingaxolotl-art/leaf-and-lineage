'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js'),S=require('../dist/pattern-lab/sumo.js'),Legacy=require('../dist/pattern-lab/sumo-legacy.js');
function beetle(id,mods={}){const b=G.createState(42).beetles.B3;b.id=id;for(const l of G.loci)if(l.type==='number')G.setCopies(b,l.key,(l.min+l.max)/2);for(const[k,v]of Object.entries(mods))G.setCopies(b,k,v);return b;}
function duel(a,b,n=100){let wins=0,losses=0,draws=0;for(let seed=0;seed<n;seed++)for(const swap of [false,true]){const m=S.run(swap?b:a,swap?a:b,seed*401+8167);if(m.winner===null)draws++;else if((swap?1-m.winner:m.winner)===0)wins++;else losses++;}return {wins,losses,draws,score:(wins+.5*draws)/(2*n)};}
test('A sustained head-on push moves both touching bodies in the stronger effort direction',()=>{
 const m=S.create(beetle('A',{strength:.9}),beetle('B',{strength:.1}),37);m.contact=true;for(const [i,f]of m.fighters.entries()){f.x=i?23:-23;f.y=0;f.vx=f.vy=0;f.heading=f.targetHeading=i?Math.PI:0;f.engaged=true;f.think=100;}
 S.step(m);assert.ok(m.fighters[0].vx>0&&m.fighters[1].vx>0);assert.ok(Math.abs(m.fighters[0].vx-m.fighters[1].vx)<1e-9);
});
test('Strength matters when other traits are equal, yet does not guarantee every match',()=>{
 const out=duel(beetle('Strong',{strength:.9}),beetle('Weak',{strength:.1}),120);assert.ok(out.score>.56&&out.score<.9,JSON.stringify(out));assert.ok(out.wins>out.losses&&out.losses>0,JSON.stringify(out));
});
test('Speed alone cannot overpower a coordinated beetle; a stronger beetle can lose to a different build',()=>{
 const sprinter=beetle('Fast',{motor:.95,stride:.95,strength:.3,mass:.3,grip:.3,focus:.3});const coordinated=beetle('Steady',{motor:.4,stride:.4,tracking:.8,reaction:.8,focus:.8,tactics:.8,grip:.6,endurance:.7});
 assert.ok(G.phenotype(sprinter).speed>G.phenotype(coordinated).speed);const speed=duel(sprinter,coordinated,80);assert.ok(speed.losses>speed.wins,JSON.stringify(speed));
 const power=beetle('Power',{strength:.9,mass:.8,motor:.3,stride:.3,focus:.3,persistence:.3,tactics:.2,turnRate:.3});assert.ok(G.expressed(power,'strength')>G.expressed(coordinated,'strength'));const result=duel(power,coordinated,80);assert.ok(result.losses>0&&result.wins>0,JSON.stringify(result));
});
test('Greater speed actually closes the approach gap faster, independently of pushing strength',()=>{
 const slow=beetle('Slow',{motor:.1,stride:.1,pushDrive:1,focus:1,persistence:1,wander:0,tactics:0}),fast=beetle('Fast',{motor:.9,stride:.9,pushDrive:1,focus:1,persistence:1,wander:0,tactics:0}),other=beetle('Other');
 const a=S.create(slow,other,123),b=S.create(fast,other,123);for(let n=0;n<30;n++){S.step(a);S.step(b);}const distance=m=>Math.hypot(m.fighters[0].x-m.fighters[1].x,m.fighters[0].y-m.fighters[1].y);assert.ok(distance(b)<distance(a)-3);
});
test('Endurance preserves energy during the same sustained effort',()=>{
 const m=S.create(beetle('Durable',{endurance:.9}),beetle('Tires',{endurance:.1}),41);m.contact=true;for(const [i,f]of m.fighters.entries()){f.x=i?23:-23;f.y=0;f.vx=f.vy=0;f.heading=f.targetHeading=i?Math.PI:0;f.engaged=true;f.think=100;}
 for(let n=0;n<180&&!m.done;n++)S.step(m);assert.ok(m.fighters[0].energy>m.fighters[1].energy+.01);
});
test('Old SUMO2 notebooks replay with their original physics and both versions save correctly',()=>{
 const s=G.createState(),a=s.beetles.B3,b=s.beetles.B7;const old=S.run(a,b,753,{version:'SUMO2'}),expected=Legacy.run(a,b,753),current=S.run(a,b,753);assert.deepEqual(S.record(old),Legacy.record(expected));assert.equal(current.version,'SUMO4');s.matchHistory=[S.record(old),S.record(current)];G.validate(G.clone(s));
});
test('Mutation-free strength stays within 3.5 points of the parental mean, including extreme hidden values',()=>{
 const a=beetle('A'),b=beetle('B'),r=G.seeded(672);G.setCopies(a,'strength',0,1);G.setCopies(b,'strength',0,1);let above=0,below=0;
 for(let n=0;n<3000;n++){const child=G.baby(a,b,'child',{rate:0,rng:r}),value=G.expressed(child,'strength');assert.ok(Math.abs(value-.5)<=.035000001);if(value>.5)above++;if(value<.5)below++;assert.ok(!child.mutations.includes('strength'));}assert.ok(above>1200&&below>1200);
});
test('Strong or weak parent pairs can have slightly stronger and weaker offspring without sudden jumps',()=>{
 for(const level of [.15,.5,.85]){const a=beetle('A',{strength:level}),b=beetle('B',{strength:level}),r=G.seeded(714);let higher=false,lower=false;for(let n=0;n<300;n++){const value=G.expressed(G.baby(a,b,'child',{rate:0,rng:r}),'strength');assert.ok(Math.abs(value-level)<=.035000001);higher ||= value>level;lower ||= value<level;}assert.ok(higher&&lower);}
});
test('Large strength changes are rare and require a recorded strength mutation',()=>{
 const a=beetle('A'),b=beetle('B'),r=G.seeded(908);let large=0;for(let n=0;n<10000;n++){const child=G.baby(a,b,'child',{rate:.005,rng:r}),delta=Math.abs(G.expressed(child,'strength')-.5);if(delta>.035000001)assert.ok(child.mutations.includes('strength'));if(delta>.1){large++;assert.ok(child.mutations.includes('strength'));}}assert.ok(large>0&&large<30,JSON.stringify({large}));
});
test('Repeated selection can gradually breed strength up or down with mutation disabled',()=>{
 for(const direction of [-1,1]){let parents=[beetle('A'),beetle('B')],r=G.seeded(37),id=1;for(let round=0;round<12;round++){const center=parents.reduce((s,b)=>s+G.expressed(b,'strength'),0)/2;const brood=Array.from({length:16},()=>G.baby(parents[0],parents[1],'C'+id++,{rate:0,rng:r}));brood.forEach(b=>assert.ok(Math.abs(G.expressed(b,'strength')-center)<=.035000001));brood.sort((a,b)=>direction*(G.expressed(b,'strength')-G.expressed(a,'strength')));parents=brood.slice(0,2);}const mean=parents.reduce((s,b)=>s+G.expressed(b,'strength'),0)/2;assert.ok(direction*(mean-.5)>.08);}
});

test('Bracing has a real front-contact advantage while side balance protects a different angle',()=>{
 const m=S.create(beetle('Brace',{brace:.9}),beetle('Loose',{brace:.1}),41);m.contact=true;for(const [i,f]of m.fighters.entries()){f.x=i?23:-23;f.y=0;f.vx=f.vy=0;f.heading=f.targetHeading=i?Math.PI:0;f.engaged=true;f.think=100;}S.step(m);assert.ok(m.fighters[0].vx>0&&m.fighters[1].vx>0);
 const a=S.traits(beetle('Balanced',{lateralBalance:.9})),b=S.traits(beetle('Unsteady',{lateralBalance:.1}));assert.ok(S.support(a,0,{x:0,y:1})>S.support(b,0,{x:0,y:1}));assert.equal(S.support(a,0,{x:1,y:0}),S.support(b,0,{x:1,y:0}));
});

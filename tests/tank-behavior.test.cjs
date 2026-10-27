'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),T=require('../dist/pattern-lab/tank-behavior.js'),G=require('../dist/pattern-lab/genetics.js');
const agent=(id,x,y,traits={})=>({id,x,y,angle:Math.PI/2,speed:1,radius:25,traits:{sociality:0,caution:0,curiosity:0,wander:0,pushDrive:0,...traits}});
function simulate(list,seconds=15,seed=14){const rng=G.seeded(seed),counts={};let distance=0;for(let i=0;i<seconds*30;i++){T.step(list,{width:600,height:400,dt:1/30,rng,stations:[]});for(const a of list){const label=T.activity(a);counts[label]=(counts[label]||0)+1;}if(list.length>1)distance+=Math.hypot((list[0].x-list[1].x)*600,(list[0].y-list[1].y)*400);}return {counts,meanDistance:distance/(seconds*30)};}
test('Inherited social approach and caution produce measurably different behavior around the same neighbor',()=>{
 const run=traits=>simulate([agent('a',.4,.5,traits),{...agent('b',.6,.5),held:true}]);
 const social=run({sociality:1}),shy=run({caution:1});assert.ok(social.counts.Following>0);assert.ok(social.counts.Greeting>0);assert.ok(shy.counts['Making space']>0);assert.ok(social.meanDistance<shy.meanDistance*.7);assert.ok(social.counts.Exploring>0,'Greetings end and beetles move on');
});
test('Push drive initiates a brief shove, the neighbor yields, and cooldown prevents repeated shoves',()=>{
 const a=agent('a',.48,.5,{pushDrive:1,strength:1}),b=agent('b',.52,.5,{caution:1,mass:0});T.step([a,b],{width:600,height:400,dt:1/30,rng:()=>0});assert.equal(T.activity(a),'Gentle shove');assert.equal(T.activity(b),'Backing away');assert.ok(a.behavior.cooldown>=3);assert.ok(b.x>.52);
 const energy=a.behavior.energy;T.step([a,b],{width:600,height:400,dt:1/30,rng:()=>0});assert.ok(a.behavior.energy>energy-.01,'No second shove energy charge during cooldown');simulate([a,b],3);assert.notEqual(T.activity(a),'Gentle shove');
});
test('Social encounters can greet without shoving and shy non-pushers do not initiate shoves',()=>{
 const a=agent('a',.48,.5,{sociality:1}),b=agent('b',.52,.5,{sociality:1});T.step([a,b],{width:600,height:400,dt:1/30,rng:()=>0});assert.equal(T.activity(a),'Greeting');assert.equal(T.activity(b),'Greeting');
 const shy=simulate([agent('a',.48,.5,{caution:1}),agent('b',.52,.5,{caution:1})],10);assert.equal(shy.counts['Gentle shove'],undefined);
});
test('Holding is stationary through contact and releasing resumes movement; zero-time pause is inert',()=>{
 const a={...agent('a',.48,.5,{pushDrive:1}),held:true},b=agent('b',.49,.5,{pushDrive:1});const at={x:a.x,y:a.y,angle:a.angle};simulate([a,b],3);assert.deepEqual({x:a.x,y:a.y,angle:a.angle},at);assert.equal(T.activity(a),'Being held');a.held=false;simulate([a,b],2);assert.notEqual(a.x,at.x);const before=G.clone([a,b]);T.step([a,b],{width:600,height:400,dt:0,rng:()=>{throw Error('Paused must not roll');}});assert.deepEqual([a,b],before);
});
test('Temporary energy creates rest and recovery without changing inherited speed or traits',()=>{
 const a=agent('a',.5,.5,{endurance:0,recovery:1});T.step([a],{width:600,height:400,dt:1/30,rng:()=>.5});a.behavior.energy=.1;a.behavior.decision=0;const dna=G.clone(a.traits);const report=simulate([a],6);assert.ok(report.counts.Resting>0);assert.ok(report.counts.Exploring>0);assert.deepEqual(a.traits,dna);assert.equal(a.speed,1);
});
test('Curiosity investigates and missing neighbors are handled without invalid positions',()=>{
 const a=agent('a',.5,.5,{curiosity:1});T.step([a],{width:600,height:400,dt:1/30,rng:()=>.2});assert.equal(T.activity(a),'Investigating');a.behavior.target='removed';a.behavior.mode='follow';T.step([a],{width:600,height:400,dt:1/30,rng:()=>.2});assert.notEqual(a.behavior.target,'removed');
});
test('Food, water and heat visits meet temporary needs, finish, and leave genetics unchanged',()=>{
 for(const [kind,need,action] of [['food','hunger','Eating'],['water','thirst','Drinking'],['warm','chill','Warming up']]){
  const place=T.stations.find(p=>p.kind===kind),a=agent(kind,place.x,place.y,{caution:1}),original=G.clone(a.traits);
  T.step([a],{width:300,height:280,dt:1/30,rng:()=>.5});Object.assign(a.behavior,{hunger:0,thirst:0,chill:0,energy:.7,decision:0,remaining:0,[need]:.98});
  T.step([a],{width:300,height:280,dt:1/30,rng:()=>.5});assert.equal(T.activity(a),action);assert.ok(a.behavior[need]<.98);simulate([a],5);assert.notEqual(T.activity(a),action);assert.deepEqual(a.traits,original);
 }
});
test('Dense extreme-sized tanks stay bounded, finite, reproducible and never modify saved beetles',()=>{
 const state=G.createState(73),before=JSON.stringify(state),make=()=>Array.from({length:48},(_,i)=>({...agent('a'+i,.5,.5),radius:i%2?250:12,traits:G.phenotype(state.beetles['B'+(i%16+1)])}));
 const a=make(),b=make();simulate(a,8,44);simulate(b,8,44);assert.deepEqual(a,b);for(const v of a){assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.angle));assert.ok(v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1);}assert.equal(JSON.stringify(state),before);
});

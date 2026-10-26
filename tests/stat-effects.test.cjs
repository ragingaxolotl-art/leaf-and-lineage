'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../dist/pattern-lab/genetics.js'),S=require('../dist/pattern-lab/sumo.js'),V8=require('../dist/pattern-lab/sumo-v8.js');
function bug(id,mods={}){const b=G.createState(42).beetles.B3;b.id=id;for(const l of G.loci)if(l.type==='number')G.setCopies(b,l.key,G.growthKeys.has(l.key)?0:(l.min+l.max)/2);b.genome[9]=G.neutralAbilities();G.setCopies(b,'horn',0);for(const[k,v]of Object.entries(mods))G.setCopies(b,k,v);return b;}
function contact(mods={},other={}){const m=S.create(bug('A',mods),bug('B',other),913);m.contact=true;for(const[i,f]of m.fighters.entries()){f.x=i?23.52:-23.52;f.y=0;f.vx=f.vy=0;f.heading=f.targetHeading=i?Math.PI:0;f.engaged=true;f.think=100;f.cooldowns={lift:100,jump:100,puff:100};}return m;}
function trials(high,low,n=100){let wins=0;for(let seed=0;seed<n;seed++)for(const swap of [0,1]){const m=S.run(swap?low:high,swap?high:low,seed*401+8167);wins+=m.winner===swap;}return wins/(2*n);}
test('A 100-fold strength difference stays 100-fold in base force and dominates equal builds in both corners',()=>{
 const high=bug('Strong',{strength:1}),low=bug('Weak',{strength:.01});assert.ok(Math.abs(S.traits(high).pushPower/S.traits(low).pushPower-100)<1e-9);
 assert.ok(trials(high,low,250)>=.9);
 const m=contact({strength:1},{strength:.01});for(let i=0;i<60;i++)S.step(m);assert.ok(m.fighters[1].x>45);assert.ok(m.fighters[0].lastPush>m.fighters[1].lastPush*80);
});
test('Grip, bracing, side balance and rear recovery provide large resistance in their own directions',()=>{
 const base=bug('Base',{grip:0,brace:0,lateralBalance:0,recovery:0});const low=S.traits(base),forward={x:1,y:0},side={x:0,y:1},rear={x:-1,y:0};
 for(const[key,direction,minRatio]of [['grip',forward,5],['brace',forward,4],['lateralBalance',side,5],['recovery',rear,5]]){const high=G.clone(base);G.setCopies(high,key,1);assert.ok(S.support(S.traits(high),0,direction)>S.support(low,0,direction)*minRatio,key);}
 function shove(balance){const m=contact({}, {lateralBalance:balance});m.fighters[1].heading=m.fighters[1].targetHeading=Math.PI/2;S.step(m);return Math.abs(m.fighters[1].heading-Math.PI/2);}assert.ok(shove(1)<shove(0)*.1);
});
test('Speed and acceleration change actual approach distance; turning changes actual heading',()=>{
 function approach(mods){const m=S.create(bug('A',mods),bug('B'),32);for(const[i,f]of m.fighters.entries()){f.x=i?100:-100;f.y=0;f.heading=f.targetHeading=i?Math.PI:0;f.engaged=true;f.think=100;}for(let i=0;i<20;i++)S.step(m);return m.fighters[0].x;}
 assert.ok(approach({motor:1,stride:1})>approach({motor:.01,stride:.01})+10);
 assert.ok(approach({acceleration:1})>approach({acceleration:.01})+5);
 function turn(level){const m=S.create(bug('A',{turnRate:level}),bug('B'),32),f=m.fighters[0];f.heading=0;f.targetHeading=Math.PI/2;f.think=100;S.step(m);return f.heading;}
 assert.ok(turn(1)>turn(.01)*5);
});
test('Endurance changes sustained energy loss and recovery changes real resting and righting time',()=>{
 const m=contact({endurance:1},{endurance:.01});for(const f of m.fighters){f.t.pushPower=0;f.t.maxSpeed=0;}for(let i=0;i<600;i++)S.step(m);assert.ok(m.fighters[0].energy>m.fighters[1].energy+.4);
 function resting(level){const m=S.create(bug('A',{recovery:level}),bug('B'),1),f=m.fighters[0];for(const p of m.fighters){p.t.maxSpeed=0;p.engaged=false;p.think=100;}f.energy=.3;for(let i=0;i<300;i++)S.step(m);return f.energy;}
 assert.ok(resting(1)>resting(.01)+.2);
 const quick=contact({}, {recovery:1}),slow=contact({}, {recovery:.01});S.flip(quick,...quick.fighters,.5);S.flip(slow,...slow.fighters,.5);assert.ok(quick.fighters[1].flipped<slow.fighters[1].flipped*.6);
});
test('Attention, pushing, persistence, wandering, curiosity, social approach and tactics visibly change decisions',()=>{
 function observe(key,level){let engaged=0,wandering=0,curious=0,social=0,flank=0,error=0,interval=0;for(let seed=0;seed<180;seed++){const mods={pushDrive:.35,focus:.35,persistence:.35,wander:.6,curiosity:0,sociality:0,[key]:level};const m=S.create(bug('A',mods),bug('B'),seed),f=m.fighters[0],o=m.fighters[1];f.x=105;f.y=20;o.x=0;o.y=0;f.heading=Math.PI;f.engaged=true;S.step(m);engaged+=f.engaged;wandering+=f.mode==='Wandering';curious+=f.mode==='Curious approach';social+=f.mode==='Social approach';flank+=f.mode==='Looking for a side push';error+=Math.abs(Math.atan2(Math.sin(f.targetHeading-Math.atan2(o.y-20,o.x-105)),Math.cos(f.targetHeading-Math.atan2(o.y-20,o.x-105))));interval+=f.think;}return{engaged,wandering,curious,social,flank,error,interval};}
 for(const key of ['focus','pushDrive','persistence'])assert.ok(observe(key,1).engaged>observe(key,.01).engaged+25,key);
 assert.ok(observe('wander',1).wandering>observe('wander',.01).wandering+25);
 assert.ok(observe('curiosity',1).curious>observe('curiosity',.01).curious+25);
 assert.ok(observe('sociality',1).social>observe('sociality',.01).social+25);
 assert.ok(observe('tactics',1).flank>observe('tactics',.01).flank+20);
 assert.ok(observe('reaction',.01).interval>observe('reaction',1).interval*5);
 // Disable tactics so this measures aiming error rather than an intentional flank.
 function aiming(level){let error=0;for(let seed=0;seed<180;seed++){const m=S.create(bug('A',{tracking:level,tactics:0,pushDrive:1,focus:1,persistence:1,wander:0}),bug('B'),seed),f=m.fighters[0],o=m.fighters[1],angle=Math.atan2(o.y-f.y,o.x-f.x);S.step(m);error+=Math.abs(f.targetHeading-angle);}return error;}
 assert.ok(aiming(.01)>aiming(1)+50);
});
test('Edge awareness turns inward earlier, caution brakes an outward walk, and center preference changes roaming',()=>{
 function edge(level){let saves=0;for(let seed=0;seed<180;seed++){const m=S.create(bug('A',{edgeSense:level}),bug('B'),seed);m.fighters[0].x=130;m.fighters[0].y=0;S.step(m);saves+=m.fighters[0].edgeSaves;}return saves;}
 assert.ok(edge(1)>edge(.01)+150);
 function outward(caution){const m=S.create(bug('A',{caution}),bug('B'),1),f=m.fighters[0];f.x=135;f.y=0;f.heading=f.targetHeading=0;f.think=100;f.engaged=false;for(let i=0;i<15;i++)S.step(m);return f.x;}
 assert.ok(outward(.01)>outward(1)+1);
 function roam(centerDrive){let inward=0;for(let seed=0;seed<180;seed++){const m=S.create(bug('A',{centerDrive,pushDrive:0,focus:0,persistence:0,wander:1,curiosity:0,sociality:0}),bug('B'),seed),f=m.fighters[0];f.x=110;f.y=0;f.heading=0;S.step(m);inward+=-Math.cos(f.targetHeading);}return inward;}
 assert.ok(roam(1)>roam(.01)+100);
});
test('Mass changes inertia with a turning tradeoff; cosmetic pigment changes no battle step',()=>{
 const light=S.traits(bug('Light',{mass:.01})),heavy=S.traits(bug('Heavy',{mass:1}));assert.ok(heavy.massValue>light.massValue*3);
 function turn(mass){const m=S.create(bug('A',{mass}),bug('B'),1),f=m.fighters[0];f.heading=0;f.targetHeading=1;f.think=100;S.step(m);return f.heading;}
 assert.ok(turn(.01)>turn(1)*1.3);
 const a=bug('A'),painted=G.clone(a),b=bug('B');G.setCopies(painted,'body',{rgb:[255,0,255],expression:1});for(let seed=0;seed<10;seed++){const x=S.run(a,b,seed),y=S.run(painted,b,seed);assert.equal(x.winner,y.winner);assert.equal(x.tick,y.tick);assert.deepEqual(x.events,y.events);}
});
test('SUMO8 notebooks keep their exact physics while SUMO9 records round-trip and replay',()=>{
 const a=bug('A'),b=bug('B');for(let seed=0;seed<8;seed++){const old=S.run(a,b,seed,{version:'SUMO8'}),expected=V8.run(a,b,seed);assert.deepEqual(S.record(old),V8.record(expected));assert.deepEqual(old.fighters,expected.fighters);}
 const state=G.createState(),match=S.run(state.beetles.B3,state.beetles.B7,761);state.matchHistory=[{...S.record(match),participants:match.fighters.map(f=>G.packet(f.beetle))}];const restored=G.validate(G.clone(state));assert.equal(restored.matchHistory[0].version,'SUMO9');assert.deepEqual(S.record(S.run(...restored.matchHistory[0].participants.map(p=>p.beetle),761,{version:'SUMO9'})),S.record(match));
});
function special(move,mods={}){const on={value:'n',expression:.5},m=contact({horn:.3,jumpGate:on,puffGate:on,[move+'Control']:1,...mods},{grip:0,brace:0,lateralBalance:0});for(const f of m.fighters){f.t.maxSpeed=0;f.t.pushPower=0;}m.fighters[0].cooldowns[move]=0;return m;}
test('Every adaptation has a large energy-efficiency and cooldown-recovery difference',()=>{
 for(const move of ['lift','jump','puff']){const low=special(move,{[move+'Efficiency']:0,[move+'Recovery']:0}),high=special(move,{[move+'Efficiency']:1,[move+'Recovery']:1});for(const m of [low,high])assert.ok(S.windup(m,m.fighters[0],move));assert.ok((1-low.fighters[0].energy)>(1-high.fighters[0].energy)*4.9,move);for(const m of [low,high])m.fighters[0].energy=.12;for(let i=0;i<600;i++)for(const m of [low,high])S.step(m);assert.equal(high.fighters[0].cooldowns[move],0);assert.ok(low.fighters[0].cooldowns[move]>0,move);}
});
test('Jump power and reach change actual airborne travel; control improves the landing',()=>{
 function jump(mods){const m=special('jump',mods),f=m.fighters[0];assert.ok(S.windup(m,f,'jump'));while(f.action)S.step(m);const x=f.x,y=f.y;while(f.air>0)S.step(m);return{distance:Math.hypot(f.x-x,f.y-y),stumble:f.stumble};}
 assert.ok(jump({jumpPower:1}).distance>jump({jumpPower:0}).distance*1.4);
 assert.ok(jump({jumpReach:1}).distance>jump({jumpReach:0}).distance*1.8);
 assert.ok(jump({jumpControl:0}).stumble>jump({jumpControl:1}).stumble+.1);
});
test('Puff power changes disruption, reach changes which targets can be hit, and control changes hits',()=>{
 function puffs(mods,far=false){let hits=0,duration=0;for(let seed=0;seed<200;seed++){const m=special('puff',mods);m.rng=G.seeded(seed);if(far)m.fighters[1].x=65;assert.ok(S.windup(m,m.fighters[0],'puff'));while(m.fighters[0].action)S.step(m);hits+=m.abilities[0].hit;duration+=m.fighters[1].dizzy;}return{hits,duration};}
 assert.ok(puffs({puffPower:1}).duration>puffs({puffPower:0}).duration*3);
 assert.equal(puffs({puffReach:0},true).hits,0);assert.ok(puffs({puffReach:1},true).hits>150);
 assert.ok(puffs({puffControl:1}).hits>puffs({puffControl:0}).hits*2);
});
test('All three instincts change actual move launches when the matching anatomy is present',()=>{
 for(const move of ['lift','jump','puff']){function launches(level){let count=0;for(let seed=0;seed<150;seed++){const m=special(move,{[move+'Instinct']:level}),f=m.fighters[0],o=m.fighters[1];m.rng=G.seeded(seed);o.action={move:'lift',remaining:100,heading:o.heading};for(let i=0;i<180;i++)S.step(m);count+=m.abilities.filter(e=>e.actor===0&&e.move===move).length;}return count;}assert.ok(launches(1)>launches(0)*2+10,move);}
});

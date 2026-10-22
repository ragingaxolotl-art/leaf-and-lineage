'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../dist/pattern-lab/genetics.js'),S=require('../dist/pattern-lab/sumo.js');
const specimen=()=>G.createState(42).beetles.B3;
test('All added behavior and anatomy traits inherit actual copies and mutate within bounds',()=>{
 const s=G.createState(),r=G.seeded(391);for(let i=0;i<200;i++){const b=G.baby(s.beetles.B3,s.beetles.B7,'B99',{rate:0,rng:r});for(let ci=5;ci<7;ci++)for(let k=0;k<G.chromosomes[ci].loci.length;k++)for(let p=0;p<2;p++)assert.ok((p?s.beetles.B7:s.beetles.B3).genome[ci].copies.some(cp=>cp[k]===b.genome[ci].copies[p][k]));}
 const a=G.importPacket(s,G.packet(s.beetles.B3));s.settings.mutation=.1;G.move(s,a.id,'jar-1');G.move(s,'B7','jar-1');for(let i=0;i<3;i++)G.breedRound(s,{rng:r});G.validate(s);
});
test('Version-one saves upgrade once without replacing the original genes, names or kept beetles',()=>{
 const s=G.createState(),first=G.clone(s.beetles.B3.genome.slice(0,5));for(const b of Object.values(s.beetles))b.genome=b.genome.slice(0,5);s.version='PL1';delete s.settings.allowSumo;delete s.matchHistory;G.move(s,'B3','collection');s.beetles.B3.name='Original favorite';
 const upgraded=G.validate(G.clone(s)),again=G.validate(G.clone(s));assert.equal(upgraded.version,'PL2');assert.deepEqual(upgraded.beetles.B3.genome.slice(0,5),first);assert.deepEqual(upgraded.beetles.B3.genome,again.beetles.B3.genome);assert.equal(upgraded.beetles.B3.name,'Original favorite');assert.deepEqual(upgraded.collection,['B3']);const before=JSON.stringify(upgraded);G.validate(upgraded);assert.equal(JSON.stringify(upgraded),before);assert.equal(G.phenotype(upgraded.beetles.B3).horn,0);
});
test('Portable beetle packets preserve every allele and the fixed development seed',()=>{
 const s=G.createState(),b=s.beetles.B3;b.name='Blue <fan> & friends';const p=G.packet(b),copy=G.importPacket(s,JSON.parse(JSON.stringify(p)));assert.deepEqual(copy.genome,b.genome);assert.equal(copy.developmentSeed,b.developmentSeed);assert.equal(copy.name,b.name);assert.notEqual(copy.id,b.id);assert.equal(copy.provenance.sourceId,b.id);G.validate(s);const anon=G.packet(b,{anonymous:true});assert.equal(anon.beetle.name,'');assert.deepEqual(anon.beetle.parents,[]);const bad=G.clone(p);bad.beetle.genome[5].copies[0][0]=2;assert.throws(()=>G.validatePacket(bad));
});
test('A match replays identical physics from the same seed and leaves the real beetles untouched',()=>{
 const state=G.createState(),a=state.beetles.B3,b=state.beetles.B7,before=JSON.stringify([a,b]);const x=S.run(a,b,753),y=S.run(a,b,753);assert.deepEqual(S.record(x),S.record(y));assert.equal(JSON.stringify([a,b]),before);assert.ok(x.done&&x.time<=60.02);assert.ok([null,0,1].includes(x.winner));
});
test('Playback batches and viewport-independent fixed steps cannot change the result',()=>{
 const s=G.createState(),a=S.create(s.beetles.B3,s.beetles.B7,719),b=S.create(s.beetles.B3,s.beetles.B7,719);while(!a.done)S.step(a);while(!b.done)for(let i=0;i<10&&!b.done;i++)S.step(b);assert.deepEqual(S.record(a),S.record(b));
});
test('Bracing protects front pushes; lateral balance and recovery protect different directions',()=>{
 const b=specimen();for(const k of ['brace','lateralBalance','recovery'])G.setCopies(b,k,0);const low=S.traits(b);G.setCopies(b,'brace',1);const front=S.traits(b);assert.ok(S.support(front,0,{x:1,y:0})>S.support(low,0,{x:1,y:0}));assert.equal(S.support(front,0,{x:0,y:1}),S.support(low,0,{x:0,y:1}));G.setCopies(b,'lateralBalance',1);const side=S.traits(b);assert.ok(S.support(side,0,{x:0,y:1})>S.support(front,0,{x:0,y:1}));G.setCopies(b,'recovery',1);assert.ok(S.support(S.traits(b),0,{x:-1,y:0})>S.support(side,0,{x:-1,y:0}));
});
test('Wandering and pushing instincts produce measurably different choices',()=>{
 const wanderer=specimen(),pusher=G.clone(wanderer),other=G.createState().beetles.B7;for(const [key,value] of Object.entries({pushDrive:0,wander:1,focus:0,persistence:0,curiosity:0}))G.setCopies(wanderer,key,value);for(const [key,value] of Object.entries({pushDrive:1,wander:0,focus:1,persistence:1,curiosity:0}))G.setCopies(pusher,key,value);let w=0,p=0,secondsW=0,secondsP=0;for(let seed=1;seed<=30;seed++){const a=S.run(wanderer,other,seed),b=S.run(pusher,other,seed);w+=a.fighters[0].wanderingTime;p+=b.fighters[0].wanderingTime;secondsW+=a.time;secondsP+=b.time;}assert.ok(w/secondsW>p/secondsP+.4);
});
test('Identical opponents across four different genotypes have no systematic corner advantage',()=>{
 const state=G.createState();let red=0,blue=0;for(const id of ['B1','B3','B7','B11'])for(let seed=0;seed<1000;seed++){const m=S.run(state.beetles[id],state.beetles[id],seed);if(m.winner===0)red++;if(m.winner===1)blue++;}assert.ok(red>80&&blue>80,JSON.stringify({red,blue}));assert.ok(Math.abs(red-blue)<.1*(red+blue),JSON.stringify({red,blue}));
});
test('Colors and cosmetic patterns do not decide sumo winners',()=>{
 const s=G.createState(),a=s.beetles.B3,b=s.beetles.B7,c=G.clone(a);G.setCopies(c,'body',{rgb:[255,0,0],expression:1});G.setCopies(c,'plain',{value:'S',expression:1});for(let seed=0;seed<20;seed++){const x=S.run(a,b,seed),y=S.run(c,b,seed);assert.equal(x.winner,y.winner);assert.equal(x.tick,y.tick);assert.deepEqual(x.events,y.events);}
});
test('A ring-out is detected from movement and time-limit draws remain possible',()=>{
 const a=specimen(),b=G.clone(a),m=S.create(a,b,43);m.fighters[0].x=m.radius+2;S.step(m);assert.equal(m.winner,1);assert.equal(m.reason,'Ring-out');const timed=S.run(a,b,37,{maxSeconds:.2});assert.equal(timed.winner,null);assert.match(timed.reason,/Time limit/);
});
test('A shared sixty-second replay reaches an exact time-limit draw',()=>{
 const a=specimen(),m=S.create(a,G.clone(a),38);for(const f of m.fighters){f.t.maxSpeed=0;f.t.pushPower=0;f.x=f.index?80:-80;f.y=0;}while(!m.done&&m.tick<3600)S.step(m);assert.equal(m.tick,3600);assert.equal(m.time,60);assert.equal(m.done,true);assert.equal(m.reason,'Time limit — draw');
});
test('Whole-experiment files preserve completed match records and new classroom permissions',()=>{
 const s=G.createState(),m=S.run(s.beetles.B3,s.beetles.B7,37);s.matchHistory.push({...S.record(m),participants:m.fighters.map(f=>G.packet(f.beetle))});assert.deepEqual(G.validate(JSON.parse(JSON.stringify(s))).matchHistory,s.matchHistory);for(const sumo of [false,true]){const c={v:1,seed:1,mutation:0,backdrop:'moss',stats:false,environment:false,speed:1,sumo};assert.deepEqual(G.decodeConfig(G.encodeConfig(c)),c);}assert.throws(()=>G.validConfig({v:1,seed:1,mutation:0,backdrop:'moss',stats:false,environment:false,speed:1,sumo:'false'}));
});

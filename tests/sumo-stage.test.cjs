'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../dist/pattern-lab/sumo-stage.js'),G=require('../dist/pattern-lab/genetics.js'),S=require('../dist/pattern-lab/sumo.js');
const E=Date.parse('2026-10-22T15:00:00.000Z');
function device(offset=0){let time=0,wall=E+offset;const clock=P.createClock({wallNow:()=>wall,monoNow:()=>time});return {clock,advance(ms){time+=ms;wall+=ms;},setWall(v){wall=v;},sample(rtt=40){const sent=time;this.advance(rtt);return clock.sample(new Date(E+time-rtt/2).toISOString(),sent,time);}};}
test('Different computer clocks and connection delays converge on the same match tick',()=>{
 const a=device(86400000),b=device(-86400000);a.sample(40);b.sample(120);a.advance(80);assert.equal(a.clock.now(),b.clock.now());const start=new Date(E+3120).toISOString();for(let i=0;i<400;i++){a.advance(16);b.advance(16);assert.equal(P.targetTick(a.clock.now(),start),P.targetTick(b.clock.now(),start));}
});
test('Slow replies do not drag the shared clock away from a short-round-trip estimate',()=>{
 const a=device();a.sample(20);a.advance(100);const before=a.clock.now();assert.equal(a.clock.sample(new Date(E-5000).toISOString(),110,1200),false);assert.equal(a.clock.now(),before);a.setWall(E+100000000);a.advance(1000);assert.equal(a.clock.now(),before+1000);
});
test('Clock corrections never run a match backward and old estimates can be refreshed',()=>{
 const a=device();a.sample(20);a.advance(31000);const before=a.clock.now();assert.equal(a.clock.sample(new Date(before-200).toISOString(),31010,31020),true);assert.equal(a.clock.now(),before);a.advance(300);assert.ok(a.clock.now()>before);assert.equal(a.clock.sample('invalid',0,2),false);assert.equal(a.clock.sample(new Date(E).toISOString(),100,90),false);
});
test('Countdown and catch-up choose fixed, bounded ticks at exact shared times',()=>{
 const start=new Date(E+3000).toISOString();assert.equal(P.targetTick(E,start),0);assert.equal(P.targetTick(E+3000,start),0);assert.equal(P.targetTick(E+4000,start),60);assert.equal(P.targetTick(E+90000,start),3600);assert.equal(P.targetTick(NaN,start),0);
});
test('A delayed screen catches up to identical positions and the same final winner',()=>{
 const s=G.createState(),a=s.beetles.B3,b=s.beetles.B7,host=S.create(a,b,98714),guest=S.create(a,b,98714),start=new Date(E).toISOString();
 const advance=(m,t)=>{const tick=P.targetTick(E+t,start);while(!m.done&&m.tick<tick)S.step(m);};
 for(let ms=0;ms<=60000;ms+=250){advance(host,ms);if(ms%2250===0){advance(guest,ms);assert.deepEqual(S.record(host),S.record(guest));assert.deepEqual(host.fighters.map(f=>[f.x,f.y,f.heading]),guest.fighters.map(f=>[f.x,f.y,f.heading]));}}
 advance(guest,60000);assert.deepEqual(S.record(host),S.record(guest));
});
test('Victory timing belongs to the shared finish, and confetti is identical on both screens',()=>{
 const start=new Date(E).toISOString();assert.equal(P.victoryElapsed(E+7500,start,6),1500);assert.equal(P.victoryElapsed(E+5000,start,6),0);assert.deepEqual(P.confetti(98,0),P.confetti(98,0));assert.notDeepEqual(P.confetti(98,0),P.confetti(98,1));assert.equal(P.confetti(98,null).length,0);assert.equal(P.confetti(98,1).length,48);for(const p of P.confetti(98,0)){assert.ok(p.left>=0&&p.left<=100);assert.ok(p.duration+p.delay<6000);}
});
test('Presentation effects do not consume genetics randomness or change saved beetles and match outcomes',()=>{
 const s=G.createState(),before=JSON.stringify(s),m=S.run(s.beetles.B3,s.beetles.B7,612),record=S.record(m);P.confetti(m.seed,m.winner);P.victoryElapsed(E+10000,new Date(E).toISOString(),m.time);assert.deepEqual(S.record(m),record);assert.equal(JSON.stringify(s),before);
});

test('Late replies from a previous match or a departed room cannot replace the current timeline',()=>{assert.equal(P.acceptRoom('ABCDEFGH',2,{code:'ABCDEFGH',matchNumber:1}),false);assert.equal(P.acceptRoom('ABCDEFGH',2,{code:'ABCDEFGH',matchNumber:2}),true);assert.equal(P.acceptRoom('ABCDEFGH',2,{code:'ABCDEFGH',matchNumber:3}),true);assert.equal(P.acceptRoom('ABCDEFGH',2,{code:'ZZZZZZZZ',matchNumber:3}),false);assert.equal(P.acceptRoom('ABCDEFGH',2,null),false);});

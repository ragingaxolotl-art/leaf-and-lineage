'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js'),T=require('../dist/pattern-lab/tank-behavior.js'),N=require('../dist/pattern-lab/notebook.js'),L=require('../dist/pattern-lab/trait-lens.js'),R=require('../dist/pattern-lab/genetics-report.js');
const make=(focus=1)=>({id:'test',x:.5,y:.5,angle:0,speed:1.8,radius:25,traits:{appetite:0,thirstDrive:0,heatPreference:0,focus,persistence:1,recovery:1,endurance:1,sociality:0,curiosity:0,wander:0,caution:0,turnRate:1}});
test('The three habitat drives inherit gradually with room above and below the parents and occasional mutations',()=>{
 const s=G.createState(71),a=s.beetles.B1,b=s.beetles.B2,r=G.seeded(818);for(const key of G.tankKeys){G.setCopies(a,key,.2);G.setCopies(b,key,.8);}
 for(let n=0;n<600;n++){const c=G.baby(a,b,'C',{rate:0,rng:r});for(const key of G.tankKeys){const v=G.expressed(c,key);assert.ok(v>=.465&&v<=.535);}}
 for(const key of G.tankKeys){G.setCopies(a,key,.5);G.setCopies(b,key,.5);}let large=0,changed=0;
 for(let n=0;n<4000;n++){const c=G.baby(a,b,'C',{rate:.005,rng:r});for(const key of G.tankKeys){if(c.mutations.includes(key))changed++;if(Math.abs(G.expressed(c,key)-.5)>.1){assert.ok(c.mutations.includes(key));large++;}}}assert.ok(changed>40);assert.ok(large>0&&large<changed*.15);
});
test('Higher inherited appetite, thirst and warmth preference increase actual station visits under identical conditions',()=>{
 for(const [key,mode]of [['appetite','eat'],['thirstDrive','drink'],['heatPreference','bask']]){
  const visits=level=>{let total=0;for(let seed=0;seed<4;seed++){const a=make(),rng=G.seeded(seed);a.traits[key]=level;let previous='';for(let tick=0;tick<300*30;tick++){T.step([a],{width:600,height:400,dt:1/30,rng});if(a.behavior.mode===mode&&previous!==mode)total++;previous=a.behavior.mode;}}return total;};
  assert.ok(visits(1)>=visits(0)*2+6,key);
 }
});
test('Focus preserves a thirsty beetle’s goal across repeated pick-ups, while low focus allows distraction',()=>{
 for(const focus of [0,1]){
  const a=make(focus),rng=G.seeded(77);T.step([a],{width:600,height:400,dt:1/30,rng});Object.assign(a.behavior,{thirst:.95,hunger:0,chill:0,decision:0,remaining:0});T.step([a],{width:600,height:400,dt:1/30,rng});assert.equal(a.behavior.intent,'water');
  for(let n=0;n<4;n++){T.hold(a);a.held=true;T.step([a],{width:600,height:400,dt:1/30,rng});a.x=.15+n*.03;a.y=.25;const thirst=a.behavior.thirst;a.held=false;T.release(a);T.step([a],{width:600,height:400,dt:1/30,rng});assert.equal(a.behavior.intent,'water');assert.ok(a.behavior.thirst>=thirst);assert.equal(a.behavior.mode,focus?'water':'explore');}
 }
});
test('Focused thirsty beetles ignore a harmless greeting and resume water seeking after a shove',()=>{
 const a=make(),b=make();b.id='neighbor';a.traits.sociality=b.traits.sociality=1;b.traits.pushDrive=0;a.x=.48;b.x=.52;
 const rng=()=>.1;T.step([a],{width:600,height:400,dt:1/30,rng});Object.assign(a.behavior,{thirst:.95,hunger:0,chill:0,decision:0,remaining:0});T.step([a,b],{width:600,height:400,dt:1/30,rng});assert.equal(a.behavior.mode,'water');
 a.behavior.mode='yield';a.behavior.target=b.id;a.behavior.remaining=0;a.behavior.decision=0;T.step([a,b],{width:600,height:400,dt:1/30,rng});assert.equal(a.behavior.mode,'water');
});
test('Legacy tanks upgrade neutrally without changing original DNA, fingerprints, appearance or old archived readings',()=>{
 const s=G.createState(38);G.retire(s,'B3');for(const key of G.tankKeys)delete s.retired.B3.measurements[key];for(const b of Object.values(s.beetles))b.genome.pop();const dna=G.clone(s.beetles.B1.genome),before=G.fingerprint(s.beetles.B1),art=G.appearance(s.beetles.B1),copy=G.validate(G.clone(s));assert.deepEqual(copy.beetles.B1.genome.slice(0,10),dna);assert.equal(G.fingerprint(copy.beetles.B1),before);assert.deepEqual(G.appearance(copy.beetles.B1),art);for(const key of G.tankKeys){assert.equal(G.expressed(copy.beetles.B1,key),.5);assert.equal(N.rows(copy,key).find(r=>r.id==='B3').value,null);}
 assert.equal(G.packet(copy.beetles.B1).version,3);assert.equal(G.packet(copy.beetles.B1).beetle.genome.length,10);
});
test('New habitat genes survive files, import, reports, notebook readings and backend packet validation exactly',()=>{
 const s=G.createState(41),b=s.beetles.B1;for(const key of G.tankKeys)G.setCopies(b,key,.123456,.876543);const packet=G.packet(b);assert.equal(packet.version,4);assert.equal(packet.beetle.genome.length,11);const imported=G.importPacket(s,packet);assert.deepEqual(imported.genome,b.genome);
 for(const key of G.tankKeys){assert.ok(L.options(false).some(t=>t.key===key));assert.equal(L.rows(b,[key])[0].value,G.expressed(b,key));assert.equal(N.rows(s,key).find(r=>r.id==='B1').value,G.expressed(b,key));assert.ok(R.snapshot(b).rows.some(r=>r.key===key));}
 for(const backend of ['pattern-sumo','pattern-trade']){const E=require('../supabase/functions/'+backend+'/genetics.js');assert.deepEqual(E.validatePacket(packet).beetle.genome,b.genome);assert.equal(E.fingerprint(b),G.fingerprint(b));}
});

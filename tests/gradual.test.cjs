'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js'),S=require('../dist/pattern-lab/sumo.js'),V3=require('../dist/pattern-lab/sumo-v3.js');
function parents(){const s=G.createState(32);return [s.beetles.B1,s.beetles.B2];}
test('Every continuous physical and behavior value has bounded gradual inheritance, even with extreme hidden copies',()=>{
 const[a,b]=parents(),r=G.seeded(77);assert.equal(G.quantitativeKeys.size,53);for(const key of G.quantitativeKeys){const l=G.byKey[key];G.setCopies(a,key,l.min,l.max);G.setCopies(b,key,l.min,l.max);}const signs=Object.fromEntries([...G.quantitativeKeys].map(k=>[k,[0,0]]));
 for(let n=0;n<1200;n++){const child=G.baby(a,b,'C',{rate:0,rng:r});assert.equal(child.mutations.length,0);for(const key of G.quantitativeKeys){const l=G.byKey[key],mean=(l.min+l.max)/2,v=G.expressed(child,key);assert.ok(Math.abs(v-mean)<=.035000001*(l.max-l.min),key);signs[key][v>mean?0:1]++;}}
 for(const[key,[above,below]]of Object.entries(signs))assert.ok(above>400&&below>400,key);
});
test('Large continuous changes require mutations in that specific trait, and most mutations stay small',()=>{
 const[a,b]=parents(),r=G.seeded(508),totals={births:8000,largeBabies:0,largeTraits:0,smallMutations:0};for(const key of G.quantitativeKeys){const l=G.byKey[key];G.setCopies(a,key,(l.min+l.max)/2);G.setCopies(b,key,(l.min+l.max)/2);}
 for(let n=0;n<totals.births;n++){const child=G.baby(a,b,'C',{rate:.005,rng:r});let large=false;for(const key of G.quantitativeKeys){const l=G.byKey[key],delta=Math.abs(G.expressed(child,key)-(l.min+l.max)/2)/(l.max-l.min);if(delta>.035000001)assert.ok(child.mutations.includes(key),key);if(delta>.1){totals.largeTraits++;large=true;}else if(child.mutations.includes(key))totals.smallMutations++;}if(large)totals.largeBabies++;}
 assert.ok(totals.largeTraits>20&&totals.largeBabies/totals.births<.04,JSON.stringify(totals));assert.ok(totals.smallMutations>totals.largeTraits*8,JSON.stringify(totals));
});
test('Color, marking placement, pattern gates and categorical forms retain real transmitted copies',()=>{
 const[a,b]=parents(),r=G.seeded(199),appearance=G.loci.filter(l=>l.model!=='quantitative');assert.equal(appearance.length,27);for(let n=0;n<600;n++){const c=G.baby(a,b,'C',{rate:0,rng:r});for(const l of appearance)for(let i=0;i<2;i++)assert.ok(G.copies(i?b:a,l.key).some(copy=>JSON.stringify(copy)===JSON.stringify(G.copies(c,l.key)[i])),l.key);}
});
test('Hidden colors and pattern gates still produce contrasting and newly visible offspring at zero mutation',()=>{
 const[a,b]=parents(),r=G.seeded(231);for(const p of [a,b]){G.setCopies(p,'body',{rgb:[50,150,70],expression:.9},{rgb:[220,55,65],expression:.2});G.setCopies(p,'plain',{value:'S',expression:.5},{value:'s',expression:.5});G.setCopies(p,'layers',{value:'T',expression:.5},{value:'t',expression:.5});}
 let red=0,marked=0,two=0;for(let n=0;n<1200;n++){const p=G.phenotype(G.baby(a,b,'C',{rate:0,rng:r}));if(p.body[0]>p.body[1])red++;if(p.visibleLayers)marked++;if(p.visibleLayers===2)two++;}assert.ok(red>200&&red<400);assert.ok(marked>200&&marked<400);assert.ok(two>40&&two<110);
});
test('Derived speed changes gradually for similar parents and stays close even across extreme parental sizes',()=>{
 const[a,b]=parents(),r=G.seeded(13);for(const p of [a,b])for(const key of G.quantitativeKeys){const l=G.byKey[key];G.setCopies(p,key,(l.min+l.max)/2);}const mean=G.phenotype(a).speed;for(let n=0;n<1000;n++)assert.ok(Math.abs(G.phenotype(G.baby(a,b,'C',{rate:0,rng:r})).speed-mean)<.08);
 for(const key of ['motor','stride','legLength']){const l=G.byKey[key];G.setCopies(a,key,l.min);G.setCopies(b,key,l.max);}const center=(G.phenotype(a).speed+G.phenotype(b).speed)/2;for(let n=0;n<300;n++)assert.ok(Math.abs(G.phenotype(G.baby(a,b,'C',{rate:0,rng:r})).speed-center)<.14);
});
test('Field marks are deterministic, opaque clues that survive export without rerolling genes',()=>{
 const[a]=parents(),before=JSON.stringify(a),words=G.observationTags(a);assert.equal(words.length,5);assert.deepEqual(words,G.observationTags(a));assert.deepEqual(words,G.observationTags(G.validatePacket(G.packet(a)).beetle));assert.doesNotMatch(words.join(' '),/strong|weak|medium|fast|slow|speed|stamina|focus|low|high|\d/i);assert.equal(JSON.stringify(a),before);G.setCopies(a,'strength',0);const low=G.observationTags(a);G.setCopies(a,'strength',1);const high=G.observationTags(a);assert.notEqual(low[1],high[1]);assert.equal(low[0],high[0]);
});
test('Tank placement survives a file round trip and retired beetles leave no dangling position',()=>{
 const s=G.createState();s.tankLayout.B1={x:.7,y:.4,angle:1.2};s.keepLayout.B2={x:.3,y:.6,angle:.8};G.move(s,'B2','collection');assert.deepEqual(G.validate(G.clone(s)).tankLayout,s.tankLayout);G.retire(s,'B1');assert.equal(s.tankLayout.B1,undefined);G.validate(G.clone(s));const bad=G.clone(s);bad.tankLayout.B3={x:3,y:.5,angle:0};assert.throws(()=>G.validate(bad));
});
test('Smaller ring awards a timed finish to the beetle nearest the center, even in the same circle band',()=>{
 const[a,b]=parents(),m=S.create(a,b,91,{maxSeconds:1/60});assert.equal(m.radius,160);for(const[i,f]of m.fighters.entries()){f.x=i?-42:41;f.y=0;f.vx=f.vy=0;f.t.maxSpeed=0;f.think=100;}S.step(m);assert.equal(m.winner,0);assert.equal(m.reason,'Closest to center');assert.deepEqual(m.centerDistances,[41,42]);
});
test('Equal distances remain a true tie; ring-outs still beat the clock',()=>{
 const[a,b]=parents(),m=S.create(a,b,81,{maxSeconds:1/60});for(const[i,f]of m.fighters.entries()){f.x=i?80:-80;f.y=0;f.vx=f.vy=0;f.t.maxSpeed=0;f.think=100;}S.step(m);assert.equal(m.winner,null);assert.equal(m.reason,'Center tie');const out=S.create(a,b,55);out.fighters[0].x=170;out.fighters[0].y=0;S.step(out);assert.equal(out.winner,1);assert.equal(out.reason,'Ring-out');const both=S.create(a,b,91);for(const[i,f]of both.fighters.entries()){f.x=i?-180:170;f.y=0;f.vx=f.vy=0;f.t.maxSpeed=0;f.think=100;}S.step(both);assert.equal(both.winner,0);assert.equal(both.reason,'Closest to center');
});
test('SUMO3 replay physics and center-decision records both remain portable',()=>{
 const s=G.createState(),a=s.beetles.B1,b=s.beetles.B2,old=S.run(a,b,31,{version:'SUMO3'});assert.deepEqual(S.record(old),V3.record(V3.run(a,b,31)));const m=S.create(a,b,99,{maxSeconds:1/60});for(const[i,f]of m.fighters.entries()){f.x=i?80:40;f.y=0;f.vx=f.vy=0;f.t.maxSpeed=0;f.think=100;}S.step(m);s.matchHistory=[S.record(old),S.record(m)];assert.deepEqual(G.validate(G.clone(s)).matchHistory,s.matchHistory);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../dist/pattern-lab/genetics.js');
function ready(){const s=G.createState();G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');return s;}
test('One-brood cleanup retires founders on first birth and siblings on later births, protecting favorites and parents',()=>{
 const s=ready();s.settings.broods=1;G.move(s,'B3','collection');const protectedDNA=JSON.stringify(['B1','B2','B3'].map(id=>s.beetles[id]));
 const r=G.seeded(29),first=G.breedRound(s,{rng:r});assert.deepEqual(s.tank,first.offspring);assert.ok(s.retired.B4.measurements);assert.equal(s.retired.B4.genome,undefined);
 const second=G.breedRound(s,{rng:r});assert.deepEqual(s.tank,second.offspring);assert.equal(s.nursery.length,0);assert.ok(first.offspring.every(id=>s.retired[id].measurements&&!s.beetles[id]));
 assert.ok(s.tank.every(id=>s.beetles[id].lineageGeneration===1));assert.equal(JSON.stringify(['B1','B2','B3'].map(id=>s.beetles[id])),protectedDNA);
 assert.deepEqual(G.validate(G.clone(s)),s);
});
test('Changing cleanup applies at the next birth, including across save and restore',()=>{
 const s=ready();G.breedRound(s,{rng:G.seeded(21)});const before=s.tank.slice();s.settings.broods=1;
 const loaded=G.validate(G.clone(s));assert.deepEqual(loaded.tank,before);
 const next=G.breedRound(loaded,{rng:G.seeded(22)});assert.deepEqual(loaded.tank,next.offspring);assert.ok(before.every(id=>loaded.retired[id]));
 loaded.settings.broods=2;const later=G.breedRound(loaded,{rng:G.seeded(23)});assert.deepEqual(loaded.tank,[...next.offspring,...later.offspring]);
});
test('One-brood cleanup protects pending offers and treats imported beetles by arrival round',()=>{
 const s=ready();s.settings.broods=1;s.tradeLocks=['B4'];const p=G.packet(G.createState(99).beetles.B1),imported=G.importPacket(s,p);
 const h=G.breedRound(s,{rng:G.seeded(24)});assert.ok(s.beetles.B4);assert.ok(s.retired[imported.id]);assert.ok(h.offspring.every(id=>s.beetles[id]));
 s.tradeLocks=[];G.breedRound(s,{rng:G.seeded(25)});assert.ok(s.retired.B4);
});
test('Old saves and class codes default to two broods, while new links preserve either choice',()=>{
 const s=ready();delete s.settings.broods;assert.equal(G.validate(s).settings.broods,2);
 const c={v:1,seed:42,mutation:.005,backdrop:'moss',stats:false,environment:true,speed:1};assert.deepEqual(G.decodeConfig(G.encodeConfig(c)),c);
 for(const broods of [1,2]){assert.equal(G.decodeConfig(G.encodeConfig({...c,broods})).broods,broods);const s=ready();s.settings.broods=broods;G.validate(s);}
 for(const broods of [0,3,'1',null]){assert.throws(()=>G.encodeConfig({...c,broods}));const s=ready();s.settings.broods=broods;assert.throws(()=>G.validate(s));}
});

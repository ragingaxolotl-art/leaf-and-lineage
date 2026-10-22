'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../dist/pattern-lab/genetics.js');
function ready(){const s=G.createState();G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');s.settings.broods=1;return s;}
test('Cleanup exclusions preserve exact beetles through automatic and manual cleanup, then allow release when unchecked',()=>{
 const s=ready();s.beetles.B3.name='Dandelion';G.excludeFromCleanup(s,'B3',true);const original=G.clone(s.beetles.B3);
 for(let n=0;n<3;n++)G.breedRound(s,{rng:G.seeded(n+12)});
 assert.deepEqual(s.beetles.B3,original);assert.equal(G.retire(s,'B3'),false);G.cleanup(s,{all:true});assert.deepEqual(s.beetles.B3,original);
 G.excludeFromCleanup(s,'B3',false);G.cleanup(s,{all:true});assert.equal(s.beetles.B3,undefined);assert.equal(s.retired.B3.name,'Dandelion');assert.ok(s.retired.B3.measurements);G.validate(G.clone(s));
});
test('Exclusions persist through save and restore, work in nursery and do not pass to babies',()=>{
 const s=ready();G.move(s,'B3','nursery');G.excludeFromCleanup(s,'B3',true);G.excludeFromCleanup(s,'B1',true);
 const loaded=G.validate(G.clone(s));assert.deepEqual(loaded.cleanupExcluded,['B3','B1']);const h=G.breedRound(loaded,{rng:G.seeded(91)});
 assert.ok(loaded.beetles.B3);assert.ok(h.offspring.every(id=>!loaded.cleanupExcluded.includes(id)));assert.deepEqual(G.validate(G.clone(loaded)),loaded);
});
test('Legacy saves protect already named beetles before cleanup without changing DNA',()=>{
 const s=ready();s.settings.broods=2;G.breedRound(s,{rng:G.seeded(7)});G.breedRound(s,{rng:G.seeded(8)});
 const id=s.history[0].offspring[0];s.beetles[id].name='Older favorite';delete s.cleanupExcluded;
 const loaded=G.validate(G.clone(s));assert.ok(loaded.cleanupExcluded.includes(id));G.breedRound(loaded,{rng:G.seeded(9)});assert.deepEqual(loaded.beetles[id],s.beetles[id]);
});
test('Review cleanup only affects reviewed IDs, while Keep, parents, exclusions and trades remain safe',()=>{
 const s=ready();G.move(s,'B3','collection');s.tradeLocks=['B4'];G.excludeFromCleanup(s,'B5',true);const reviewed=s.tank.slice();
 const incoming=G.importPacket(s,G.packet(G.createState(92).beetles.B1));const ids=G.cleanup(s,{all:true,ids:reviewed});
 assert.ok(!ids.includes(incoming.id));for(const id of ['B1','B2','B3','B4','B5',incoming.id])assert.ok(s.beetles[id]);assert.ok(s.retired.B6);
});
test('Exclusions reject malformed save data and leave anonymous genetics packets unchanged',()=>{
 const s=ready(),before=G.packet(s.beetles.B3,{anonymous:true});G.excludeFromCleanup(s,'B3',true);assert.deepEqual(G.packet(s.beetles.B3,{anonymous:true}),before);
 for(const excluded of [['B9000'],['B3','B3'],null,'B3']){const bad=G.clone(s);bad.cleanupExcluded=excluded;assert.throws(()=>G.validate(bad));}
 assert.throws(()=>G.excludeFromCleanup(s,'B9000',true));assert.throws(()=>G.excludeFromCleanup(s,'B3','yes'));
});

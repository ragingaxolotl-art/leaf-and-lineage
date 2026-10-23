'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js');
test('Refresh replaces working beetles with new random founders while preserving parents, favorites, experiment and store',()=>{
 const s=G.createState(42);G.move(s,'B1','collection');G.move(s,'B2','jar-1');G.move(s,'B3','jar-1');s.beetles.B4.name='Named';G.excludeFromCleanup(s,'B4',true);G.ensureStore(s,{rng:G.seeded(92)});G.takeStoreBeetle(s,0);s.round=0;s.notes='My experiment';
 const store=G.clone(s.store),keep=G.clone(s.beetles.B1),parents=G.clone(s.jars),old=[...s.tank,...s.nursery],settings=G.clone(s.settings);
 const ids=G.refreshTank(s,{rng:G.seeded(21)});assert.equal(ids.length,16);assert.equal(s.tank.length,16);assert.equal(s.nursery.length,0);assert.deepEqual(s.store,store);assert.deepEqual(s.beetles.B1,keep);assert.deepEqual(s.jars,parents);assert.equal(s.round,0);assert.equal(s.notes,'My experiment');assert.deepEqual(s.settings,settings);
 for(const id of old){assert.equal(s.beetles[id],undefined);assert.ok(s.retired[id].measurements);assert.equal(s.retired[id].reason,'released');}assert.deepEqual(G.validate(G.clone(s)),s);
 const first=ids.map(id=>G.fingerprint(s.beetles[id]));const second=G.refreshTank(s,{rng:G.seeded(22)}).map(id=>G.fingerprint(s.beetles[id]));assert.notDeepEqual(first,second);
});
test('Refresh at a later round keeps arrivals through the next normal cleanup and never resets store allowance',()=>{
 const s=G.createState();G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');G.breedRound(s,{rng:G.seeded(8)});G.ensureStore(s,{rng:G.seeded(9)});G.takeStoreBeetle(s,0);G.takeStoreBeetle(s,1);const stock=G.clone(s.store);const ids=G.refreshTank(s,{rng:G.seeded(10)});assert.equal(s.round,1);assert.deepEqual(s.store,stock);assert.throws(()=>G.takeStoreBeetle(s,2),/chosen two/);assert.equal(G.cleanup(s).length,0);for(const id of ids)assert.equal(s.beetles[id].arrivedRound,1);G.validate(s);
});
test('Pending trades block a refresh without changing any beetles or spending random rolls',()=>{
 const s=G.createState();s.tradeLocks=['B1'];const before=G.clone(s);assert.throws(()=>G.refreshTank(s,{rng:()=>{throw Error('Should not roll');}}),/trade first/);assert.deepEqual(s,before);
});

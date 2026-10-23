'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js');
function breed(s,n=5){for(let i=0;i<n;i++)G.breedRound(s,{rng:G.seeded(817+s.round)});}
test('Refresh replaces working beetles with new random founders while preserving parents, favorites, experiment and store',()=>{
 const s=G.createState(42);G.move(s,'B1','collection');G.move(s,'B2','jar-1');G.move(s,'B3','jar-1');s.beetles.B4.name='Named';G.excludeFromCleanup(s,'B4',true);breed(s);s.beetles[s.tank[0]].name='Named';G.excludeFromCleanup(s,s.tank[0],true);G.ensureStore(s,{rng:G.seeded(92)});G.takeStoreBeetle(s,0);s.notes='My experiment';
 const store=G.clone(s.store),keep=G.clone(s.beetles.B1),parents=G.clone(s.jars),old=[...s.tank,...s.nursery],settings=G.clone(s.settings);
 const ids=G.refreshTank(s,{rng:G.seeded(21)});assert.equal(ids.length,16);assert.equal(s.tank.length,16);assert.equal(s.nursery.length,0);assert.deepEqual(s.store,store);assert.deepEqual(s.beetles.B1,keep);assert.deepEqual(s.jars,parents);assert.equal(s.round,5);assert.equal(s.notes,'My experiment');assert.deepEqual(s.settings,settings);
 for(const id of old){assert.equal(s.beetles[id],undefined);assert.ok(s.retired[id].measurements);assert.equal(s.retired[id].reason,'released');}assert.deepEqual(G.validate(G.clone(s)),s);
 const first=ids.map(id=>G.fingerprint(s.beetles[id]));breed(s);const second=G.refreshTank(s,{rng:G.seeded(22)}).map(id=>G.fingerprint(s.beetles[id]));assert.notDeepEqual(first,second);
});
test('Refresh at a later round keeps arrivals through the next normal cleanup and never resets store allowance',()=>{
 const s=G.createState();G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');breed(s);G.ensureStore(s,{rng:G.seeded(9)});G.takeStoreBeetle(s,0);G.takeStoreBeetle(s,1);const stock=G.clone(s.store);const ids=G.refreshTank(s,{rng:G.seeded(10)});assert.equal(s.round,5);assert.deepEqual(s.store,stock);assert.throws(()=>G.takeStoreBeetle(s,2),/chosen two/);assert.equal(G.cleanup(s).length,0);for(const id of ids)assert.equal(s.beetles[id].arrivedRound,5);G.validate(s);
});
test('Pending trades block a refresh without changing any beetles or spending random rolls',()=>{
 const s=G.createState();s.tradeLocks=['B1'];const before=G.clone(s);assert.throws(()=>G.refreshTank(s,{rng:()=>{throw Error('Should not roll');}}),/trade first/);assert.deepEqual(s,before);
});

test('Refresh requires five successful breeds between uses, survives reload and rejects invalid counters',()=>{const s=G.createState();G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');assert.equal(G.refreshWait(s),5);assert.throws(()=>G.refreshTank(s),/5 more/);breed(s,4);const before=G.clone(s);assert.throws(()=>G.refreshTank(s,{rng:()=>{throw Error('No roll');}}),/1 more/);assert.deepEqual(s,before);breed(s,1);G.refreshTank(s,{rng:G.seeded(1)});const saved=G.validate(G.clone(s));assert.equal(G.refreshWait(saved),5);assert.throws(()=>G.refreshTank(saved),/5 more/);breed(saved,5);assert.equal(G.refreshWait(saved),0);for(const value of [-1,11,1.5]){const bad=G.clone(saved);bad.lastTankRefreshRound=value;assert.throws(()=>G.validate(bad),/refresh record/);}delete saved.lastTankRefreshRound;G.validate(saved);assert.equal(saved.lastTankRefreshRound,0);});

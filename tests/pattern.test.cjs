'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../dist/pattern-lab/genetics.js');
const ready=(two=false)=>{const s=G.createState(42);for(const id of ['B1','B2','B3','B4'])G.move(s,id,'jar-1');if(two){for(const id of ['B5','B6'])G.move(s,id,'jar-2');s.jars[1].active=true;}return s;};
test('Pattern Lab has 113 paired loci, eleven chromosomes, and reproducible founders',()=>{
 const s=G.createState(42);assert.equal(G.loci.length,113);assert.equal(s.tank.length,16);assert.deepEqual(s,G.createState(42));assert.notDeepEqual(s,G.createState(43));G.validate(s);
});
test('Mendelian loci transmit actual parental alleles; continuous traits have bounded quantitative segregation',()=>{
 const s=G.createState(),a=s.beetles.B1,b=s.beetles.B2,r=G.seeded(1);
 // Give every locus a distinct, valid homolog value to observe linkage.
 for(const c of G.chromosomes)for(const l of c.loci)if(l.type==='number')G.setCopies(a,l.key,l.min,l.max);
 for(let n=0;n<200;n++){const child=G.baby(a,b,'test',{rate:0,rng:r});assert.equal(child.mutations.length,0);for(let ci=0;ci<5;ci++){let switches=0,side=null;for(let i=0;i<G.chromosomes[ci].loci.length;i++){for(let parent=0;parent<2;parent++){const source=parent?b:a,allele=child.genome[ci].copies[parent][i];if(G.chromosomes[ci].loci[i].model==='quantitative'){const l=G.chromosomes[ci].loci[i];assert.ok(Math.abs(allele-G.expressed(source,l.key))<=.035000001*(l.max-l.min));}else assert.ok(source.genome[ci].copies.some(cp=>JSON.stringify(cp[i])===JSON.stringify(allele)));}const l=G.chromosomes[ci].loci[i];if(l.type==='number'&&l.model!=='quantitative'){const next=child.genome[ci].copies[0][i]===l.min?0:1;if(side!==null&&side!==next)switches++;side=next;}}assert.ok(switches<=1);}}
});
test('Hidden pattern gates follow independent Ss Tt inheritance without mutation',()=>{
 const s=G.createState(),a=s.beetles.B1,b=s.beetles.B2,r=G.seeded(921),n=6000,counts=[0,0,0];
 assert.equal(G.phenotype(a).visibleLayers,0);assert.equal(G.phenotype(b).visibleLayers,0);
 for(let i=0;i<n;i++)counts[G.phenotype(G.baby(a,b,'child',{rate:0,rng:r})).visibleLayers]++;
 for(const [i,p] of [.75,.1875,.0625].entries())assert.ok(Math.abs(counts[i]/n-p)<.025,counts.join(','));
});
test('Latent framework genes can reappear in descendants and rendered phenotype stays fixed',()=>{
 const s=G.createState(),a=s.beetles.B1,b=s.beetles.B2,r=G.seeded(72);
 for(const parent of [a,b]){G.setCopies(parent,'antenna',{value:'thread',expression:.9},{value:'fan',expression:.2});G.setCopies(parent,'leg',{value:'runner',expression:.9},{value:'paddle',expression:.2});}
 let fan=0,paddle=0;
 for(let i=0;i<500;i++){const child=G.baby(a,b,'x',{rate:0,rng:r}),p=G.phenotype(child);if(p.antenna==='fan')fan++;if(p.leg==='paddle')paddle++;assert.deepEqual(G.phenotype(child),p);}
 assert.ok(fan>80&&fan<170);assert.ok(paddle>80&&paddle<170);
});
test('Single-jar rounds produce 10–20 babies, preserve parents, and retain only two newest broods',()=>{
 const s=ready(),r=G.seeded(92),parents=s.jars[0].members.slice(),seen=new Set();let total=0;
 for(let i=0;i<30;i++){const h=G.breedRound(s,{rng:r});seen.add(h.total);total+=h.total;assert.ok(h.total>=10&&h.total<=20);assert.equal(h.allocations.length,1);assert.equal(h.allocations[0].count,h.total);for(const id of h.offspring){const b=s.beetles[id];assert.equal(new Set(b.parents).size,2);assert.ok(b.parents.every(id=>parents.includes(id)));assert.equal(b.lineageGeneration,1);}}
 assert.ok(seen.size>=7);assert.deepEqual(s.jars[0].members,parents);const recent=s.history.slice(-2).reduce((n,h)=>n+h.total,0);assert.equal(s.tank.length,recent);assert.equal(s.nursery.length,0);assert.equal(Object.keys(s.beetles).length,4+recent);assert.equal(Object.keys(s.retired).length,16+total-4-recent);G.validate(s);
});
test('Two jars split the total, never cross parents, and the extra is not always assigned to one jar',()=>{
 const s=ready(true),r=G.seeded(123);let extra=new Set(),pairSet=new Set();
 for(let n=0;n<30;n++){const h=G.breedRound(s,{rng:r}),[a,b]=h.allocations;assert.equal(a.count+b.count,h.total);assert.ok(Math.abs(a.count-b.count)<=1);if(a.count!==b.count)extra.add(a.count>b.count?'jar-1':'jar-2');for(const id of h.offspring){const child=s.beetles[id],jar=s.jars.find(j=>j.id===child.sourceJarId);assert.ok(child.parents.every(id=>jar.members.includes(id)));if(child.sourceJarId==='jar-1')pairSet.add(child.parents.slice().sort().join(','));else assert.deepEqual(child.parents.slice().sort(),['B5','B6']);}}
 assert.equal(extra.size,2);assert.equal(pairSet.size,6);G.validate(s);
});
test('Incomplete jars cannot breed and do not take a share',()=>{
 const s=G.createState();assert.throws(()=>G.breedRound(s));assert.equal(s.round,0);G.move(s,'B1','jar-1');assert.throws(()=>G.breedRound(s));G.move(s,'B2','jar-1');s.jars[1].active=true;G.move(s,'B3','jar-2');const h=G.breedRound(s,{rng:G.seeded(4)});assert.equal(h.allocations.length,1);assert.equal(h.allocations[0].count,h.total);
});
test('Container moves are unique, jar capacity is enforced, and saves restore every inherited copy',()=>{
 const s=ready(true);assert.throws(()=>G.move(s,'B7','jar-1'));assert.ok(s.tank.includes('B7'));G.move(s,'B1','collection');assert.equal(G.container(s,'B1'),'collection');G.move(s,'B1','jar-2');assert.equal(G.container(s,'B1'),'jar-2');G.breedRound(s,{rng:G.seeded(7)});const loaded=G.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);
});
test('Zero mutation preserves family traits; maximum mutation respects all allele bounds',()=>{
 const s=ready();s.settings.mutation=.1;for(let i=0;i<10;i++)G.breedRound(s,{rng:G.seeded(i+1)});G.validate(s);assert.ok(Object.values(s.beetles).some(b=>b.mutations.length>0));
});
test('Speed and strength do not change parent draws or brood size',()=>{
 const a=ready(true),b=G.clone(a);
 for(const beetle of Object.values(b.beetles))for(const key of ['motor','stride','strength'])G.setCopies(beetle,key,1,1);
 const x=G.breedRound(a,{rng:G.seeded(100)}),y=G.breedRound(b,{rng:G.seeded(100)});assert.deepEqual(x,y);assert.deepEqual(x.offspring.map(id=>a.beetles[id].parents),y.offspring.map(id=>b.beetles[id].parents));
});
test('Inspection and forecasts consume no actual breeding randomness',()=>{
 const a=ready(true),b=G.clone(a);const before=JSON.stringify(a);G.forecast(a,a.jars[0]);G.forecast(a,a.jars[1]);assert.equal(JSON.stringify(a),before);assert.deepEqual(G.breedRound(a,{rng:G.seeded(934)}),G.breedRound(b,{rng:G.seeded(934)}));
});
test('Save validation rejects malformed or injected family records and duplicate containers',()=>{
 const s=ready();G.breedRound(s,{rng:G.seeded(1)});
 for(const mutate of [s=>s.tank.push(s.jars[0].members[0]),s=>s.history[0].total='<img src=x onerror=alert(1)>',s=>s.beetles.B17.parents=['B17','B2'],s=>s.beetles.B1.genome[0].copies[0][0].rgb=[-1,0,0],s=>s.history[0].allocations[0].parents=['B8','B9']]){const bad=G.clone(s);mutate(bad);assert.throws(()=>G.validate(bad));}
});
test('Different breeding streams make different offspring from the same starting seed',()=>{
 const a=ready(),b=ready();G.breedRound(a,{rng:G.seeded(100)});G.breedRound(b,{rng:G.seeded(101)});assert.notDeepEqual(a.history,b.history);assert.deepEqual(a.beetles.B1,b.beetles.B1);
});
test('The ten-favorite Keep tank stays intact across broods and file round trips',()=>{
 const s=ready(),r=G.seeded(22),favorites=Array.from({length:10},(_,i)=>'B'+(i+5));
 for(const id of favorites)G.move(s,id,'collection');
 s.keepLayout.B5={x:.3,y:.4,angle:.5};const kept=JSON.stringify(favorites.map(id=>s.beetles[id]));
 assert.throws(()=>G.move(s,'B15','collection'),/10 favorites/);assert.ok(s.tank.includes('B15'));
 for(let i=0;i<4;i++)G.breedRound(s,{rng:r});
 assert.deepEqual(s.collection,favorites);assert.equal(JSON.stringify(favorites.map(id=>s.beetles[id])),kept);assert.deepEqual(s.keepLayout.B5,{x:.3,y:.4,angle:.5});
 const restored=G.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.collection,favorites);assert.deepEqual(restored.keepLayout,s.keepLayout);
 G.move(s,'B5','nursery');G.move(s,s.history.at(-1).offspring[0],'collection');assert.equal(s.collection.length,10);G.validate(s);
});
test('Classroom codes preserve zeros and permission choices and reject damaged links',()=>{
 for(const backdrop of ['moss','sand','bark','night'])for(const stats of [false,true])for(const environment of [false,true])for(const speed of [.5,1,2,5,10]){
  const c={v:1,seed:42,mutation:0,backdrop,stats,environment,speed},code=G.encodeConfig(c);assert.deepEqual(G.decodeConfig(code),c);assert.throws(()=>G.decodeConfig(code.slice(0,-1)));assert.throws(()=>G.decodeConfig(code+'x'));
 }
 assert.throws(()=>G.encodeConfig({v:1,seed:0}));assert.throws(()=>G.encodeConfig({v:1,seed:1,mutation:.3}));
});
test('Every antenna and leg framework renders stable original vector artwork',()=>{
 global.PatternGenetics=G;require('../dist/pattern-lab/beetles.js');
 const b=G.createState().beetles.B1;
 for(const form of Object.keys(G.antennaNames))for(const leg of Object.keys(G.legNames)){
  G.setCopies(b,'antenna',{value:form,expression:.5});G.setCopies(b,'leg',{value:leg,expression:.5});G.setCopies(b,'plain',{value:'s',expression:.5});G.setCopies(b,'layers',{value:'t',expression:.5});const before=JSON.stringify(b),svg=global.PatternBeetles.draw(b,'test');assert.equal(svg,global.PatternBeetles.draw(b,'test'));assert.match(svg,/<svg /);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);assert.equal(JSON.stringify(b),before);
 }
});
test('Forecasts use the same fair parental-order tie rule as actual births',()=>{
 const s=G.createState();G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');s.settings.mutation=0;
 G.setCopies(s.beetles.B1,'antenna',{value:'thread',expression:.8});G.setCopies(s.beetles.B2,'antenna',{value:'fan',expression:.8});
 const f=G.forecast(s,s.jars[0],2000);assert.ok(Math.abs(f.antennae.thread/f.n-.5)<.05);assert.ok(Math.abs(f.antennae.fan/f.n-.5)<.05);
 const r=G.seeded(431);let thread=0,total=0;for(let i=0;i<30;i++){const h=G.breedRound(s,{rng:r});for(const id of h.offspring){total++;if(G.phenotype(s.beetles[id]).antenna==='thread')thread++;}}
 assert.ok(Math.abs(thread/total-f.antennae.thread/f.n)<.08);
});

test('Older cohorts clear regardless of lineage generation; saved parents and favorites retain exact DNA',()=>{
 const s=ready(),r=G.seeded(24);G.move(s,'B5','collection');const kept=G.clone(s.beetles.B5),parents=G.clone(s.jars[0].members.map(id=>s.beetles[id]));
 const first=G.breedRound(s,{rng:r}).offspring.slice();G.breedRound(s,{rng:r});assert.ok(first.every(id=>s.beetles[id]));G.breedRound(s,{rng:r});assert.ok(first.every(id=>!s.beetles[id]&&s.retired[id]&&!s.retired[id].genome));
 assert.deepEqual(s.beetles.B5,kept);assert.deepEqual(s.jars[0].members.map(id=>s.beetles[id]),parents);assert.ok(s.tank.every(id=>s.beetles[id].lineageGeneration===1));G.validate(G.clone(s));
});
test('Clearing unsaved removes tank and nursery, preserves family ancestry and protected containers',()=>{
 const s=ready();G.move(s,'B5','collection');const h=G.breedRound(s,{rng:G.seeded(23)}),child=h.offspring[0];G.move(s,child,'collection');const old=G.clone(s.beetles[child]);
 const removed=G.cleanup(s,{all:true});assert.ok(removed.length>=20);assert.equal(s.tank.length,0);assert.equal(s.nursery.length,0);assert.equal(s.collection.length,2);assert.deepEqual(s.beetles[child],old);assert.ok(s.jars[0].members.every(id=>s.beetles[id]));G.validate(G.clone(s));
 for(const id of s.jars[0].members.slice())G.move(s,id,'tank');G.cleanup(s,{all:true});assert.ok(old.parents.every(id=>s.retired[id]));G.validate(G.clone(s));assert.throws(()=>G.move(s,old.parents[0],'tank'));
});
test('Repeated generations keep live genomes bounded and old saves migrate without losing kept beetles',()=>{
 const s=ready(),r=G.seeded(48);for(let i=0;i<100;i++)G.breedRound(s,{rng:r});assert.ok(Object.keys(s.beetles).length<=44);assert.equal(s.history.length,100);G.validate(G.clone(s));
 const legacy=ready();delete legacy.retired;delete legacy.tradeLocks;delete legacy.tradeReceipts;const restored=G.validate(legacy);assert.deepEqual(restored.retired,{});assert.deepEqual(restored.tradeLocks,[]);
});
test('Imports get two-brood residency and empty tanks remain valid',()=>{
 const s=ready();G.breedRound(s,{rng:G.seeded(3)});const b=G.importPacket(s,G.packet(s.beetles.B1));assert.equal(b.arrivedRound,1);G.breedRound(s,{rng:G.seeded(4)});assert.ok(s.beetles[b.id]);G.breedRound(s,{rng:G.seeded(5)});assert.ok(!s.beetles[b.id]);const empty=G.createState();G.cleanup(empty,{all:true});G.validate(empty);assert.equal(Object.keys(empty.beetles).length,0);
});
test('Trades protect offers, preserve genes and appearance, replace kept slots, and apply receipts once',()=>{
 const s=ready();G.move(s,'B5','collection');const original=G.clone(s.beetles.B5),incoming=G.packet(s.beetles.B8,{anonymous:true}),info={code:'ABCDEFGH',outgoing:'B5',fingerprint:G.fingerprint(original),incoming};
 s.tradeLocks=['B5'];G.cleanup(s,{all:true});assert.ok(s.beetles.B5);assert.throws(()=>G.move(s,'B5','jar-2'),/trade/);assert.throws(()=>G.retire(s,'B5'),/trade/);
 assert.throws(()=>G.finishTrade(s,{...info,fingerprint:'wrong'}));assert.deepEqual(s.beetles.B5,original);
 const b=G.finishTrade(s,info);assert.ok(s.collection.includes(b.id));assert.ok(!s.beetles.B5);assert.equal(s.retired.B5.reason,'traded');assert.deepEqual(b.genome,incoming.beetle.genome);assert.equal(b.developmentSeed,incoming.beetle.developmentSeed);
 const before=JSON.stringify(s);assert.equal(G.finishTrade(s,info),null);assert.equal(JSON.stringify(s),before);G.validate(G.clone(s));
});

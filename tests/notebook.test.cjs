'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js'),N=require('../dist/pattern-lab/notebook.js');
function setup(){const s=G.createState(817);G.move(s,'B1','jar-1');G.move(s,'B2','jar-1');return s;}
test('The student allowlist measures expressed traits and withholds strength and gene copies',()=>{
 const s=G.createState(),b=s.beetles.B1,p=G.phenotype(b),m=G.measurements(b);assert.equal(N.traits.length,51);assert.equal(m.speed,p.speed);assert.equal(m.endurance,p.endurance);assert.equal(m.bodyR,p.body[0]);assert.equal(m.segments,Math.round(p.segments));assert.ok(!('strength' in m));assert.ok(!('strengthIndex' in m));assert.throws(()=>N.rows(s,'strength'));assert.throws(()=>N.rawCSV(s,'strengthIndex'));for(const t of N.traits){assert.ok(Number.isFinite(m[t.key]));assert.ok(m[t.key]>=t.min&&m[t.key]<=t.max,t.key);}assert.doesNotMatch(N.rawCSV(s,'speed'),/strength|genome|mutations|expression|chromosome/i);
});
test('Measurements are read-only and never consume breeding randomness or alter appearance',()=>{
 const s=setup(),before=JSON.stringify(s),control=G.clone(s);for(let i=0;i<10;i++){N.rows(s,'endurance');N.summaryCSV(s,'speed',{},'round');}assert.equal(JSON.stringify(s),before);G.breedRound(s,{rng:G.seeded(38)});G.breedRound(control,{rng:G.seeded(38)});assert.deepEqual(s,control);
});
test('All cohorts stay countable exactly once after retirement, keeping numeric data without genomes',()=>{
 const s=setup(),r=G.seeded(45),expected=G.measurements(s.beetles.B3);let born=16;for(let i=0;i<5;i++)born+=G.breedRound(s,{rng:r}).total;assert.equal(N.rows(s,'endurance').length,born);assert.equal(new Set(N.rows(s,'speed').map(x=>x.id)).size,born);assert.equal(N.rows(s,'speed').filter(x=>x.value===null).length,0);assert.deepEqual(s.retired.B3.measurements,expected);assert.equal(s.retired.B3.genome,undefined);assert.equal(s.retired.B3.measurements.strength,undefined);assert.deepEqual(G.validate(G.clone(s)),s);
});
test('Sibling broods share one lineage generation, while breeding rounds remain separate',()=>{
 const s=setup(),r=G.seeded(34),a=G.breedRound(s,{rng:r}),b=G.breedRound(s,{rng:r}),rows=N.rows(s,'speed');const gs=N.summarize(rows),rs=N.summarize(rows,'round');assert.deepEqual(gs.map(x=>[x.group,x.count]),[[0,16],[1,a.total+b.total]]);assert.deepEqual(rs.map(x=>[x.group,x.count]),[[0,16],[1,a.total],[2,b.total]]);
});
test('Breeding descendants creates a new lineage point with true individual means and ranges',()=>{
 const s=setup(),r=G.seeded(98),first=G.breedRound(s,{rng:r});G.move(s,'B1','tank');G.move(s,'B2','tank');for(const id of first.offspring.slice(0,2))G.move(s,id,'jar-1');const second=G.breedRound(s,{rng:r}),data=N.rows(s,'endurance'),summary=N.summarize(data),last=summary.at(-1),values=second.offspring.map(id=>G.phenotype(s.beetles[id]).endurance);assert.equal(last.group,2);assert.equal(last.count,second.total);assert.ok(Math.abs(last.mean-values.reduce((a,b)=>a+b,0)/values.length)<1e-14);assert.equal(last.min,Math.min(...values));assert.equal(last.max,Math.max(...values));
});
test('Jar and origin filters keep imported generations from being mislabeled as new births',()=>{
 const s=setup(),first=G.breedRound(s,{rng:G.seeded(19)});const input=G.packet(s.beetles[first.offspring[0]]),b=G.importPacket(s,input);assert.equal(N.rows(s,'speed',{origin:'imported'}).length,1);assert.equal(N.rows(s,'speed',{origin:'local'}).length,16+first.total);assert.equal(N.rows(s,'speed',{jar:'jar-1'}).length,first.total);const row=N.rows(s,'speed',{origin:'imported'})[0];assert.equal(row.generation,1);assert.equal(row.round,1);G.retire(s,b.id);assert.equal(N.rows(s,'speed',{origin:'imported'})[0].value,G.phenotype(input.beetle).speed);assert.throws(()=>N.rows(s,'speed',{origin:'secret'}));
});
test('Old retired records stay unavailable rather than inventing data or treating missing as zero',()=>{
 const s=G.createState();G.retire(s,'B1');delete s.retired.B1.measurements;delete s.retired.B1.origin;delete s.retired.B1.arrivedRound;G.validate(s);const data=N.rows(s,'speed'),missing=data.find(x=>x.id==='B1'),sum=N.summarize(data)[0];assert.equal(missing.value,null);assert.equal(sum.count,15);assert.equal(sum.missing,1);const noData=N.summarize([missing])[0];assert.equal(noData.mean,null);assert.equal(noData.min,null);assert.equal(noData.max,null);assert.equal(noData.count,0);
});
test('Zero values count as measurements and CSV retains full precision with safe text escaping',()=>{
 const s=G.createState();G.setCopies(s.beetles.B1,'endurance',0);G.setCopies(s.beetles.B2,'endurance',.12345678901234);s.beetles.B1.name=' =SUM(1,2)\n"test"';const rows=N.rows(s,'endurance');assert.equal(rows[0].value,0);const raw=N.rawCSV(s,'endurance');assert.ok(raw.startsWith('\uFEFF'));assert.ok(raw.includes('.12345678901234'));assert.ok(raw.includes("' =SUM(1,2)"));assert.ok(raw.includes('""test""'));assert.match(N.summaryCSV(s,'endurance',{},'generation'),/Mean/);assert.doesNotMatch(raw,/strength|genome/i);
});
test('Save validation rejects malformed archived measurements, including hidden-strength additions',()=>{
 const s=G.createState();G.retire(s,'B1');for(const alter of [m=>{m.strength=.5},m=>{m.speed=Infinity},m=>{delete m.endurance},m=>{m.bodyR=256}]){const bad=G.clone(s);alter(bad.retired.B1.measurements);assert.throws(()=>G.validate(bad),/measurement/);}assert.deepEqual(G.validate(G.clone(s)).retired.B1.measurements,s.retired.B1.measurements);
});

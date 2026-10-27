'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../dist/pattern-lab/genetics.js'),R=require('../dist/pattern-lab/genetics-report.js'),N=require('../dist/pattern-lab/notebook.js');
test('Overall body size is continuous and can accumulate gradual selection without a new gene or tier',()=>{
 let a=G.createState().beetles.B1,b=G.createState().beetles.B2;for(const p of [a,b]){G.setCopies(p,'bodyWidth',1);G.setCopies(p,'bodyLength',1);}const r=G.seeded(121),sizes=[];
 for(let generation=0;generation<10;generation++){
  const meanWidth=(G.expressed(a,'bodyWidth')+G.expressed(b,'bodyWidth'))/2,meanLength=(G.expressed(a,'bodyLength')+G.expressed(b,'bodyLength'))/2;
  const children=Array.from({length:30},(_,i)=>G.baby(a,b,'B'+(i+100),{rate:0,rng:r}));
  for(const c of children){const p=G.phenotype(c);assert.equal(p.size,Math.sqrt(p.bodyWidth*p.bodyLength)*p.bodyFactor);assert.ok(Math.abs(p.bodyWidth-meanWidth)<=.035000001*(1.3-.72));assert.ok(Math.abs(p.bodyLength-meanLength)<=.035000001*(1.3-.78));}
  children.sort((x,y)=>G.phenotype(y).size-G.phenotype(x).size);[a,b]=children;sizes.push(G.phenotype(a).size);
 }
 assert.ok(sizes.at(-1)>1.04);assert.ok(sizes.at(-1)<1.4);assert.equal(G.loci.length,113);assert.equal(new Set(sizes).size,10);
});
test('Older archived dimensions supply an exact overall size measurement without inventing lost genes',()=>{
 const s=G.createState();G.retire(s,'B3');const old=s.retired.B3.measurements;delete old.size;delete s.retired.B3.measurementVersion;const expected=Math.sqrt(old.bodyWidth*old.bodyLength);const restored=G.validate(G.clone(s));assert.equal(restored.retired.B3.measurements.size,expected);assert.equal(N.rows(restored,'size').find(r=>r.id==='B3').value,expected);assert.ok(N.rawCSV(restored,'size').includes(String(expected)));
});
test('Technical report covers every paired record with actual copies, gates, precision and derived measurements',()=>{
 const b=G.createState().beetles.B1;G.setCopies(b,'endurance',.1234567890123456);const before=JSON.stringify(b),r=R.snapshot(b);assert.equal(r.rows.length,113);assert.equal(new Set(r.rows.map(r=>r.record)).size,113);assert.equal(new Set(r.rows.map(r=>r.chromosome)).size,11);assert.equal(r.rows.filter(r=>r.model.startsWith('QNT')).length,80);
 for(const l of G.loci)assert.deepEqual(r.rows.find(r=>r.key===l.key).copies,G.copies(b,l.key));assert.match(r.rows.find(r=>r.key==='plain').effect,/markings suppressed/);assert.ok(r.derived.some(r=>r.key==='strengthIndex'));assert.ok(r.derived.some(r=>r.key==='size'));assert.ok(R.tables(r).includes('.1234567890123456'));assert.equal(JSON.stringify(b),before);
});
test('Downloaded report escapes names and genetic records while preserving the complete raw data',()=>{
 const b=G.createState().beetles.B1;b.name='<script>alert(1)</script>';const r=R.snapshot(b),html=R.document(r);assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert'));assert.ok(html.includes('Complete stored beetle record'));assert.ok(html.includes('developmentSeed'));assert.ok(html.includes('strength'));assert.equal(r.fingerprint,G.fingerprint(b));const embedded=JSON.parse(html.match(/<script type="application\/json" id="pattern-beetle-data">([\s\S]*?)<\/script>/)[1]);assert.equal(G.validatePacket(embedded).beetle.name,b.name);
});

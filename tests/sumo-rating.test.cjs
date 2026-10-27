'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../dist/pattern-lab/genetics.js'),R=require('../dist/pattern-lab/sumo-rating.js');
function perfect(){
 const b=G.createState(42).beetles.B3;
 for(const group of R.groups)for(const trait of group.traits){
  const d=G.byKey[trait.key];
  if(d.type==='number')G.setCopies(b,trait.key,trait.ideal??d.max);
  else if(trait.key==='hornCount')G.setCopies(b,trait.key,{value:'triple',expression:.5});
  else G.setCopies(b,trait.key,{value:'n',expression:.5});
 }
 return b;
}
test('Every rating has exactly five slots whose copper/silver/gold/diamond values sum to the rating',()=>{
 for(let n=1;n<=20;n++){
  const stars=R.stars(n);assert.equal(stars.length,5);assert.equal(stars.reduce((sum,s)=>sum+s.value,0),n);
  assert.equal((R.markup({rating:n,stars}).match(/class="sumo-rating-star /g)||[]).length,5);
 }
 assert.deepEqual(R.stars(16).map(s=>s.tier),['diamond','gold','gold','gold','gold']);
 assert.deepEqual(R.stars(6).map(s=>s.tier),['silver','copper','copper','copper','copper']);
 assert.throws(()=>R.stars(21));assert.throws(()=>R.stars(3.5));
});
test('The registry covers every inherited input used by the current sumo engine, exactly once',()=>{
 const source=fs.readFileSync(require.resolve('../dist/pattern-lab/sumo.js'),'utf8');
 const refs=new Set([...source.matchAll(/\b(?:p|t|other)\.(\w+)/g)].map(m=>m[1]));
 const expected=new Set([...refs].filter(key=>G.byKey[key]));
 const dependencies={speed:['motor','stride','legLength'],visibleHorns:['horn','hornCount'],hornFactor:['hornGrowth'],jawFactor:['jawGrowth'],canJump:['jumpGate'],canPuff:['puffGate']};
 for(const ref of refs)for(const key of dependencies[ref]||[])expected.add(key);
 for(const move of ['lift','jump','puff'])for(const factor of G.abilityFactors)expected.add(move+factor);
 assert.equal(expected.size,56);assert.equal(R.traitKeys.length,new Set(R.traitKeys).size);
 assert.deepEqual([...R.traitKeys].sort(),[...expected].sort());
 assert.equal(R.groups.reduce((sum,g)=>sum+g.points,0),100);
});
test('All 56 inputs can individually affect the rating calculation in an expressed build',()=>{
 for(const key of R.traitKeys){
  const b=perfect(),d=G.byKey[key],p=G.phenotype(b);
  if(d.type==='number')G.setCopies(b,key,p[key]===d.max?d.min:d.max);
  else G.setCopies(b,key,{value:key==='hornCount'?'single':'N',expression:.5});
  const result=R.evaluate(b);assert.ok(result.points<100,key);assert.ok(result.rating<20,key);
 }
});
test('20/20 requires exact perfection before any display rounding',()=>{
 const b=perfect(),result=R.evaluate(b);assert.equal(result.points,100);assert.equal(result.rating,20);assert.equal(result.perfect,true);
 G.setCopies(b,'strength',1-1e-10);
 const almost=R.evaluate(b);assert.ok(almost.points>99.999);assert.equal(almost.rating,19);assert.equal(almost.perfect,false);
});
test('Suppressed abilities get no credit from hidden high factors and recessive carriers stay inactive',()=>{
 const b=perfect();G.setCopies(b,'jumpGate',{value:'N',expression:.5},{value:'n',expression:.5});
 const before=R.evaluate(b);assert.equal(G.phenotype(b).canJump,false);
 for(const factor of G.abilityFactors)G.setCopies(b,'jump'+factor,0);
 assert.equal(R.evaluate(b).points,before.points);
 G.setCopies(b,'horn',0);const noHorn=R.evaluate(b).points;
 for(const factor of G.abilityFactors)G.setCopies(b,'lift'+factor,0);
 assert.equal(R.evaluate(b).points,noHorn);
});
test('The rating uses expressed values, ignores cosmetic genes, and never mutates a beetle or save',()=>{
 const state=G.createState(42),b=state.beetles.B3,before=JSON.stringify(state),a=R.evaluate(b);
 assert.equal(JSON.stringify(state),before);
 G.setCopies(b,'strength',0,1);const mixed=R.evaluate(b).points;
 G.setCopies(b,'strength',.5,.5);assert.equal(R.evaluate(b).points,mixed);
 const score=R.evaluate(b).points;G.setCopies(b,'gloss',1);G.setCopies(b,'metallic',1);assert.equal(R.evaluate(b).points,score);
 assert.ok(a.rating>=1&&a.rating<=19);
});
test('The online and offline entry points load the rating before the magnifier UI',()=>{
 const root=require('node:path').dirname(require.resolve('../dist/pattern-lab/genetics.js'));
 const html=fs.readFileSync(root+'/index.html','utf8'),offline=fs.readFileSync(root+'/Pattern-Lab.html','utf8');
 assert.ok(html.indexOf('src="sumo-rating.js')<html.indexOf('src="trait-lens-ui.js'));
 assert.match(offline,/PatternSumoRating/);assert.doesNotMatch(offline,/<script defer src=/);
});

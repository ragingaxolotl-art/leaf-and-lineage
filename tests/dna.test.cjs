'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const G=require('../dist/pattern-lab/genetics.js'),D=require('../dist/pattern-lab/dna.js');
const sandbox={PatternGenetics:G};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/pattern-lab/beetles.js'),'utf8'),sandbox);const B=sandbox.PatternBeetles;
const art=b=>B.draw({...b,id:'snapshot'},'dna-test');
function checkedBytes(code,edit){const parts=code.split('.'),bytes=Buffer.from(parts[1],'base64url');edit(bytes);let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return parts[0]+'.'+bytes.toString('base64url')+'.'+((crc^0xffffffff)>>>0).toString(16).padStart(8,'0');}
test('Full-precision DNA recreates all 113 paired loci, phenotype, seed and every SVG marking across populations',()=>{
 for(const seed of [1,42,98765,2147483647])for(const b of Object.values(G.createState(seed).beetles)){
  const before=G.clone(b),code=D.encode(b),copy=D.decode(code).beetle;
  assert.equal(code.length,2500);assert.equal(code.length,D.codeLength);assert.equal(D.byteLength,1863);
  assert.deepEqual(copy.genome,b.genome);assert.equal(copy.developmentSeed,b.developmentSeed);assert.deepEqual(G.phenotype(copy),G.phenotype(b));assert.equal(art(copy),art(b));assert.equal(D.encode(copy),code);assert.deepEqual(b,before);
 }
});
test('Every shape, pattern layer and distribution extreme survives, including hidden alleles and uint32 seed boundaries',()=>{
 for(const shape of ['spot','mottle','stripe','speckle'])for(const layers of [0,1,2])for(const seed of [0,4294967295]){
  const b=G.createState().beetles.B3;b.developmentSeed=seed;G.setCopies(b,'shape',{value:shape,expression:.9876543210123456},{value:'mottle',expression:.1234567890123456});
  G.setCopies(b,'plain',{value:layers===0?'S':'s',expression:.5},{value:'s',expression:.5});G.setCopies(b,'layers',{value:layers===1?'T':'t',expression:.5});
  for(const key of ['frontBias','edgeBias','cluster','density','radius','softness','symmetry','jitter','patternStretch','secondaryDensity','secondarySize','secondaryBias']){const l=G.byKey[key];G.setCopies(b,key,l.min,l.max);}
  const copy=D.decode(D.encode(b)).beetle;assert.deepEqual(copy.genome,b.genome);assert.equal(art(copy),art(b));assert.equal(G.phenotype(copy).visibleLayers,layers);
 }
});
test('All legal numeric bounds, categories, colors and expression bounds have lossless encodings',()=>{
 for(const high of [false,true]){
  const b=G.createState().beetles.B1;
  for(const c of G.chromosomes)for(const l of c.loci){const a=l.type==='number'?(high?l.max:l.min):l.type==='category'?{value:l.values[high?l.values.length-1:0],expression:high?1:0}:{rgb:high?[255,255,255]:[0,0,0],expression:high?1:0};G.setCopies(b,l.key,a);}
  const copy=D.decode(D.encode(b)).beetle;assert.deepEqual(copy.genome,b.genome);assert.equal(art(copy),art(b));
 }
});
test('DNA stays independent of names, IDs, family metadata, JSON property order and learned tank memories',()=>{
 const b=G.createState().beetles.B3,code=D.encode(b);const renamed={...G.clone(b),id:'Different-device',name:'Named beetle',parents:['ExternalA','ExternalB'],lineageGeneration:55,provenance:{sourceId:'Other'},memories:{visits:50}};
 assert.equal(D.encode(renamed),code);const reordered=G.clone(b);for(const c of reordered.genome)for(const copy of c.copies)for(let i=0;i<copy.length;i++)if(typeof copy[i]==='object')copy[i]=Object.fromEntries(Object.entries(copy[i]).reverse());assert.equal(D.encode(reordered),code);
 const decoded=D.decode(code).beetle;assert.equal(decoded.name,'');assert.deepEqual(decoded.parents,[]);assert.equal(decoded.lineageGeneration,0);assert.equal(decoded.provenance,undefined);assert.equal(decoded.memories,undefined);
});
test('A separate browser module decodes the same DNA without Buffer, storage, network or randomness',()=>{
 const b=G.createState(77).beetles.B9,context={PatternGenetics:G,btoa,atob};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/pattern-lab/dna.js'),'utf8'),context);const copy=context.PatternDNA.decode(D.encode(b)).beetle;assert.deepEqual(copy.genome,b.genome);assert.equal(art(copy),art(b));assert.equal(context.PatternDNA.encode(copy),D.encode(b));
});
test('Copied DNA tolerates wrapping but rejects truncation, edits, wrong versions, trailing bytes and invalid genes',()=>{
 const code=D.encode(G.createState().beetles.B1);assert.equal(D.encode(D.decode(' \n'+code.match(/.{1,70}/g).join('\n')+'\t').beetle),code);
 for(const broken of ['',null,3,code.slice(0,-1),code+'x',code+'.extra',code.replace('PLDNA1','PLDNA2'),code.replace('PLDNA1','PL1'),code.slice(0,40)+'!'+code.slice(41),code.slice(0,40)+(code[40]==='a'?'b':'a')+code.slice(41),'x'.repeat(32769)])assert.throws(()=>D.decode(broken));
 assert.throws(()=>D.decode(checkedBytes(code,b=>b[0]=2)),/appearance model/);
 assert.throws(()=>D.decode(checkedBytes(code,b=>b.writeDoubleLE(NaN,8))),/invalid gene/);
 assert.throws(()=>D.decode(checkedBytes(code,b=>b.writeDoubleLE(1.1,8))),/invalid gene/);
 assert.throws(()=>D.decode(checkedBytes(code,b=>b[16]=255)),/invalid gene/);
 assert.throws(()=>D.encode({...G.createState().beetles.B1,appearanceVersion:2}),/appearance version/);
});
test('Imports receive distinct IDs without changing originals, preserve DNA after save, overflow safely and breed identically',()=>{
 const s=G.createState(97),b=s.beetles.B3,original=G.clone(b),packet=D.decode(D.encode(b));const copy=G.importPacket(s,packet),copy2=G.importPacket(s,packet);
 assert.notEqual(copy.id,b.id);assert.notEqual(copy.id,copy2.id);assert.deepEqual(s.beetles.B3,original);assert.equal(D.encode(copy),D.encode(b));assert.equal(art(copy),art(b));assert.equal(D.encode(G.validate(G.clone(s)).beetles[copy.id]),D.encode(b));
 const other=s.beetles.B4,a=G.baby(b,other,'X',{jarId:'jar-1',broodId:'brood-1',rng:G.seeded(17),rate:.03}),c=G.baby(copy,other,'Y',{jarId:'jar-1',broodId:'brood-1',rng:G.seeded(17),rate:.03});assert.deepEqual(a.genome,c.genome);assert.equal(a.developmentSeed,c.developmentSeed);
 while(s.tank.length<48)G.importPacket(s,packet);const overflow=G.importPacket(s,packet);assert.ok(s.nursery.includes(overflow.id));assert.equal(s.tank.length,48);G.validate(s);
 const before=G.clone(s);assert.throws(()=>D.decode('PLDNA1.invalid'));assert.deepEqual(s,before);
});
test('Legacy packets get neutral missing chromosomes without changing their existing phenotype or markings',()=>{
 const b=G.createState().beetles.B6;for(const count of [7,8,9,10]){const legacy=G.clone(b);legacy.genome=legacy.genome.slice(0,count);const expected=G.validatePacket({format:'PatternLabBeetle',version:2,beetle:legacy}).beetle,copy=D.decode(D.encode(legacy)).beetle;assert.deepEqual(copy.genome,expected.genome);assert.equal(art(copy),art(expected));}
});
test('DNA UI import saves before replacing the live tank and leaves the tank intact when persistence fails',async()=>{
 const source=fs.readFileSync(require.resolve('../dist/pattern-lab/app.js'),'utf8'),callback=source.match(/addDNABeetle:(async packet=>\{[\s\S]*?\}),getSelected:/)[1];
 const s=G.createState(),before=G.clone(s),packet=D.decode(D.encode(s.beetles.B3));let renders=0,saves=0;
 const c=vm.createContext({state:s,G,blocked:false,awaitPersistence:async()=>{},noPending:()=>{},specimenCheckpoint:(next,kind,id,reason)=>({kind,id,reason}),checkpoint:async()=>{throw Error('Storage full');},render:()=>renders++});vm.runInContext('handler='+callback,c);
 await assert.rejects(c.handler(packet),/Storage full/);assert.deepEqual(c.state,before);assert.equal(renders,0);
 c.checkpoint=async(next,snapshot)=>{saves++;assert.equal(c.state,s);assert.equal(Object.keys(next.beetles).length,17);assert.equal(snapshot.kind,'collected');};
 const b=await c.handler(packet);assert.equal(saves,1);assert.equal(renders,1);assert.equal(c.state.beetles[b.id],b);assert.deepEqual(s,before);assert.equal(D.encode(b),D.encode(s.beetles.B3));
});
test('V1 renderer and phenotype golden output protects old DNA from silent appearance changes',()=>{
 const hashes=[];for(const shape of ['spot','mottle','stripe','speckle']){const b=G.createState(321).beetles.B3;G.setCopies(b,'shape',{value:shape,expression:1});G.setCopies(b,'plain',{value:'s',expression:.5});G.setCopies(b,'layers',{value:'t',expression:.5});hashes.push(crypto.createHash('sha256').update(art(D.decode(D.encode(b)).beetle)).digest('hex'));}
 assert.deepEqual(hashes,["50facfa52a47ed6c2a78c196025071105105cb244ce18269e7cc045b7077165f","c9f23833022e389f2f6ef180d215f216bea304d7d32accda22c9db6db7bbbf17","c7d7a04b463b12274fc4dfc75281b3dfa71cc31420e962397690dfae3b0da35a","c4b2af1609334d35ff62a396b054d4235bbcdc9790cfcba07cf9567358b9a044"]);
});

(function(root,factory){
'use strict';
const api=factory(typeof module==='object'&&module.exports?require('./genetics.js'):root.PatternGenetics);
if(typeof module==='object'&&module.exports)module.exports=api;else root.PatternDNA=api;
})(globalThis,function(G){
'use strict';
// PLDNA1 is a permanent wire format. Never reorder these chromosomes or loci.
// Float64 little-endian preserves every stored gene and expression value exactly.
// Model 1 means the current phenotype rules AND the seeded V1 beetle renderer.
// Future visual/genetic models must retain this route or reject it explicitly.
const schema=[["A",[["body","color",null],["plain","category",["S","s"]],["density","number",null],["radius","number",null],["softness","number",null],["symmetry","number",null],["jitter","number",null],["bodyWidth","number",null]]],["B",[["primary","color",null],["layers","category",["T","t"]],["shape","category",["spot","mottle","stripe","speckle"]],["frontBias","number",null],["edgeBias","number",null],["cluster","number",null],["patternStretch","number",null]]],["C",[["secondary","color",null],["secondaryDensity","number",null],["secondarySize","number",null],["secondaryBias","number",null],["appendageShade","number",null],["banding","number",null]]],["D",[["antenna","category",["thread","bead","bristle","club","knob","saw","comb","doublecomb","fan","plates","elbow","plume","aristate"]],["antennaLength","number",null],["shaftWidth","number",null],["segments","number",null],["beadRoundness","number",null],["curve","number",null],["elbow","number",null],["tip","number",null],["branches","number",null],["branchLength","number",null],["plateWidth","number",null],["hairGate","category",["H","h"]],["hairDensity","number",null],["hairLength","number",null],["spread","number",null]]],["E",[["leg","category",["runner","sturdy","shovel","jumper","paddle","hooked","spiny","longfoot"]],["legLength","number",null],["femur","number",null],["tibia","number",null],["foot","number",null],["joint","number",null],["legSpread","number",null],["claw","number",null],["spines","number",null],["legHair","number",null],["hind","number",null],["motor","number",null],["stride","number",null],["strength","number",null]]],["F",[["tracking","number",null],["reaction","number",null],["focus","number",null],["pushDrive","number",null],["wander","number",null],["turnRate","number",null],["tactics","number",null],["edgeSense","number",null],["brace","number",null],["lateralBalance","number",null],["grip","number",null],["endurance","number",null],["recovery","number",null],["mass","number",null],["acceleration","number",null],["centerDrive","number",null],["curiosity","number",null],["sociality","number",null],["caution","number",null],["persistence","number",null]]],["G",[["bodyLength","number",null],["headWidth","number",null],["horn","number",null],["jaw","number",null],["gloss","number",null],["metallic","number",null],["ridges","number",null],["ridgeHeight","number",null],["pronotum","number",null],["gait","number",null]]],["H",[["bodyGrowth","number",null],["antennaGrowth","number",null],["legGrowth","number",null],["hornGrowth","number",null],["headGrowth","number",null],["jawGrowth","number",null],["hornCount","category",["single","double","triple"]],["hornShape","category",["spike","curved","forked"]]]],["I",[["legColor","color",null],["thoraxColor","color",null]]],["J",[["jumpGate","category",["N","n"]],["puffGate","category",["N","n"]],["liftPower","number",null],["liftReach","number",null],["liftControl","number",null],["liftEfficiency","number",null],["liftRecovery","number",null],["liftInstinct","number",null],["jumpPower","number",null],["jumpReach","number",null],["jumpControl","number",null],["jumpEfficiency","number",null],["jumpRecovery","number",null],["jumpInstinct","number",null],["puffPower","number",null],["puffReach","number",null],["puffControl","number",null],["puffEfficiency","number",null],["puffRecovery","number",null],["puffInstinct","number",null]]],["K",[["appetite","number",null],["thirstDrive","number",null],["heatPreference","number",null]]]];
const version=1,modelVersion=1,prefix='PLDNA1';
const byteLength=5+schema.reduce((sum,[,loci])=>sum+2*loci.reduce((n,[,type])=>n+(type==='number'?8:type==='color'?11:9),0),0);
const codeLength=prefix.length+2+Math.ceil(byteLength*4/3)+8;
function assertSchema(){
 const current=G.chromosomes.map(c=>[c.id,c.loci.map(l=>[l.key,l.type,l.values||null])]);
 if(JSON.stringify(current)!==JSON.stringify(schema))throw Error('This DNA version needs its original genetics model. Open a compatible Pattern Lab version.');
}
function checksum(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return ((crc^0xffffffff)>>>0).toString(16).padStart(8,'0');}
function base64(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function encode(beetle){
 assertSchema();
 if((beetle.appearanceVersion??1)!==modelVersion)throw Error('This beetle uses an unsupported appearance version.');
 const b=G.validatePacket({format:'PatternLabBeetle',version:4,beetle}).beetle;
 const bytes=new Uint8Array(byteLength),view=new DataView(bytes.buffer);let at=0;
 view.setUint8(at++,modelVersion);view.setUint32(at,b.developmentSeed,true);at+=4;
 function number(n){view.setFloat64(at,n,true);at+=8;}
 for(const [ci,[,loci]] of schema.entries())for(const copy of b.genome[ci].copies)for(const [li,[,type,values]] of loci.entries()){
  const a=copy[li];
  if(type==='number')number(a);
  else {if(type==='color')for(const channel of a.rgb)view.setUint8(at++,channel);else view.setUint8(at++,values.indexOf(a.value));number(a.expression);}
 }
 return prefix+'.'+base64(bytes)+'.'+checksum(bytes);
}
function decode(input){
 assertSchema();
 if(typeof input!=='string'||input.length>32768)throw Error('Paste one complete beetle DNA string.');
 const code=input.replace(/\s/g,''),parts=code.split('.');
 if(parts[0]!==prefix)throw Error(/^PLDNA\d+/.test(parts[0])?'This DNA version is not supported. Open a compatible Pattern Lab version.':'Beetle DNA starts with PLDNA1. Copy the complete DNA string.');
 if(parts.length!==3||code.length!==codeLength||!/^[-_A-Za-z0-9]+$/.test(parts[1])||!/^[a-f0-9]{8}$/.test(parts[2]))throw Error('This DNA is incomplete or damaged. Copy the full string again.');
 let bytes;try{bytes=Uint8Array.from(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{throw Error('This DNA is incomplete or damaged. Copy the full string again.');}
 if(bytes.length!==byteLength||base64(bytes)!==parts[1]||checksum(bytes)!==parts[2])throw Error('This DNA is incomplete or damaged. Copy the full string again.');
 const view=new DataView(bytes.buffer);let at=0;
 const appearanceVersion=view.getUint8(at++),developmentSeed=view.getUint32(at,true);at+=4;
 if(appearanceVersion!==modelVersion)throw Error('This DNA uses an unsupported appearance model. Open a compatible Pattern Lab version.');
 function number(){const n=view.getFloat64(at,true);at+=8;return n;}
 const genome=schema.map(([id,loci])=>({id,copies:[0,1].map(()=>loci.map(([,type,values])=>{
  if(type==='number')return number();
  if(type==='color'){const rgb=[view.getUint8(at++),view.getUint8(at++),view.getUint8(at++)];return {rgb,expression:number()};}
  return {value:values[view.getUint8(at++)],expression:number()};
 }))}));
 try{return G.validatePacket({format:'PatternLabBeetle',version:4,beetle:{id:'DNA',name:'',parents:[],sourceJarId:null,broodId:null,lineageGeneration:0,mutations:[],developmentSeed,appearanceVersion,genome}});}catch{throw Error('This DNA contains invalid gene values. Copy a valid beetle DNA string.');}
}
return {version,modelVersion,encode,decode,byteLength,codeLength};
});

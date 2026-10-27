/* Tank scenery and learned places. Deliberately separate from inherited beetles. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PatternHabitat=api;})(globalThis,function(){
'use strict';
const kinds=['leaf','bark','stone'],names={leaf:'Leaf canopy',bark:'Bark tunnel',stone:'Smooth stone'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function objects(){return [{id:'leaf-1',kind:'leaf',x:.25,y:.29,angle:-22},{id:'bark-1',kind:'bark',x:.46,y:.58,angle:24},{id:'stone-1',kind:'stone',x:.63,y:.32,angle:-12}];}
function create(){return {tank:{objects:objects(),memories:{}},keep:{objects:objects(),memories:{}}};}
function ensure(s){if(s.habitat===undefined)s.habitat=create();return s.habitat;}
function validate(s){
 const h=ensure(s);if(!h||typeof h!=='object'||Array.isArray(h))throw Error('Invalid habitat.');
 for(const k of ['tank','keep']){const t=h[k];if(!t||!Array.isArray(t.objects)||t.objects.length>12||!t.memories||typeof t.memories!=='object'||Array.isArray(t.memories)||Object.keys(t.memories).length>3000)throw Error('Invalid tank habitat.');
  const ids=new Set();for(const o of t.objects){if(!o||typeof o.id!=='string'||!/^[a-z]+-[a-z0-9]+$/.test(o.id)||ids.has(o.id)||!kinds.includes(o.kind)||!Number.isFinite(o.x)||o.x<.08||o.x>.92||!Number.isFinite(o.y)||o.y<.1||o.y>.9||!Number.isFinite(o.angle)||Math.abs(o.angle)>360)throw Error('Invalid habitat object.');ids.add(o.id);}
  for(const [id,m] of Object.entries(t.memories)){if(!Object.hasOwn(s.beetles,id)||!m||!Number.isFinite(m.x)||m.x<0||m.x>1||!Number.isFinite(m.y)||m.y<0||m.y>1||!Number.isInteger(m.visits)||m.visits<1||m.visits>1000000||!Number.isFinite(m.comfort)||m.comfort<0||m.comfort>1||m.objectId!==null&&(typeof m.objectId!=='string'||!/^[a-z]+-[a-z0-9]+$/.test(m.objectId)))throw Error('Invalid favorite spot.');}
 }return h;
}
function prune(s){const h=ensure(s);for(const k of ['tank','keep'])for(const id of Object.keys(h[k].memories))if(!s.beetles[id])delete h[k].memories[id];}
function shape(o,width,height){const base=Math.min(width,height),scale=o.kind==='leaf'?[.135,.067]:o.kind==='bark'?[.14,.064]:[.085,.065];return {x:o.x*width,y:o.y*height,rx:base*scale[0],ry:base*scale[1],angle:o.angle*Math.PI/180};}
function add(t,kind){if(!kinds.includes(kind))throw Error('Choose a habitat object.');if(t.objects.length>=12)throw Error('This tank has room for 12 habitat objects.');let n=1;while(t.objects.some(o=>o.id===kind+'-'+n))n++;const i=t.objects.length,o={id:kind+'-'+n,kind,x:clamp(.25+(i%3)*.22,.08,.92),y:clamp(.26+(Math.floor(i/3)%3)*.22,.1,.9),angle:0};t.objects.push(o);return o;}
return {create,ensure,validate,prune,shape,add,names,kinds,clamp};
});

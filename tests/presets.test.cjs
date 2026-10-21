'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,encode,decode,permits}=require('../dist/presets.js');
test('class codes round-trip every preset, preserving zero and false settings',()=>{
  for(const mode of ['natural','breeding']) for(const scenario of ['mixed','blue','warm']) for(const rows of [1,6]) for(const allowEnvironment of [true,false]) {
    const preset={...defaults,allowEnvironment,seed:1234567,rows,habitat:'#ABCDEF',pressure:0,mutation:0,bird:false,speed:.5,mode,scenario};
    const code=encode(preset);
    assert.ok(/^LL2\.[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(code));
    assert.deepEqual(decode(code),{...preset,habitat:'#abcdef'});
    assert.equal(encode(decode(code)),code);
    assert.deepEqual(decode('https://example.org/lab/#lab='+code),decode(code));
  }
});
test('incomplete and changed codes are rejected instead of silently applying defaults',()=>{
  const code=encode(defaults);
  for(const bad of ['', 'LL1.',code.slice(0,-1),code+'x',code.replace('LL2.','LL3.'),'x'.repeat(401),'https://example.org/']) assert.throws(()=>decode(bad));
});
test('all starting conditions are strictly validated',()=>{
  for(const [key,value] of [['seed',0],['seed',2.5],['rows',0],['rows',7],['habitat','<script>'],['pressure',101],['pressure',-1],['mutation',21],['mutation',3.2],['mode','other'],['bird',1],['speed',3],['scenario','other'],['activities','other'],['allowEnvironment',1]]) assert.throws(()=>validate({...defaults,[key]:value}),`${key}=${value}`);
  assert.throws(()=>validate(null));
  assert.deepEqual(decode(encode(defaults)),defaults);
});

test('activity permissions round-trip and single modes require a consistent start',()=>{
  for(const activities of ['bird','breeding','both']){
    const preset={...defaults,activities,mode:activities==='breeding'?'breeding':'natural',allowEnvironment:true};
    const decoded=decode(encode(preset));
    assert.deepEqual(decoded,preset);
    assert.equal(permits(decoded,'bird'),activities!=='breeding');
    assert.equal(permits(decoded,'breeding'),activities!=='bird');
  }
  assert.throws(()=>validate({...defaults,activities:'breeding',mode:'natural'}));
  assert.throws(()=>validate({...defaults,activities:'bird',mode:'breeding'}));
});
test('previously shared LL1 codes still open with both activities and a fixed environment',()=>{
  const preset=decode('LL1.WzQyLDEsIiM4ZmE5NjciLDgwLDMsMSwxLDEsIndhcm0iXQ.lkz6bs');
  assert.deepEqual(preset,{...defaults,rows:1,mode:'breeding',scenario:'warm'});
  assert.deepEqual(decode(encode(preset)),preset);
});

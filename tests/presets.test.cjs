'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,encode,decode}=require('../dist/presets.js');
test('class codes round-trip every preset, preserving zero and false settings',()=>{
  for(const mode of ['natural','breeding']) for(const scenario of ['mixed','blue','warm']) for(const rows of [1,6]) {
    const preset={...defaults,seed:1234567,rows,habitat:'#ABCDEF',pressure:0,mutation:0,bird:false,speed:.5,mode,scenario};
    const code=encode(preset);
    assert.ok(/^LL1\.[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(code));
    assert.deepEqual(decode(code),{...preset,habitat:'#abcdef'});
    assert.equal(encode(decode(code)),code);
    assert.deepEqual(decode('https://example.org/lab/#lab='+code),decode(code));
  }
});
test('incomplete and changed codes are rejected instead of silently applying defaults',()=>{
  const code=encode(defaults);
  for(const bad of ['', 'LL1.',code.slice(0,-1),code+'x',code.replace('LL1.','LL2.'),'x'.repeat(401),'https://example.org/']) assert.throws(()=>decode(bad));
});
test('all starting conditions are strictly validated',()=>{
  for(const [key,value] of [['seed',0],['seed',2.5],['rows',0],['rows',7],['habitat','<script>'],['pressure',101],['pressure',-1],['mutation',21],['mutation',3.2],['mode','other'],['bird',1],['speed',3],['scenario','other']]) assert.throws(()=>validate({...defaults,[key]:value}),`${key}=${value}`);
  assert.throws(()=>validate(null));
  assert.deepEqual(decode(encode(defaults)),defaults);
});

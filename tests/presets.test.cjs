'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validate,encode,decode,permits,release,studentLink}=require('../dist/presets.js');
test('class codes round-trip every preset, preserving zero and false settings',()=>{
  for(const mode of ['natural','breeding']) for(const scenario of ['mixed','blue','warm']) for(const rows of [1,6]) for(const allowEnvironment of [true,false]) for(const showStats of [true,false]) {
    const preset={...defaults,allowEnvironment,showStats,seed:1234567,rows,habitat:'#ABCDEF',pressure:0,mutation:0,bird:false,speed:.5,mode,scenario};
    const code=encode(preset);
    assert.ok(/^LL4\.[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(code));
    assert.deepEqual(decode(code),{...preset,habitat:'#abcdef'});
    assert.equal(encode(decode(code)),code);
    assert.deepEqual(decode('https://example.org/lab/#lab='+code),decode(code));
  }
});
test('incomplete and changed codes are rejected instead of silently applying defaults',()=>{
  const code=encode(defaults);
  for(const bad of ['', 'LL1.',code.slice(0,-1),code+'x',code.replace('LL4.','LL5.'),'x'.repeat(401),'https://example.org/']) assert.throws(()=>decode(bad));
});
test('all starting conditions are strictly validated',()=>{
  for(const [key,value] of [['seed',0],['seed',2.5],['rows',0],['rows',7],['habitat','<script>'],['pressure',101],['pressure',-1],['mutation',21],['mutation',3.2],['mode','other'],['bird',1],['speed',3],['scenario','other'],['activities','other'],['allowEnvironment',1],['showStats',1],['layout','other'],['habitats',[]],['habitats',['#000000','#ffffff','wrong']]]) assert.throws(()=>validate({...defaults,[key]:value}),`${key}=${value}`);
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

test('LL2 links retain environment and activity permissions with stats hidden',()=>{
  const preset=decode('LL2.WzQyLDEsIiM4ZmE5NjciLDgwLDAsMSwxLDEsIndhcm0iLDIsMV0.1a1idks');
  assert.deepEqual(preset,{...defaults,rows:1,mutation:0,mode:'breeding',scenario:'warm',allowEnvironment:true,showStats:false});
});
test('showing full stats does not broaden activities or environment permissions',()=>{
  for(const activities of ['bird','breeding','both']) for(const allowEnvironment of [true,false]){
    const p={...defaults,activities,mode:activities==='breeding'?'breeding':'natural',allowEnvironment};
    const basic=decode(encode(p)),full=decode(encode({...p,showStats:true}));
    assert.deepEqual(full,{...basic,showStats:true});
    assert.equal(permits(full,'bird'),permits(basic,'bird'));
    assert.equal(permits(full,'breeding'),permits(basic,'breeding'));
  }
});

test('Neapolitan codes preserve all three colors, layout, stats and permissions',()=>{
  for(const showStats of [true,false]){
    const p={...defaults,showStats,layout:'neapolitan',habitats:['#ABCDEF','#123456','#fedcba']};
    assert.deepEqual(decode(encode(p)),{...p,habitats:['#abcdef','#123456','#fedcba']});
  }
});
test('existing LL3 full-statistics links retain full stats and a solid environment',()=>{
  const p=decode('LL3.WzQyLDEsIiM4ZmE5NjciLDgwLDMsMSwxLDEsIm1peGVkIiwyLDEsMV0.116qtwy');
  assert.equal(p.showStats,true);assert.equal(p.allowEnvironment,true);assert.equal(p.layout,'solid');
  assert.deepEqual(p.habitats,defaults.habitats);
});

test('out-of-range mutation identifies the field and its allowed range',()=>{
  for(const mutation of [-1,21,30,3.2]) assert.throws(()=>encode({...defaults,mutation}),/Mutation per gene copy must be a whole number from 0 to 20%/);
  for(const mutation of [0,20]) assert.equal(decode(encode({...defaults,mutation})).mutation,mutation);
});

test('the reported four-row classroom code is valid and preserves every setting',()=>{
  const code='LL4.WzQyLDQsIiM4ZmE5NjciLDgwLDIwLDAsMSw0LCJtaXhlZCIsMCwxLDEsMCxbIiM4ZmE5NjciLCIjYjE3YjU2IiwiIzc3ODVhMSJdXQ.51jcgp';
  const preset={...defaults,rows:4,mutation:20,speed:4,activities:'bird',allowEnvironment:true,showStats:true};
  assert.deepEqual(decode(code),preset);
  assert.equal(encode(preset),code);
});
test('student links request the current release and preserve the complete preset',()=>{
  const p={...defaults,rows:4,mutation:20,speed:4,activities:'bird',allowEnvironment:true,showStats:true};
  for(const href of ['https://ragingaxolotl-art.github.io/leaf-and-lineage/?teacher=1&refresh=old#lab=old','http://127.0.0.1:8000/?teacher=1','file:///tmp/Leaf-and-Lineage.html?teacher=1']){
    const url=new URL(studentLink(p,href));
    assert.equal(url.origin,new URL(href).origin);
    assert.equal(url.pathname,new URL(href).pathname);
    assert.deepEqual(Array.from(url.searchParams.entries()),[['v',release]]);
    assert.equal(url.hash,'#lab='+encode(p));
    assert.deepEqual(decode(new URLSearchParams(url.hash.slice(1)).get('lab')),p);
  }
});
test('a newer class-code version gets a version message, while corrupted codes remain rejected',()=>{
  const code=encode(defaults);
  assert.throws(()=>decode(code.replace('LL4.','LL5.')),/newer version/);
  assert.throws(()=>decode(code+'x'),/incomplete or mistyped/);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.join(__dirname,'../dist/simplified');
test('Simplified v1 is an intact frozen snapshot with an offline game',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'version.json'),'utf8'));
 assert.equal(manifest.edition,'Simplified');assert.equal(manifest.frozen,true);
 for(const [file,hash] of Object.entries(manifest.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex'),hash,file);
 assert.match(fs.readFileSync(path.join(dir,'index.html'),'utf8'),/THE BEETLE EVOLUTION LAB · SIMPLIFIED/);
 const offline=fs.readFileSync(path.join(dir,'Leaf-and-Lineage-Simplified.html'),'utf8');assert.doesNotMatch(offline,/<script src=/);assert.match(offline,/class Lab/);
});
test('Simplified classroom links stay on its own route and preserve old codes',()=>{
 const P=require('../dist/simplified/presets.js');const link=P.studentLink(P.defaults,'https://ragingaxolotl-art.github.io/leaf-and-lineage/simplified/?teacher=1');
 assert.equal(new URL(link).pathname,'/leaf-and-lineage/simplified/');assert.deepEqual(P.decode(link),P.defaults);
 const old='LL4.WzQyLDQsIiM4ZmE5NjciLDgwLDIwLDAsMSw0LCJtaXhlZCIsMCwxLDEsMCxbIiM4ZmE5NjciLCIjYjE3YjU2IiwiIzc3ODVhMSJdXQ.51jcgp';assert.equal(P.decode(old).rows,4);
});

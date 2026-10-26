(function(root){
'use strict';
const SHARED_SPEED=10,SHARED_MODEL='SUMO9X10';
function sharedModel(speed=10){if(![2,10].includes(Number(speed)))throw Error('Choose 2× or 10× for a shared match.');return Number(speed)===2?'SUMO9X2':'SUMO9X10';}
function sharedSpeed(room){return room?.physicsVersion==='SUMO9X2'?2:10;}
function supportedRoom(room){return ['SUMO9X2','SUMO9X10'].includes(room?.physicsVersion);}
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
// A monotonic server-time estimate. Prefer short round trips over delayed replies.
function createClock({wallNow=()=>Date.now(),monoNow=()=>performance.now()}={}){
 let anchor={server:wallNow(),mono:monoNow()},best=null,last=-Infinity;
 return {
  sample(serverNow,sent,received){const server=Date.parse(serverNow),rtt=received-sent;if(!Number.isFinite(server)||!Number.isFinite(rtt)||rtt<0||rtt>15000)return false;
   if(best&&received-best.at<30000&&rtt>best.rtt)return false;
   anchor={server:server+rtt/2,mono:received};best={rtt,at:received};return true;
  },
  now(){const estimate=anchor.server+monoNow()-anchor.mono;last=Math.max(last,estimate);return last;}
 };
}
function acceptRoom(code,number,room){return !!room&&room.code===code&&Number.isInteger(room.matchNumber)&&room.matchNumber>=number;}
function targetTick(serverNow,startedAt,maxSeconds=60,speed=1){const start=Date.parse(startedAt);if(!Number.isFinite(serverNow)||!Number.isFinite(start))return 0;return Math.min(Math.floor(maxSeconds*60),Math.max(0,Math.floor((serverNow-start)*.06*speed+1e-7)));}
function victoryElapsed(serverNow,startedAt,seconds,speed=1){return Math.max(0,serverNow-Date.parse(startedAt)-seconds*1000/speed);}
function confetti(seed,winner){if(![0,1].includes(winner))return [];const r=G.seeded((seed^0x519cb71)>>>0),colors=winner?['#89bdf2','#f5d377','#ecf2d5','#e5a4d3']:['#ed9c85','#f5d377','#ecf2d5','#a6c89b'];return Array.from({length:48},()=>({left:Math.round(r()*1000)/10,drift:Math.round((r()-.5)*230),turn:Math.round((r()-.5)*1400),delay:Math.round(r()*850),duration:Math.round(2300+r()*2300),color:colors[Math.floor(r()*colors.length)],round:r()<.3}));}
const api={sharedModel,sharedSpeed,supportedRoom,SHARED_SPEED,SHARED_MODEL,acceptRoom,createClock,targetTick,victoryElapsed,confetti};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternSumoStage=api;
})(typeof globalThis!=='undefined'?globalThis:this);

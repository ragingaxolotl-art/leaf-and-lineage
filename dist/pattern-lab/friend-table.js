/* Friend-table form state; does not create rooms or change battle physics. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PatternFriendTable=api;})(globalThis,function(){
'use strict';
function code(value){return String(value||'').toUpperCase().replace(/[\s-]/g,'');}
function ready(value){return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code(value));}
function state({value='',hasBeetle=false,connected=false,busy=false,blocked=false}={}){const locked=connected||busy||blocked;return {joinDisabled:locked||!hasBeetle||!ready(value),createDisabled:locked||!hasBeetle,selectionDisabled:locked,inputDisabled:connected||busy,emphasize:!locked&&hasBeetle&&ready(value)};}
return {code,ready,state};
});

'use strict';
const crypto=require('crypto');
const seen=new Map();
const WIN=10*60*1000;
function isDup(a){const fp=crypto.createHash('sha256').update(JSON.stringify({s:a.serviceId,e:a.errorCode,sv:a.severity})).digest('hex').slice(0,16);const now=Date.now();const e=seen.get(fp);if(e&&now-e.t<WIN){e.n++;return true;}seen.set(fp,{t:now,n:1});return false;}
module.exports={isDup};

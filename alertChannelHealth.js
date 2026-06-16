'use strict';
// RD-17: Channel health circuit breaker
const stats=new Map();
function record(id,ok){const s=stats.get(id)||{ok:0,fail:0,disabled:false};ok?s.ok++:s.fail++;if((s.fail/(s.ok+s.fail))>0.5)s.disabled=true;stats.set(id,s);}
function isHealthy(id){return!(stats.get(id)||{}).disabled;}
function reset(id){stats.delete(id);}
module.exports={record,isHealthy,reset};

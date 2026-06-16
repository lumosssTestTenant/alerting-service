'use strict';
const {v4:uuidv4}=require('uuid');
const log=[];
const EVENTS=Object.freeze({RECEIVED:'alert.received',THROTTLED:'alert.throttled',DELIVERED:'alert.delivered',FAILED:'alert.failed',RESOLVED:'alert.resolved'});
function record(type,alertId,data={}){const e=Object.freeze({id:uuidv4(),type,alertId,ts:new Date().toISOString(),...data});log.push(e);return e;}
function query(alertId){return log.filter(e=>e.alertId===alertId);}
function recent(n=50){return log.slice(-n);}
module.exports={record,query,recent,EVENTS};

'use strict';
const rules=[];
function addRule(r){rules.push(r);rules.sort((a,b)=>(b.priority||0)-(a.priority||0));}
function route(a){for(const r of rules){if(r.severity&&r.severity!==a.severity)continue;if(r.category&&r.category!==a.category)continue;return{team:r.team,channel:r.channel,rule:r.id};}return{team:'default-oncall',channel:'general-alerts',rule:'default'};}
addRule({id:'crit-pay',severity:'CRITICAL',category:'payment_failure',team:'payments-oncall',channel:'payments-critical',priority:100});
addRule({id:'sub-fail',category:'subscription_failure',team:'sre-oncall',channel:'sre-alerts',priority:80});
module.exports={addRule,route,rules};

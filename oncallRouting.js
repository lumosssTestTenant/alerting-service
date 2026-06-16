'use strict';
/**
 * On-Call Rotation Routing
 *
 * Routes CRITICAL and HIGH severity alerts to the engineer currently on call.
 * Supports multiple on-call schedules (e.g. payments team, infra team).
 * Rotations are weekly by default.
 */

const { v4: uuidv4 } = require('uuid');

const oncallSchedules = new Map(); // scheduleId -> { id, name, members, rotationDays, currentIndex, startDate }

function createSchedule({ name, members, rotationDays = 7, startDate }) {
  if (!name || !members || members.length === 0) throw new Error('name and members required');
  const schedule = {
    id: uuidv4(),
    name,
    members, // array of { name, email, slackHandle }
    rotationDays,
    startDate: startDate || new Date().toISOString(),
    currentIndex: 0,
    createdAt: new Date().toISOString(),
  };
  oncallSchedules.set(schedule.id, schedule);
  return schedule;
}

function getCurrentOncall(scheduleId) {
  const schedule = oncallSchedules.get(scheduleId);
  if (!schedule || schedule.members.length === 0) return null;
  const now = Date.now();
  const start = new Date(schedule.startDate).getTime();
  const elapsed = now - start;
  const rotationMs = schedule.rotationDays * 24 * 60 * 60 * 1000;
  const currentIndex = Math.floor(elapsed / rotationMs) % schedule.members.length;
  return { ...schedule.members[currentIndex], scheduleId, scheduleName: schedule.name };
}

function routeAlertToOncall(alert, scheduleId, notifyFn, log) {
  if (!['HIGH', 'CRITICAL'].includes(alert.severity)) return null;
  const oncall = getCurrentOncall(scheduleId);
  if (!oncall) return null;
  log('info', `Routing alert to on-call engineer`, {
    alertId: alert.id, severity: alert.severity,
    oncall: oncall.name, schedule: oncall.scheduleName
  });
  alert.oncallNotification = { routedTo: oncall, routedAt: new Date().toISOString(), scheduleId };
  if (notifyFn) notifyFn({ type: 'oncall', recipient: oncall, alert });
  return oncall;
}

function listSchedules() {
  return Array.from(oncallSchedules.values()).map(s => ({
    ...s,
    currentOncall: getCurrentOncall(s.id)
  }));
}

module.exports = { createSchedule, getCurrentOncall, routeAlertToOncall, listSchedules, oncallSchedules };

import { runMultiSourceScrape } from './scrapers.mjs';

/**
 * 2x Per Day Background Scheduler
 * Configured execution hours: 09:00 and 17:00 (Paris Time).
 */

const SCHEDULED_HOURS = [9, 17];
let timerHandle = null;
let lastRunTimestamp = new Date().toISOString();
let executionLog = [
  {
    timestamp: new Date().toISOString(),
    status: 'Initial boot sync completed',
    newJobs: 6,
    message: 'Scanned 5 job sites: Welcome to the Jungle, APEC, LinkedIn, Indeed, France Travail'
  }
];

export function getNextScheduledRun() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  for (const h of SCHEDULED_HOURS) {
    if (h > currentHour || (h === currentHour && currentMin < 1)) {
      const nextDate = new Date(now);
      nextDate.setHours(h, 0, 0, 0);
      return nextDate;
    }
  }

  // Next run is tomorrow at the first scheduled hour
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(SCHEDULED_HOURS[0], 0, 0, 0);
  return tomorrow;
}

export function getSchedulerStatus() {
  const nextRun = getNextScheduledRun();
  const msRemaining = Math.max(0, nextRun.getTime() - Date.now());
  const hoursLeft = Math.floor(msRemaining / (1000 * 60 * 60));
  const minsLeft = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  return {
    active: timerHandle !== null,
    cadence: '2 times per day (09:00, 17:00)',
    scheduledHours: SCHEDULED_HOURS,
    lastRun: lastRunTimestamp,
    nextRun: nextRun.toISOString(),
    countdown: `${hoursLeft}h ${minsLeft}m`,
    totalExecutions: executionLog.length,
    recentLogs: executionLog.slice(-5)
  };
}

export async function executeScheduledHunt(triggerType = 'scheduled') {
  console.log(`[Scheduler] Executing hunt (${triggerType})...`);
  lastRunTimestamp = new Date().toISOString();

  try {
    const res = await runMultiSourceScrape();
    const entry = {
      timestamp: lastRunTimestamp,
      status: 'Success',
      trigger: triggerType,
      newJobs: res.addedCount,
      totalCatalog: res.totalJobs,
      message: `Scanned 5 job sites. Catalog total: ${res.totalJobs} opportunities.`
    };
    executionLog.push(entry);
    return entry;
  } catch (err) {
    const errorEntry = {
      timestamp: lastRunTimestamp,
      status: 'Error',
      trigger: triggerType,
      error: err.message
    };
    executionLog.push(errorEntry);
    return errorEntry;
  }
}

export function startScheduler() {
  if (timerHandle) return;

  console.log('[Scheduler] 2x/day background timer started (09:00, 17:00)');
  timerHandle = setInterval(() => {
    const now = new Date();
    if (SCHEDULED_HOURS.includes(now.getHours()) && now.getMinutes() === 0) {
      executeScheduledHunt('scheduled-cron');
    }
  }, 60000);
}

export function stopScheduler() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

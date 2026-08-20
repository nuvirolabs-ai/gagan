import { ageAllRetailers } from "./lib/ageing";
import { getSapConnector } from "./lib/sap";
import { drainOutbox } from "./lib/sap/outbox";
import { syncAll } from "./lib/sap/sync";

const MINUTE = 60_000;

function minutesFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

async function safely(label: string, work: () => Promise<unknown>) {
  try {
    const result = await work();
    console.log(`[job] ${label}`, result);
  } catch (err) {
    // A failing job must never take the API process down with it.
    console.error(`[job] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

/**
 * In-process schedulers. Fine for a single instance; move to a real scheduler
 * (or a worker dyno) before running more than one API replica, or these will
 * all fire in parallel.
 */
export function startScheduledJobs() {
  if (process.env.DISABLE_JOBS === "true") {
    console.log("[job] scheduled jobs disabled");
    return () => undefined;
  }

  const timers: NodeJS.Timeout[] = [];
  const stop = () => timers.forEach(clearInterval);

  // Ageing is time-driven: an invoice tips into overdue simply because a day
  // passed, so this cannot be event-driven off payments alone.
  const ageingMins = minutesFromEnv("AGEING_INTERVAL_MINUTES", 60);
  timers.push(setInterval(() => void safely("ageing", ageAllRetailers), ageingMins * MINUTE));
  void safely("ageing (startup)", ageAllRetailers);

  const connector = getSapConnector();
  if (!connector.enabled) {
    console.log(`[job] SAP disabled (SAP_MODE=${process.env.SAP_MODE || "disabled"}); sync jobs not scheduled`);
    return stop;
  }

  // Batch pull of master data. Spec §7 leaves real-time vs batch open; this is
  // the batch answer, and a real-time connector can simply ignore the schedule.
  const syncMins = minutesFromEnv("SAP_SYNC_INTERVAL_MINUTES", 60);
  timers.push(setInterval(() => void safely("sap sync", syncAll), syncMins * MINUTE));

  // Push side runs more often — orders should reach SAP promptly.
  const drainMins = minutesFromEnv("SAP_OUTBOX_INTERVAL_MINUTES", 5);
  timers.push(setInterval(() => void safely("sap outbox drain", () => drainOutbox()), drainMins * MINUTE));

  console.log(`[job] SAP sync every ${syncMins}m, outbox drain every ${drainMins}m`);
  return stop;
}

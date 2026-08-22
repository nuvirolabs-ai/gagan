import { scheduleRecoveryActions } from "../../modules/recovery/scheduler";

export function processRecoveryScheduler({ now = new Date() } = {}) {
  return scheduleRecoveryActions({ now });
}

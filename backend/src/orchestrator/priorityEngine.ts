import type { Appointment } from "../types.js";
import { store } from "../store/memoryStore.js";

export const LOCK_TTL_MS = 20_000;

const URGENCY_WEIGHT: Record<Appointment["urgency"], number> = {
  low: 5,
  medium: 15,
  high: 30,
};

function urgencyComponent(appointment: Appointment): number {
  return URGENCY_WEIGHT[appointment.urgency];
}

function vipComponent(appointment: Appointment): number {
  return appointment.clientTier === "vip" ? 20 : 0;
}

function escalationComponent(appointment: Appointment): number {
  // Boosted slightly per retry attempt to surface struggling workflows.
  return appointment.retryCount * 3;
}

function proximityComponent(appointment: Appointment, now: number): number {
  const scheduled = new Date(appointment.scheduledTime).getTime();
  const hoursUntil = (scheduled - now) / (60 * 60 * 1000);
  if (hoursUntil <= 0) return 40; // overdue
  if (hoursUntil < 24) return 30;
  if (hoursUntil < 72) return 20;
  if (hoursUntil < 24 * 7) return 10;
  return 5;
}

function slaRiskComponent(appointment: Appointment, now: number): number {
  const ageHours = (now - new Date(appointment.createdAt).getTime()) / (60 * 60 * 1000);
  if (ageHours > 24) return 25;
  if (ageHours > 6) return 12;
  if (ageHours > 1) return 5;
  return 0;
}

export function computePriorityScore(appointment: Appointment, now = Date.now()): number {
  return (
    urgencyComponent(appointment) +
    proximityComponent(appointment, now) +
    vipComponent(appointment) +
    escalationComponent(appointment) +
    slaRiskComponent(appointment, now)
  );
}

export function recomputeAll(now = Date.now()): void {
  for (const appointment of store.listAppointments()) {
    if (
      appointment.status === "COMPLETE" ||
      appointment.status === "ESCALATED"
    ) {
      continue;
    }
    appointment.priorityScore = computePriorityScore(appointment, now);
    appointment.updatedAt = new Date(now).toISOString();
    store.upsertAppointment(appointment);
  }
}

export function isLockExpired(appointment: Appointment, now = Date.now()): boolean {
  if (!appointment.inFlight) return false;
  if (!appointment.lockTimestamp) return true;
  return now - new Date(appointment.lockTimestamp).getTime() > LOCK_TTL_MS;
}

export function isEligible(appointment: Appointment, now = Date.now()): boolean {
  if (appointment.status === "COMPLETE") return false;
  if (appointment.status === "ESCALATED") return false;
  if (appointment.inFlight && !isLockExpired(appointment, now)) return false;
  return true;
}

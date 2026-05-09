import { nanoid } from "nanoid";
import type { Appointment, ClientTier, Specialty, Urgency } from "../types.js";
import { computePriorityScore } from "../orchestrator/priorityEngine.js";
import { enqueue } from "../queue/appointmentQueue.js";
import { emit } from "../orchestrator/eventBus.js";

const PATIENT_NAMES = [
  "Adaeze Okafor", "Liam Hayes", "Mei Chen", "Carlos Rivera", "Priya Shah",
  "Noah Williams", "Aaliyah Brown", "Jin Park", "Sofia Romano", "Ethan Cohen",
  "Yara Haddad", "Diego Morales", "Hana Kobayashi", "Maya Patel", "Lucas Müller",
  "Zara Khan", "Olu Adebayo", "Emma Wallace", "Tomás Silva", "Anya Volkov",
];

const SPECIALTIES: Specialty[] = ["cardiology", "dermatology", "surgery"];
const URGENCY_DIST: Urgency[] = ["low", "low", "medium", "medium", "medium", "high"];

const INGEST_INTERVAL_MS = 5_000;
const MAX_BURST = 2;
const IDLE_PROBABILITY = 0.35;

let timer: NodeJS.Timeout | null = null;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function makeAppointment(): Appointment {
  const specialty = pick(SPECIALTIES);
  const urgency = pick(URGENCY_DIST);
  const clientTier: ClientTier = Math.random() < 0.2 ? "vip" : "standard";
  const daysOut = 1 + Math.floor(Math.random() * 14);
  const scheduledTime = new Date(
    Date.now() + daysOut * 24 * 60 * 60 * 1000 + Math.random() * 8 * 60 * 60 * 1000,
  ).toISOString();
  const now = new Date().toISOString();

  const appointment: Appointment = {
    id: nanoid(8),
    patientName: pick(PATIENT_NAMES),
    specialty,
    workflowId: specialty,
    scheduledTime,
    urgency,
    clientTier,
    status: "NOT_STARTED",
    priorityScore: 0,
    inFlight: false,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  appointment.priorityScore = computePriorityScore(appointment);
  return appointment;
}

function tick(): void {
  if (Math.random() < IDLE_PROBABILITY) return;
  const burstSize = 1 + Math.floor(Math.random() * MAX_BURST);
  for (let i = 0; i < burstSize; i++) {
    const appt = makeAppointment();
    enqueue(appt);
    emit({
      type: "AppointmentCreated",
      appointmentId: appt.id,
      summary: `${appt.patientName} (${appt.specialty}, ${appt.urgency})`,
    });
    emit({
      type: "WorkflowStarted",
      appointmentId: appt.id,
      summary: `Workflow ${appt.workflowId} queued`,
    });
  }
}

export function startIngestion(): void {
  if (timer) return;
  // Seed a small initial burst so the dashboard isn't empty on first paint
  for (let i = 0; i < 3; i++) {
    const appt = makeAppointment();
    enqueue(appt);
    emit({
      type: "AppointmentCreated",
      appointmentId: appt.id,
      summary: `${appt.patientName} (${appt.specialty}, ${appt.urgency})`,
    });
  }
  timer = setInterval(tick, INGEST_INTERVAL_MS);
}

export function stopIngestion(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

import { create } from "zustand";
import type {
  Appointment,
  Escalation,
  MetricsSnapshot,
  WorkflowDefinitions,
  WorkflowEvent,
  WorkflowStatus,
} from "../types";
import { api } from "../services/api";

const ACTIVITY_LIMIT = 200;

interface WorkflowStore {
  appointments: Appointment[];
  escalations: Escalation[];
  metrics: MetricsSnapshot | null;
  workflowDefinitions: WorkflowDefinitions | null;
  activity: WorkflowEvent[];
  selectedEscalationId: string | null;
  lastReadEscalationAt: number;
  flashEscalationsTick: number;

  hydrate(): Promise<void>;
  refreshAppointments(status?: WorkflowStatus): Promise<void>;
  refreshEscalations(): Promise<void>;
  refreshMetrics(): Promise<void>;
  ingestEvent(event: WorkflowEvent): void;

  selectEscalation(id: string | null): void;
  markEscalationsRead(): void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  appointments: [],
  escalations: [],
  metrics: null,
  workflowDefinitions: null,
  activity: [],
  selectedEscalationId: null,
  lastReadEscalationAt: 0,
  flashEscalationsTick: 0,

  async hydrate() {
    const [appointments, escalations, metrics, defs, activity] = await Promise.all([
      api.appointments(),
      api.escalations(),
      api.metrics(),
      api.workflowDefinitions(),
      api.activity(ACTIVITY_LIMIT),
    ]);
    set({
      appointments,
      escalations,
      metrics,
      workflowDefinitions: defs,
      activity,
      lastReadEscalationAt: Date.now(),
    });
  },

  async refreshAppointments(status) {
    const appointments = await api.appointments(status);
    set({ appointments });
  },

  async refreshEscalations() {
    const escalations = await api.escalations();
    set({ escalations });
  },

  async refreshMetrics() {
    const metrics = await api.metrics();
    set({ metrics });
  },

  ingestEvent(event) {
    const activity = [event, ...get().activity].slice(0, ACTIVITY_LIMIT);
    set({ activity });

    if (
      event.type === "AppointmentCreated" ||
      event.type === "WorkflowStarted" ||
      event.type === "StageCompleted" ||
      event.type === "WorkflowCompleted" ||
      event.type === "WorkflowEscalated" ||
      event.type === "WorkflowResumed" ||
      event.type === "ConciergeResolved"
    ) {
      void get().refreshAppointments();
      void get().refreshMetrics();
    }
    if (
      event.type === "WorkflowEscalated" ||
      event.type === "ConciergeResolved" ||
      event.type === "WorkflowResumed"
    ) {
      void get().refreshEscalations();
    }
  },

  selectEscalation(id) {
    set({ selectedEscalationId: id });
  },

  markEscalationsRead() {
    set({
      lastReadEscalationAt: Date.now(),
      flashEscalationsTick: get().flashEscalationsTick + 1,
    });
  },
}));

import { store } from "../store/memoryStore.js";
import { isEligible } from "../orchestrator/priorityEngine.js";
import type { StageName } from "../types.js";

export interface MetricsSnapshot {
  queueBacklog: number;
  oldestQueuedAgeMs: number | null;
  averageStageLatencyMs: number | null;
  perStageSuccessRate: Record<string, number>;
  escalationRate: number;
  retryRate: number;
  averageEscalationResolutionMs: number | null;
  workflowThroughputPerMin: number;
  totalAppointments: number;
  processingCount: number;
  completedCount: number;
  escalatedCount: number;
  activeRetries: number;
}

const THROUGHPUT_WINDOW_MS = 60_000;

export function getMetrics(now = Date.now()): MetricsSnapshot {
  const appointments = store.listAppointments();
  const escalations = store.listEscalations();
  const executions = store.listExecutions();
  const events = store.listEvents();

  const queueAppointments = appointments.filter((a) => isEligible(a, now));
  const queueBacklog = queueAppointments.length;
  const oldestQueuedAgeMs = queueAppointments.length
    ? Math.max(
        ...queueAppointments.map(
          (a) => now - new Date(a.createdAt).getTime(),
        ),
      )
    : null;

  const totalLatency = executions.reduce(
    (acc, e) => acc + (e.result.executionTimeMs ?? 0),
    0,
  );
  const averageStageLatencyMs = executions.length
    ? Math.round(totalLatency / executions.length)
    : null;

  const perStageStats: Record<string, { passed: number; total: number }> = {};
  for (const e of executions) {
    const bucket = perStageStats[e.stage] ?? { passed: 0, total: 0 };
    bucket.total += 1;
    if (e.result.validationPassed) bucket.passed += 1;
    perStageStats[e.stage] = bucket;
  }
  const perStageSuccessRate: Record<string, number> = {};
  for (const stage in perStageStats) {
    const s = perStageStats[stage as StageName]!;
    perStageSuccessRate[stage] = s.total ? s.passed / s.total : 0;
  }

  const totalCompleted = appointments.filter((a) => a.status === "COMPLETE").length;
  const totalEscalated = appointments.filter((a) => a.status === "ESCALATED").length;
  const totalProcessed = totalCompleted + totalEscalated;
  const escalationRate = totalProcessed ? totalEscalated / totalProcessed : 0;

  const totalAttempts = executions.length;
  const totalDistinctStages = new Set(
    executions.map((e) => `${e.appointmentId}:${e.stage}`),
  ).size;
  const retryRate = totalDistinctStages
    ? (totalAttempts - totalDistinctStages) / totalDistinctStages
    : 0;

  const resolved = escalations.filter((e) => e.resolved);
  const resolutionTimes = resolved
    .map((e) => {
      const last = store
        .listResolutionsForAppointment(e.appointmentId)
        .filter((r) => r.stage === e.stage)
        .at(-1);
      if (!last) return null;
      return new Date(last.resolvedAt).getTime() - new Date(e.blockedSince).getTime();
    })
    .filter((n): n is number => n !== null && n >= 0);
  const averageEscalationResolutionMs = resolutionTimes.length
    ? Math.round(
        resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length,
      )
    : null;

  const completionsInWindow = events.filter(
    (e) =>
      e.type === "WorkflowCompleted" &&
      now - new Date(e.timestamp).getTime() <= THROUGHPUT_WINDOW_MS,
  ).length;
  const windowMinutes = THROUGHPUT_WINDOW_MS / 60_000;
  const workflowThroughputPerMin = Number(
    (completionsInWindow / windowMinutes).toFixed(2),
  );

  return {
    queueBacklog,
    oldestQueuedAgeMs,
    averageStageLatencyMs,
    perStageSuccessRate,
    escalationRate: Number(escalationRate.toFixed(3)),
    retryRate: Number(retryRate.toFixed(3)),
    averageEscalationResolutionMs,
    workflowThroughputPerMin,
    totalAppointments: appointments.length,
    processingCount: appointments.filter((a) => a.status === "PROCESSING").length,
    completedCount: totalCompleted,
    escalatedCount: totalEscalated,
    activeRetries: appointments.filter((a) => a.retryCount > 0).length,
  };
}

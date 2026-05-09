import type { Appointment, Specialty, StageName } from "../types.js";
import { workflowDefinitions } from "../workflows/workflowDefinitions.js";

export function getStages(workflowId: Specialty): StageName[] {
  return workflowDefinitions[workflowId];
}

export function getFirstStage(workflowId: Specialty): StageName {
  const stages = workflowDefinitions[workflowId];
  if (stages.length === 0) {
    throw new Error(`Workflow ${workflowId} has no stages`);
  }
  return stages[0]!;
}

export function getCurrentStage(appointment: Appointment): StageName {
  if (appointment.currentStage) return appointment.currentStage;
  return getFirstStage(appointment.workflowId);
}

export function getNextStage(
  workflowId: Specialty,
  currentStage: StageName,
): StageName | null {
  const stages = workflowDefinitions[workflowId];
  const idx = stages.indexOf(currentStage);
  if (idx === -1 || idx === stages.length - 1) return null;
  return stages[idx + 1]!;
}

export function isComplete(
  workflowId: Specialty,
  currentStage: StageName,
): boolean {
  const stages = workflowDefinitions[workflowId];
  return stages.indexOf(currentStage) === stages.length - 1;
}

export function getStageProgress(appointment: Appointment): {
  total: number;
  completedIndex: number;
} {
  const stages = workflowDefinitions[appointment.workflowId];
  const current = appointment.currentStage;
  if (!current) return { total: stages.length, completedIndex: -1 };
  const idx = stages.indexOf(current);
  return { total: stages.length, completedIndex: idx };
}

import type { Appointment, StageExecutionResult, StageName } from "../types.js";

export interface StageConfig {
  confidenceMin: number;
  confidenceMax: number;
  threshold: number;
  retryable: boolean;
}

export const stageConfig: Record<StageName, StageConfig> = {
  insurance_verification: {
    confidenceMin: 0.75,
    confidenceMax: 1.0,
    threshold: 0.85,
    retryable: true,
  },
  scheduling_confirmation: {
    confidenceMin: 0.7,
    confidenceMax: 1.0,
    threshold: 0.8,
    retryable: true,
  },
  prior_authorization: {
    confidenceMin: 0.6,
    confidenceMax: 0.95,
    threshold: 0.9,
    retryable: false,
  },
  clinical_review: {
    confidenceMin: 0.75,
    confidenceMax: 1.0,
    threshold: 0.85,
    retryable: true,
  },
  billing_review: {
    confidenceMin: 0.8,
    confidenceMax: 1.0,
    threshold: 0.85,
    retryable: true,
  },
};

export const SIMULATED_DELAY_MIN_MS = 800;
export const SIMULATED_DELAY_MAX_MS = 4000;

export function simulateDelay(): Promise<void> {
  const ms =
    SIMULATED_DELAY_MIN_MS +
    Math.random() * (SIMULATED_DELAY_MAX_MS - SIMULATED_DELAY_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sampleConfidence(stage: StageName): number {
  const cfg = stageConfig[stage];
  const range = cfg.confidenceMax - cfg.confidenceMin;
  return Number((cfg.confidenceMin + Math.random() * range).toFixed(3));
}

export function getStageThreshold(stage: StageName): number {
  return stageConfig[stage].threshold;
}

export function isStageRetryable(stage: StageName): boolean {
  return stageConfig[stage].retryable;
}

export interface Agent {
  readonly stage: StageName;
  execute(appointment: Appointment): Promise<StageExecutionResult>;
}

import type { Appointment, StageExecutionResult } from "../types.js";
import {
  type Agent,
  isStageRetryable,
  sampleConfidence,
  simulateDelay,
} from "./baseAgent.js";

export interface SchedulingOutput {
  slotConfirmed: boolean;
  providerId: string;
  room: string;
  conflictDetected: boolean;
}

const PROVIDERS = ["Dr. Patel", "Dr. Nguyen", "Dr. Okafor", "Dr. Hernandez", "Dr. Cohen"];

export const schedulingAgent: Agent = {
  stage: "scheduling_confirmation",
  async execute(appointment: Appointment): Promise<StageExecutionResult<SchedulingOutput>> {
    const start = Date.now();
    await simulateDelay();
    const confidence = sampleConfidence("scheduling_confirmation");
    const conflictDetected = Math.random() < 0.08;
    return {
      status: "COMPLETE",
      confidence,
      validationPassed: true,
      retryable: isStageRetryable("scheduling_confirmation"),
      output: {
        slotConfirmed: !conflictDetected,
        providerId: PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)]!,
        room: `Room ${Math.floor(Math.random() * 30 + 100)}`,
        conflictDetected,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

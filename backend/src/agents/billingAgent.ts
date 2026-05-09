import type { Appointment, StageExecutionResult } from "../types.js";
import {
  type Agent,
  isStageRetryable,
  sampleConfidence,
  simulateDelay,
} from "./baseAgent.js";

export interface BillingOutput {
  estimatedCost: number;
  copay: number;
  billingCode: string;
}

export const billingAgent: Agent = {
  stage: "billing_review",
  async execute(appointment: Appointment): Promise<StageExecutionResult<BillingOutput>> {
    const start = Date.now();
    await simulateDelay();
    const confidence = sampleConfidence("billing_review");
    const estimatedCost = Math.round(800 + Math.random() * 4000);
    const copay = Math.round(estimatedCost * (appointment.clientTier === "vip" ? 0.05 : 0.2));
    return {
      status: "COMPLETE",
      confidence,
      validationPassed: true,
      retryable: isStageRetryable("billing_review"),
      output: {
        estimatedCost,
        copay,
        billingCode: `CPT-${Math.floor(Math.random() * 90000 + 10000)}`,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

import type { Appointment, StageExecutionResult } from "../types.js";
import {
  type Agent,
  isStageRetryable,
  sampleConfidence,
  simulateDelay,
} from "./baseAgent.js";

export interface ClinicalOutput {
  reviewerId: string;
  notes: string;
  riskFlags: string[];
}

export const clinicalReviewAgent: Agent = {
  stage: "clinical_review",
  async execute(appointment: Appointment): Promise<StageExecutionResult<ClinicalOutput>> {
    const start = Date.now();
    await simulateDelay();
    const confidence = sampleConfidence("clinical_review");
    const flags = appointment.urgency === "high" ? ["urgent_followup"] : [];
    return {
      status: "COMPLETE",
      confidence,
      validationPassed: true,
      retryable: isStageRetryable("clinical_review"),
      output: {
        reviewerId: `MD-${Math.floor(Math.random() * 9000 + 1000)}`,
        notes: "Routine clinical review completed.",
        riskFlags: flags,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

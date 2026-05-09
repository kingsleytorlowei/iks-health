import type { Appointment, StageExecutionResult } from "../types.js";
import {
  type Agent,
  isStageRetryable,
  sampleConfidence,
  simulateDelay,
} from "./baseAgent.js";

export interface InsuranceOutput {
  policyNumber: string;
  memberId: string;
  expiration: string;
  payer: string;
}

const PAYERS = ["Aetna", "BlueCross", "Cigna", "UnitedHealth", "Humana"];

export const insuranceAgent: Agent = {
  stage: "insurance_verification",
  async execute(appointment: Appointment): Promise<StageExecutionResult<InsuranceOutput>> {
    const start = Date.now();
    await simulateDelay();
    const confidence = sampleConfidence("insurance_verification");

    // Simulate occasional missing fields (~10% of runs)
    const missingField = Math.random() < 0.1;

    const output: InsuranceOutput = {
      policyNumber: missingField ? "" : `POL-${appointment.id.slice(0, 6)}`,
      memberId: `MBR-${appointment.id.slice(-6).toUpperCase()}`,
      expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      payer: PAYERS[Math.floor(Math.random() * PAYERS.length)]!,
    };

    return {
      status: "COMPLETE",
      confidence,
      validationPassed: true,
      retryable: isStageRetryable("insurance_verification"),
      output,
      executionTimeMs: Date.now() - start,
    };
  },
};

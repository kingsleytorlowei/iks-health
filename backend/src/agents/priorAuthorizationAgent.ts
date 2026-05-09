import type { Appointment, StageExecutionResult } from "../types.js";
import {
  type Agent,
  isStageRetryable,
  sampleConfidence,
  simulateDelay,
} from "./baseAgent.js";

export interface AuthorizationOutput {
  authCode: string;
  payerRulesSatisfied: boolean;
  expiresAt: string;
}

const VALID_AUTH_PREFIX = /^AUTH-/;

export const priorAuthorizationAgent: Agent = {
  stage: "prior_authorization",
  async execute(appointment: Appointment): Promise<StageExecutionResult<AuthorizationOutput>> {
    const start = Date.now();
    await simulateDelay();
    const confidence = sampleConfidence("prior_authorization");

    // Occasionally produce malformed code (~15%)
    const malformed = Math.random() < 0.15;
    const authCode = malformed
      ? `XX-${appointment.id.slice(0, 6)}`
      : `AUTH-${appointment.id.slice(0, 8).toUpperCase()}`;

    const payerRulesSatisfied = Math.random() > 0.1;

    return {
      status: "COMPLETE",
      confidence,
      validationPassed: true,
      retryable: isStageRetryable("prior_authorization"),
      output: {
        authCode,
        payerRulesSatisfied,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      issues: VALID_AUTH_PREFIX.test(authCode)
        ? undefined
        : ["malformed_auth_code"],
      executionTimeMs: Date.now() - start,
    };
  },
};

import type { StageExecutionResult, StageName, ValidationOutcome } from "../types.js";
import { getStageThreshold } from "../agents/baseAgent.js";

export type Decision = "continue" | "retry" | "escalate";

export const MAX_RETRIES = 3;

export interface DecisionInput {
  stage: StageName;
  result: StageExecutionResult;
  validation: ValidationOutcome;
  retryCount: number;
}

export function decide(input: DecisionInput): Decision {
  const { stage, result, validation, retryCount } = input;
  const threshold = getStageThreshold(stage);

  if (validation.passed && result.confidence >= threshold) {
    return "continue";
  }
  if (result.retryable && retryCount < MAX_RETRIES) {
    return "retry";
  }
  return "escalate";
}

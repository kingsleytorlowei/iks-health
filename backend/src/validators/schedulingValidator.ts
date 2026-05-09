import type { StageExecutionResult, ValidationOutcome } from "../types.js";
import { getStageThreshold } from "../agents/baseAgent.js";
import type { SchedulingOutput } from "../agents/schedulingAgent.js";

export function validateScheduling(
  result: StageExecutionResult<SchedulingOutput>,
): ValidationOutcome {
  const issues: string[] = [];
  const output = result.output;

  if (!output) {
    issues.push("missing_output");
  } else {
    if (!output.slotConfirmed) issues.push("slot_not_confirmed");
    if (!output.providerId) issues.push("missing_provider");
    if (output.conflictDetected) issues.push("scheduling_conflict");
  }

  if (result.confidence < getStageThreshold("scheduling_confirmation")) {
    issues.push("confidence_below_threshold");
  }

  return { passed: issues.length === 0, issues };
}

import { describe, it, expect } from "vitest";
import { decide, MAX_RETRIES } from "../src/orchestrator/decisionEngine.js";
import { stageConfig } from "../src/agents/baseAgent.js";
import type { StageExecutionResult, ValidationOutcome } from "../src/types.js";

const passed: ValidationOutcome = { passed: true, issues: [] };
const failed: ValidationOutcome = { passed: false, issues: ["confidence_below_threshold"] };

function result(opts: Partial<StageExecutionResult> = {}): StageExecutionResult {
  return {
    status: "COMPLETE",
    confidence: 0.95,
    validationPassed: true,
    retryable: true,
    ...opts,
  };
}

describe("decide", () => {
  it("continues when validation passes and confidence clears the threshold", () => {
    expect(
      decide({
        stage: "insurance_verification",
        result: result({ confidence: 0.9 }),
        validation: passed,
        retryCount: 0,
      }),
    ).toBe("continue");
  });

  it("escalates when confidence is below threshold and not retryable", () => {
    expect(
      decide({
        stage: "prior_authorization",
        result: result({ confidence: 0.5, retryable: false }),
        validation: failed,
        retryCount: 0,
      }),
    ).toBe("escalate");
  });

  it("retries when validation fails but stage is retryable and budget remains", () => {
    expect(
      decide({
        stage: "insurance_verification",
        result: result({ confidence: 0.4, retryable: true }),
        validation: failed,
        retryCount: 1,
      }),
    ).toBe("retry");
  });

  it("escalates after the retry budget is exhausted", () => {
    expect(
      decide({
        stage: "insurance_verification",
        result: result({ confidence: 0.4, retryable: true }),
        validation: failed,
        retryCount: MAX_RETRIES,
      }),
    ).toBe("escalate");
  });

  it("escalates a non-retryable failure even with budget remaining", () => {
    expect(
      decide({
        stage: "prior_authorization",
        result: result({ confidence: 0.5, retryable: false }),
        validation: failed,
        retryCount: 0,
      }),
    ).toBe("escalate");
  });

  it("treats confidence exactly at the threshold as a pass", () => {
    const stage = "insurance_verification";
    const threshold = stageConfig[stage].threshold;
    expect(
      decide({
        stage,
        result: result({ confidence: threshold }),
        validation: passed,
        retryCount: 0,
      }),
    ).toBe("continue");
  });

  it("escalates when validation fails despite passing confidence", () => {
    expect(
      decide({
        stage: "insurance_verification",
        result: result({ confidence: 0.99, retryable: false }),
        validation: { passed: false, issues: ["missing_member_id"] },
        retryCount: 0,
      }),
    ).toBe("escalate");
  });
});

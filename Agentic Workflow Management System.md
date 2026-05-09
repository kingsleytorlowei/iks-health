# Agentic Workflow Management System — Design Document

## 1. Overview

This document specifies an operational prototype of an Agentic Workflow Management System for healthcare appointment processing. The system simulates how a real workflow orchestration platform coordinates configurable multi-stage agent pipelines, validates their outputs, recovers from failures, and escalates unresolved issues to human operators.

This is explicitly not a production system. Infrastructure is mocked or in-memory throughout. The goal is to demonstrate architectural clarity, modularity, and operational realism — particularly the seams where orchestration systems become non-trivial: concurrency, trust boundaries, recovery semantics, and observability.

The application should feel like an operational command center, not a CRUD dashboard.

## 2. Tech Stack

The frontend uses React with TypeScript, TailwindCSS for styling, and Zustand for state management. React Query and Framer Motion are optional. The backend is Node.js with Express in TypeScript. All persistence is in-memory; no database is required.

The frontend communicates with the backend over REST for commands and queries, and over Server-Sent Events (SSE) for live workflow updates. SSE is required, not optional — polling would undermine the operational-dashboard experience the system is designed to demonstrate.

## 3. High-Level Architecture

```
Appointment Feed
        ↓
Appointment Ingestion Service
        ↓
Priority Queue
        ↓
Master Orchestrator (worker pool)
        ↓
Workflow Engine → Stage Agent → Validation Layer → Decision Engine
        ↓
Continue / Retry / Escalate
        ↓
Exception Queue
        ↓
Human Concierge
        ↓
Workflow Resume
```

Appointments enter through an ingestion service that mocks a continuous feed. They land in a priority queue, where a master orchestrator running a fixed pool of workers dequeues the highest-priority eligible item. Each worker invokes the appropriate stage agent, passes its output through a validation layer, and consults a decision engine to determine whether to continue, retry, or escalate. Escalations land in an exception queue, where a human concierge can inspect them and produce a structured resolution that the orchestrator consumes to resume execution.

## 4. Core Domain Model

### 4.1 Appointments

An appointment represents a single workflow instance. It carries identifying information, scheduling and clinical metadata, and the operational state that drives orchestration:

```ts
type WorkflowStatus =
  | "NOT_STARTED"
  | "PROCESSING"
  | "COMPLETE"
  | "ESCALATED"
  | "CLEARED"

type Appointment = {
  id: string
  patientName: string
  specialty: string
  scheduledTime: string
  urgency: "low" | "medium" | "high"
  clientTier: "standard" | "vip"
  status: WorkflowStatus
  currentStage?: string
  workflowId: string
  priorityScore: number
  escalationReason?: string
  inFlight: boolean
  workerId?: string
  lockTimestamp?: string
  createdAt: string
  updatedAt: string
}
```

The `inFlight`, `workerId`, and `lockTimestamp` fields support the worker locking and recovery model described in Section 6.

### 4.2 Workflow Definitions

Workflows are configuration-driven. Different specialties resolve to different stage sequences, and the orchestrator must read these definitions dynamically rather than referencing them in code paths.

```ts
export const workflowDefinitions = {
  cardiology: [
    "insurance_verification",
    "clinical_review",
    "prior_authorization",
    "scheduling_confirmation"
  ],
  dermatology: [
    "insurance_verification",
    "scheduling_confirmation"
  ],
  surgery: [
    "insurance_verification",
    "clinical_review",
    "prior_authorization",
    "billing_review",
    "scheduling_confirmation"
  ]
}
```

Workflows in this prototype are strictly linear. Conditional routing, branching, and parallel stage execution are intentionally out of scope.

### 4.3 Stage Execution

Agents return a structured result that both the validation and decision layers consume:

```ts
type StageExecutionStatus =
  | "NOT_STARTED"
  | "PROCESSING"
  | "COMPLETE"
  | "FAILED"

type StageExecutionResult<T = unknown> = {
  status: StageExecutionStatus
  confidence: number
  validationPassed: boolean
  retryable: boolean
  output?: T
  issues?: string[]
  executionTimeMs?: number
}
```

Stage-level status is intentionally distinct from workflow-level status. A single failed stage does not imply an escalated workflow — the decision engine makes that determination.

## 5. Backend Structure

```
backend/
└── src/
    ├── orchestrator/
    │   ├── masterOrchestrator.ts
    │   ├── workflowEngine.ts
    │   ├── priorityEngine.ts
    │   ├── decisionEngine.ts
    │   └── eventBus.ts
    ├── agents/
    │   ├── agentRegistry.ts
    │   ├── insuranceAgent.ts
    │   ├── authorizationAgent.ts
    │   ├── schedulingAgent.ts
    │   ├── billingAgent.ts
    │   └── clinicalReviewAgent.ts
    ├── validators/
    │   ├── insuranceValidator.ts
    │   ├── schedulingValidator.ts
    │   └── authorizationValidator.ts
    ├── queue/
    │   ├── appointmentQueue.ts
    │   └── escalationQueue.ts
    ├── ingestion/
    │   └── appointmentIngestionService.ts
    ├── workflows/
    │   └── workflowDefinitions.ts
    ├── api/
    │   ├── routes.ts
    │   └── sse.ts
    ├── store/
    │   └── memoryStore.ts
    ├── activity/
    │   └── activityLog.ts
    └── utils/
```

## 6. Concurrency and Worker Lifecycle

The orchestrator runs a fixed pool of two workers. Each worker independently dequeues the highest-priority eligible appointment, marks it in-flight with its `workerId` and `lockTimestamp`, executes the appropriate stage agent, updates workflow state, and releases the lock.

The worker count is intentionally low. Combined with the bursty ingestion pattern in Section 7, two workers produce visible queue oscillation — backlog forms during ingestion bursts and drains during quieter periods, making prioritization and orchestration legible on the dashboard. A larger pool would keep the queue empty most of the time and the system would look idle even when it isn't.

Locks are reclaimed by TTL. If an appointment's `lockTimestamp` is older than 20 seconds, the orchestrator treats it as recoverable and returns it to the eligible pool. The TTL is calibrated against the simulated stage execution range of 1–8 seconds (Section 10), giving roughly 2.5× headroom over the worst-case execution. This is a deliberately lightweight recovery mechanism appropriate for a single-process prototype; distributed leases are out of scope.

## 7. Ingestion

The ingestion service simulates a continuous feed using `setInterval`. Every five seconds it produces a burst of one to four appointments, with occasional idle ticks. Each appointment is assigned a specialty, mapped to its workflow, given an initial priority score, and enqueued.

The burst pattern is calibrated so average ingestion sits slightly below worker throughput while peaks exceed it. This produces oscillating queue depth — the dashboard shows backlog forming and draining rather than a permanently empty or permanently exploding queue.

## 8. Priority Queue

The queue maintains pending work and always surfaces the highest-priority eligible appointment. A priority score is computed from a weighted sum of urgency, proximity to scheduled appointment time, client tier (VIP), prior escalation history, and SLA risk:

```
priorityScore =
  urgencyWeight +
  appointmentProximityWeight +
  vipWeight +
  escalationWeight +
  slaRiskWeight
```

Reprioritization is event-driven. The score is recomputed on appointment ingestion, stage completion, escalation creation, escalation aging, concierge resolution, and retry attempts. A lightweight background scheduler additionally recomputes SLA risk every 30 seconds to capture time-sensitive priority changes that no discrete event would otherwise trigger.

An appointment is eligible to be dequeued only if it is not currently in-flight (or its lock has expired), not escalated, and not complete. Escalated appointments live in the exception queue (Section 13) and do not return to the priority queue until the concierge resolves them.

## 9. Orchestrator and Workflow Engine

The master orchestrator is the central coordination loop. Each worker executes the same cycle: dequeue an eligible appointment, ask the workflow engine for the current stage, look up the corresponding agent, execute it, validate the output, hand the result to the decision engine, update state, and emit an event to the activity log.

The workflow engine is a small stateless module that reads `workflowDefinitions`, returns the current stage given an appointment's progress, computes the next stage, and detects workflow completion. It does not contain orchestration logic — it answers questions about workflow shape.

Agents are registered by stage name. This registry is the seam that makes "configurable workflows" real:

```ts
export const agentRegistry = {
  insurance_verification: InsuranceAgent,
  clinical_review: ClinicalReviewAgent,
  prior_authorization: PriorAuthorizationAgent,
  billing_review: BillingAgent,
  scheduling_confirmation: SchedulingAgent
}
```

The orchestrator looks up the agent for the current stage, instantiates it, and calls `execute`.

## 10. Agents

Agents are isolated processing units. Each one simulates asynchronous execution with a randomized delay between one and eight seconds, then returns a `StageExecutionResult` with a confidence score sampled from a stage-tuned range.

Confidence ranges and thresholds are tuned per stage to produce intentional escalation density rather than uniform random noise:

| Stage                   | Confidence range | Threshold | Approx. escalation rate |
| ----------------------- | ---------------- | --------- | ----------------------- |
| Insurance Verification  | 0.75–1.0         | 0.85      | ~40%                    |
| Scheduling Confirmation | 0.70–1.0         | 0.80      | ~33%                    |
| Prior Authorization     | 0.60–0.95        | 0.90      | ~86%                    |
| Clinical Review         | 0.75–1.0         | 0.85      | ~40%                    |
| Billing Review          | 0.80–1.0         | 0.85      | ~25%                    |

This makes Prior Authorization the dominant escalation source, which matches real healthcare operations and creates a believable concierge workload. The thresholds and ranges are configuration values, not hardcoded into agents — the demo's escalation density should be tunable.

A minimal agent looks like:

```ts
class InsuranceAgent {
  async execute(appointment: Appointment): Promise<StageExecutionResult> {
    await simulateDelay()
    const confidence = sampleConfidence("insurance_verification")
    return {
      status: "COMPLETE",
      confidence,
      validationPassed: true,
      retryable: false
    }
  }
}
```

## 11. Validation

The validation layer is deliberately separated from agent execution. The system does not blindly trust agent outputs — every stage's result is checked against stage-specific rules before the decision engine sees it.

Validation responsibilities include checking required fields, verifying formatting, detecting conflicts, and evaluating confidence against the stage's threshold. Concrete rules vary by stage: insurance validators check that a policy exists, has not expired, and includes a member ID; scheduling validators confirm slot availability, provider assignment, and absence of overlap; authorization validators verify code format and payer rules.

## 12. Decision Engine

After validation, the decision engine determines what happens next. The logic is small by design:

- If validation passed and confidence cleared the stage threshold, the workflow continues to the next stage.
- If the failure is marked retryable and the appointment is below its retry budget, the orchestrator retries the same stage.
- Otherwise, the workflow escalates.

The retry budget is three attempts per stage. Beyond that, the workflow escalates regardless of retryability. Confidence thresholds are read per stage from the configuration in Section 10 — there is no global threshold.

## 13. Exception Queue and Concierge

Escalated workflows are removed from the priority queue and placed in the exception queue, where they are isolated from automatic processing until a human concierge resolves them. Each escalation record captures the appointment, the failed stage, the reason, severity, retry count, and how long the workflow has been blocked:

```ts
type Escalation = {
  appointmentId: string
  stage: string
  reason: string
  severity: "low" | "medium" | "high"
  blockedSince: string
  retryCount: number
}
```

The concierge interface lets an operator inspect the workflow's full history, view the failing agent's output and validation issues, retry the stage, override the failure, or mark the issue cleared.

### 13.1 Resolution Semantics

A concierge does not directly mutate agent execution records. Instead, the resolution action produces a structured, stage-scoped artifact that becomes part of workflow state:

```ts
type StageResolution<T> = {
  stage: string
  resolutionType: "RETRY" | "OVERRIDE"
  resolvedOutput?: T
  resolutionNotes: string
  resolvedBy: string
  resolvedAt: string
}
```

When a `StageResolution` is attached, the orchestrator marks the failed stage as resolved, injects `resolvedOutput` into workflow state, and advances to the next stage. Historical agent execution records remain immutable for auditability — the resolution sits alongside them, not on top of them.

Concierge override resolutions are authoritative for the stage they resolve: that stage is not revalidated after approval. Downstream stages, however, continue to validate their own inputs against workflow state normally. This keeps the trust boundary explicit — concierge approval ends validation for one stage, not the whole workflow — and avoids escalate-resolve-escalate loops on the resolved stage.

A `RETRY` resolution returns the appointment to the priority queue with its retry count reset, and the stage runs again from scratch.

The resolved appointment moves through `ESCALATED → CLEARED → PROCESSING`, and normal orchestration resumes.

## 14. Activity Feed and Events

The system emits events at every meaningful transition through an internal event bus. The activity feed and the SSE stream both consume from this bus, ensuring the operator's live view and the historical log share a single source of truth.

Events include `AppointmentCreated`, `WorkflowStarted`, `StageStarted`, `StageCompleted`, `ValidationFailed`, `RetryTriggered`, `WorkflowEscalated`, `ConciergeResolved`, and `WorkflowResumed`. Each event carries the appointment ID, the stage where applicable, a timestamp, and a short human-readable summary suitable for the activity feed.

## 15. Operational Metrics

The dashboard surfaces a small set of metrics chosen for operational meaning rather than visual density:

- **Queue backlog size** — pending work count.
- **Oldest queued appointment age** — staleness, which is a stronger health signal than backlog size alone.
- **Average processing latency**, per stage and overall.
- **Per-agent success rate.**
- **Escalation rate.**
- **Retry rate.**
- **Average escalation resolution time.**
- **Workflow throughput** (completions per minute).

These metrics are derived from the same event stream that drives the activity feed.

## 16. Frontend

```
frontend/
└── src/
    ├── pages/
    ├── components/
    │   ├── Dashboard/
    │   ├── AppointmentCard/
    │   ├── WorkflowTimeline/
    │   ├── ExceptionQueue/
    │   ├── ConciergePanel/
    │   ├── CalendarView/
    │   ├── Notifications/
    │   ├── ActivityFeed/
    │   └── Metrics/
    ├── store/
    │   └── workflowStore.ts
    ├── services/
    │   ├── api.ts
    │   └── sse.ts
    ├── hooks/
    ├── types/
    └── utils/
```

The dashboard is the primary surface. It displays the operational metrics from Section 15, status tabs that filter appointments by `WorkflowStatus`, and an appointment grid where each card shows patient, specialty, scheduled time, priority score, current stage, workflow progress, and an escalation indicator.

The workflow timeline component visualizes a single appointment's stage progression with check, exclamation, and ellipsis glyphs for completed, failed, and in-progress stages. The calendar view offers day and week perspectives with color-coded statuses for at-a-glance scheduling oversight.

The exception queue UI lists escalations with reason, severity, blocked duration, and stage, sorted by a combination of severity and blocked age. Selecting an escalation opens the concierge panel — a side drawer containing the workflow history, validation failures, agent logs, retry and override controls, and a resolve button that produces the `StageResolution` artifact described in Section 13.1.

Notifications and toasts surface escalations, retries, completions, and workflow resumes as they happen. All live updates flow through SSE.

## 17. State Machine

A workflow moves through a small, explicit state machine:

```
NOT_STARTED → PROCESSING → COMPLETE

PROCESSING → ESCALATED → CLEARED → PROCESSING → COMPLETE
```

These are the only states. A `paused` state was considered and intentionally rejected — escalation already covers the only case where a workflow needs to be removed from automatic processing.

## 18. Simulation Strategy

The system simulates ingestion, orchestration, agent execution, validation, retries, escalations, and recovery. Randomness is used deliberately: stage execution times are uniform in 1–8 seconds, confidence is sampled from stage-tuned ranges, and retryability is set per agent based on plausible failure semantics.

Out of scope: real AI or model inference, real databases, authentication, distributed infrastructure, and any production deployment concerns.

## 19. What This Project Demonstrates

The prototype is intended to communicate workflow orchestration thinking, queue-based processing, configurable pipelines, bounded agent autonomy, validation and decision loops, resilient recovery patterns, human-in-the-loop systems, observability via event streams, and operational UX design. The application should feel like a real operational workflow platform.

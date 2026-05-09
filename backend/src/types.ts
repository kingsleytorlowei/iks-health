export type Specialty = "cardiology" | "dermatology" | "surgery";

export type Urgency = "low" | "medium" | "high";

export type ClientTier = "standard" | "vip";

export type WorkflowStatus =
  | "NOT_STARTED"
  | "PROCESSING"
  | "COMPLETE"
  | "ESCALATED"
  | "CLEARED";

export type StageExecutionStatus =
  | "NOT_STARTED"
  | "PROCESSING"
  | "COMPLETE"
  | "FAILED";

export type Severity = "low" | "medium" | "high";

export type StageName =
  | "insurance_verification"
  | "clinical_review"
  | "prior_authorization"
  | "billing_review"
  | "scheduling_confirmation";

export interface Appointment {
  id: string;
  patientName: string;
  specialty: Specialty;
  scheduledTime: string;
  urgency: Urgency;
  clientTier: ClientTier;
  status: WorkflowStatus;
  currentStage?: StageName;
  workflowId: Specialty;
  priorityScore: number;
  escalationReason?: string;
  inFlight: boolean;
  workerId?: string;
  lockTimestamp?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StageExecutionResult<T = unknown> {
  status: StageExecutionStatus;
  confidence: number;
  validationPassed: boolean;
  retryable: boolean;
  output?: T;
  issues?: string[];
  executionTimeMs?: number;
}

export interface StageExecutionRecord {
  id: string;
  appointmentId: string;
  stage: StageName;
  attempt: number;
  result: StageExecutionResult;
  startedAt: string;
  completedAt: string;
}

export interface ValidationOutcome {
  passed: boolean;
  issues: string[];
}

export interface Escalation {
  id: string;
  appointmentId: string;
  stage: StageName;
  reason: string;
  severity: Severity;
  blockedSince: string;
  retryCount: number;
  resolved: boolean;
}

export type ResolutionType = "RETRY" | "OVERRIDE";

export interface StageResolution<T = unknown> {
  stage: StageName;
  resolutionType: ResolutionType;
  resolvedOutput?: T;
  resolutionNotes: string;
  resolvedBy: string;
  resolvedAt: string;
}

export type WorkflowEventType =
  | "AppointmentCreated"
  | "WorkflowStarted"
  | "StageStarted"
  | "StageCompleted"
  | "ValidationFailed"
  | "RetryTriggered"
  | "WorkflowEscalated"
  | "ConciergeResolved"
  | "WorkflowResumed"
  | "WorkflowCompleted"
  | "LockReclaimed";

export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  appointmentId: string;
  stage?: StageName;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

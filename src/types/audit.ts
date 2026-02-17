export type AuditAction =
  | "patient.view"
  | "patient.edit"
  | "patient.create"
  | "encounter.view"
  | "encounter.edit"
  | "encounter.create"
  | "encounter.summary.view"
  | "encounter.summary.print"
  | "encounter.summary.email"
  | "encounter.summary.text_link"
  | "encounter.sign.nursing_complete"
  | "encounter.sign.provider_signed"
  | "encounter.decline_to_treat"
  | "encounter.decline_acknowledged"
  | "encounter.cancelled"
  | "encounter.order_approved"
  | "demo_data.reset"
  | "demo_data.seed_customer";

export type AuditEntityType = "patient" | "encounter" | "system";

export interface AuditEvent {
  timestamp: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: string;
}

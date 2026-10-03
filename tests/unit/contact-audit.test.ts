import { describe, expect, it } from "vitest";
import { AuditAction } from "@/lib/audit-actions";
import { auditActionLabel } from "@/lib/audit-display";

describe("contact audit labels", () => {
  it("labels contact inbox actions", () => {
    expect(auditActionLabel(AuditAction.ContactMessageReceived)).toBe("Contact message");
    expect(auditActionLabel(AuditAction.ContactMessageReviewed)).toBe("Contact reviewed");
    expect(auditActionLabel(AuditAction.ContactMessageReplied)).toBe("Contact reply");
    expect(auditActionLabel(AuditAction.ContactMessageArchived)).toBe("Contact archived");
    expect(auditActionLabel(AuditAction.ContactMessageReopened)).toBe("Contact reopened");
  });
});
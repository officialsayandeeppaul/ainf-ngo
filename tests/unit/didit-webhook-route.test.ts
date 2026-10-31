import { beforeEach, describe, expect, it, vi } from "vitest";

type Loose = (...args: any[]) => any;

const h = vi.hoisted(() => ({
  verify: vi.fn<Loose>(() => ({ ok: true, scheme: "V2", trustsPayload: true })),
  apply: vi.fn<Loose>(async () => ({ applied: true })),
  dataEdit: vi.fn<Loose>(async () => ({ applied: true })),
  createEvent: vi.fn<Loose>(async () => ({})),
  updateEvent: vi.fn<Loose>(async () => ({ count: 0 })),
  limit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 1000, degraded: false })),
  audit: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ isDatabaseConfigured: true, isDiditWebhookConfigured: true }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: h.limit }));
vi.mock("@/lib/request-context", () => ({ contextFromRequest: () => ({ ip: "127.0.0.1", userAgent: "test" }) }));
vi.mock("@/lib/audit", () => ({ AuditAction: { KycWebhookRejected: "rejected" }, recordAudit: h.audit }));
vi.mock("@/lib/didit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/didit")>("@/lib/didit");
  return { mapDiditStatus: actual.mapDiditStatus, verifyWebhookSignature: h.verify };
});
vi.mock("@/lib/kyc-apply", () => ({ applyDiditDecision: h.apply, applyDiditDataEdit: h.dataEdit }));
vi.mock("@/lib/db", () => ({ db: { webhookEvent: { create: h.createEvent, updateMany: h.updateEvent } } }));

import { POST } from "@/app/api/webhooks/didit/route";

const post = (body: unknown) =>
  POST(new Request("https://theainf.in/api/webhooks/didit", { method: "POST", body: JSON.stringify(body) }));

const event = {
  event_id: "evt_1",
  session_id: "sess_1",
  status: "Approved",
  webhook_type: "status.updated",
  timestamp: Math.floor(Date.now() / 1000),
};

beforeEach(() => {
  for (const fn of [h.apply, h.dataEdit, h.createEvent, h.updateEvent, h.audit]) fn.mockClear();
  h.createEvent.mockResolvedValue({});
  h.updateEvent.mockResolvedValue({ count: 0 });
  h.verify.mockReturnValue({ ok: true, scheme: "V2", trustsPayload: true });
});

describe("Didit webhook route", () => {
  it("applies a new status change once", async () => {
    const res = await post(event);
    expect(res.status).toBe(200);
    expect(h.createEvent.mock.calls[0][0].data.eventType).toBe("status.updated:APPROVED");
    expect(h.apply).toHaveBeenCalledTimes(1);
  });

  it("drops a duplicate that was already processed", async () => {
    h.createEvent.mockRejectedValueOnce(new Error("unique"));
    const res = await post(event);
    expect(await res.json()).toEqual({ ok: true, deduplicated: true });
    expect(h.apply).not.toHaveBeenCalled();
  });

  it("processes Didit's retry of a delivery that failed", async () => {
    h.createEvent.mockRejectedValueOnce(new Error("unique"));
    h.updateEvent.mockResolvedValueOnce({ count: 1 });
    const res = await post(event);
    expect(res.status).toBe(200);
    expect(h.updateEvent.mock.calls[0][0].where).toMatchObject({ processedAt: null });
    expect(h.apply).toHaveBeenCalledTimes(1);
  });

  it("answers 500 when processing fails, so Didit retries", async () => {
    h.apply.mockRejectedValueOnce(new Error("db down"));
    const res = await post(event);
    expect(res.status).toBe(500);
  });

  it("stores data edits per event_id without re-running the decision", async () => {
    const res = await post({ ...event, webhook_type: "data.updated", event_id: "evt_2" });
    expect(res.status).toBe(200);
    expect(h.createEvent.mock.calls[0][0].data.eventType).toBe("data.updated:APPROVED:evt_2");
    expect(h.dataEdit).toHaveBeenCalledTimes(1);
    expect(h.apply).not.toHaveBeenCalled();
  });

  it("acknowledges entity / transaction events without touching anything", async () => {
    const res = await post({ event_id: "evt_3", webhook_type: "transaction.created", timestamp: event.timestamp });
    expect(await res.json()).toEqual({ ok: true, ignored: "transaction.created" });
    expect(h.createEvent).not.toHaveBeenCalled();
  });

  it("rejects a bad signature before reading the body", async () => {
    h.verify.mockReturnValueOnce({ ok: false, reason: "signature_mismatch_v2" });
    const res = await post(event);
    expect(res.status).toBe(401);
    expect(h.createEvent).not.toHaveBeenCalled();
  });
});

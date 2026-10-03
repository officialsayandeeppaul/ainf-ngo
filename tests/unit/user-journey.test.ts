import { describe, expect, it } from "vitest";
import { buildUserJourney, journeyKindForAction } from "@/lib/user-journey";

describe("journeyKindForAction", () => {
  it("keeps ID card issue on the membership track", () => {
    expect(journeyKindForAction("membership.card_issued")).toBe("membership");
  });
});

describe("buildUserJourney", () => {
  it("starts at registration and orders every later event", () => {
    const registered = new Date("2026-08-01T08:00:00.000Z");
    const paid = new Date("2026-09-03T10:00:00.000Z");
    const events = buildUserJourney({
      createdAt: registered,
      lastSeenAt: new Date("2026-09-03T11:00:00.000Z"),
      kyc: [{ createdAt: new Date("2026-08-02T09:00:00.000Z"), status: "APPROVED", sessionNumber: 1 }],
      pan: [{ createdAt: new Date("2026-08-03T09:00:00.000Z"), status: "VERIFIED", panLast4: "1234" }],
      orders: [
        {
          createdAt: new Date("2026-09-03T09:55:00.000Z"),
          paidAt: paid,
          cancelledAt: null,
          status: "PAID",
          interval: "MONTHLY",
          amountLabel: "₹199",
          tierName: "Friend of AINF",
          recurring: true,
        },
      ],
      audit: [
        {
          createdAt: registered,
          action: "user.created",
          success: true,
          metadata: {},
        },
        {
          createdAt: new Date("2026-09-04T10:00:00.000Z"),
          action: "membership.expired",
          success: true,
          metadata: { previousExpiresAt: "2026-09-04T10:00:00.000Z" },
        },
      ],
    });

    expect(events[0]).toMatchObject({ title: "Registered", tone: "ok" });
    expect(events.map((event) => event.title)).toEqual([
      "Registered",
      "Didit approved",
      "PAN verified",
      "Checkout started",
      "Payment captured",
      "Last seen",
      "Membership ended",
    ]);
    expect(events.find((event) => event.title === "Membership ended")?.detail).toContain("Previous end");
  });

  it("records a later recurring charge as its own payment without a checkout row", () => {
    const charged = new Date("2026-10-04T10:00:00.000Z");
    const events = buildUserJourney({
      createdAt: new Date("2026-08-01T08:00:00.000Z"),
      lastSeenAt: null,
      kyc: [],
      pan: [],
      orders: [
        {
          createdAt: charged,
          paidAt: charged,
          cancelledAt: null,
          status: "PAID",
          interval: "MONTHLY",
          amountLabel: "₹199",
          tierName: "Friend of AINF",
          recurring: true,
        },
      ],
      audit: [],
    });
    expect(events.filter((event) => event.title === "Payment captured")).toHaveLength(1);
    expect(events.some((event) => event.title === "Checkout started")).toBe(false);
  });

  it("keeps redundant audit rows when CRM asks for the full trail", () => {
    const registered = new Date("2026-08-01T08:00:00.000Z");
    const events = buildUserJourney(
      {
        createdAt: registered,
        lastSeenAt: null,
        kyc: [],
        pan: [],
        orders: [],
        audit: [
          { createdAt: registered, action: "user.created", success: true, metadata: {} },
          {
            createdAt: new Date("2026-09-03T09:00:00.000Z"),
            action: "membership.order_created",
            success: true,
            metadata: { amountPaise: 19900 },
          },
        ],
      },
      { includeRedundantAudit: true }
    );
    expect(events.map((event) => event.title)).toEqual([
      "Registered",
      "User created",
      "Membership order",
    ]);
  });

  it("classifies audit actions into lifecycle kinds", () => {
    expect(journeyKindForAction("kyc.status_changed")).toBe("identity");
    expect(journeyKindForAction("membership.payment_captured")).toBe("payment");
    expect(journeyKindForAction("membership.cancelled")).toBe("membership");
    expect(journeyKindForAction("security.access_denied")).toBe("access");
    expect(journeyKindForAction("admin.bootstrap_succeeded")).toBe("admin");
  });
});

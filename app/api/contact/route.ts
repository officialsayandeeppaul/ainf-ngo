import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendAdminAlertEmail } from "@/lib/email";
import { isDatabaseConfigured } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    message: z.string().optional(),
    Name: z.string().optional(),
    Email: z.string().optional(),
    "Phone Number": z.string().optional(),
    Message: z.string().optional(),
  })
  .passthrough();

function pick(raw: Record<string, unknown>) {
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return {
    name: str(raw.name) || str(raw.Name),
    email: (str(raw.email) || str(raw.Email)).toLowerCase(),
    phone: str(raw.phone) || str(raw["Phone Number"]) || null,
    body: str(raw.message) || str(raw.Message),
  };
}

const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public contact-us form → admin inbox. */
export async function POST(request: Request) {
  if (!isDatabaseConfigured) {
    return Response.json(
      { error: "not_configured", message: "Messaging is temporarily unavailable." },
      { status: 503 }
    );
  }

  const context = contextFromRequest(request);
  const throttle = await checkRateLimit("contact", `contact:${context.ip}`);
  if (!throttle.success) return rateLimitResponse(throttle, "contact");

  let raw: Record<string, unknown>;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      raw = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      raw = Object.fromEntries(form.entries());
    }
  } catch {
    return Response.json({ error: "invalid_input", message: "Invalid request." }, { status: 400 });
  }

  try {
    bodySchema.parse(raw);
  } catch {
    return Response.json({ error: "invalid_input", message: "Please check the form fields." }, { status: 400 });
  }

  const data = pick(raw);
  if (data.name.length < 2 || !emailOk.test(data.email) || data.body.length < 5) {
    return Response.json(
      { error: "invalid_input", message: "Name, a valid email, and a short message are required." },
      { status: 400 }
    );
  }
  if (data.name.length > 120 || data.email.length > 200 || data.body.length > 4000) {
    return Response.json({ error: "invalid_input", message: "One of the fields is too long." }, { status: 400 });
  }
  if (data.phone && data.phone.length > 40) {
    return Response.json({ error: "invalid_input", message: "Phone number is too long." }, { status: 400 });
  }

  const row = await db.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      body: data.body,
      ip: context.ip === "unknown" ? null : context.ip,
      userAgent: context.userAgent === "unknown" ? null : context.userAgent.slice(0, 400),
    },
  });

  await recordAudit({
    action: AuditAction.ContactMessageReceived,
    success: true,
    targetType: "contact_message",
    targetId: row.id,
    context,
    metadata: { email: data.email, name: data.name },
  });

  void sendAdminAlertEmail({
    subject: "New contact message on AINF",
    headline: "New message from the contact form",
    lines: [
      `From: ${data.name} <${data.email}>`,
      data.phone ? `Phone: ${data.phone}` : "Phone: —",
      `Preview: ${data.body.slice(0, 180)}${data.body.length > 180 ? "…" : ""}`,
      `Open inbox: /admin/messages/${row.id}`,
    ],
  });

  return Response.json({ ok: true, id: row.id, message: "Thank you — your message reached AINF." });
}

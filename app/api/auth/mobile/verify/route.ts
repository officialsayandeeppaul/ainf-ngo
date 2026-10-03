import { z } from "zod";
import { acceptMobileOtp, indianMobile } from "@/lib/mobile-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(10).max(16),
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const context = contextFromRequest(request);
  const limit = await checkRateLimit("otpVerify", `mobile-verify:${context.ip}`);
  if (!limit.success) return rateLimitResponse(limit, "otpVerify");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_input", message: "Enter the 6-digit code." }, { status: 400 });
  }

  const phone = indianMobile(input.phone);
  if (!phone) {
    return Response.json({ error: "invalid_input", message: "Enter a valid mobile number." }, { status: 400 });
  }

  const accepted = await acceptMobileOtp(phone, input.code);
  if (!accepted.ok) {
    const message =
      accepted.reason === "locked"
        ? "Too many tries. Request a new code."
        : accepted.reason === "missing"
          ? "That code expired. Request a new one."
          : "That code does not match.";
    return Response.json({ error: accepted.reason, message }, { status: 400 });
  }

  return Response.json({ ok: true, setupToken: accepted.setupToken });
}

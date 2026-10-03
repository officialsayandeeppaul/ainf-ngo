import { KycStatus, PanStatus, Role } from "@prisma/client";
import { z } from "zod";
import { AuditAction, recordAudit } from "@/lib/audit";
import { guardApi } from "@/lib/auth/guard";
import { ApitxtError, isValidDob, isValidPanFormat, normaliseDob, normalisePan, panVerify } from "@/lib/apitxt";
import { saltedHash } from "@/lib/crypto";
import { db } from "@/lib/db";
import { MissingConfigError, env, isApitxtConfigured, requirePanSaltEnv } from "@/lib/env";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { promoteToVerified } from "@/lib/auth/role-service";
import { contextFromRequest } from "@/lib/request-context";

/**
 * PAN verification.
 *
 * The raw PAN never leaves this handler: it goes to APITXT over TLS and is
 * persisted only as a salted SHA-256 hash plus the last four characters, which
 * is enough to detect reuse across accounts without holding the number itself.
 *
 * Limited to 3 attempts per day per user because each success spends a
 * non-refundable vendor credit.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pan: z
    .string()
    .trim()
    .min(10)
    .max(10)
    .transform(normalisePan)
    .refine(isValidPanFormat, "PAN must look like ABCDE1234F"),
  name: z.string().trim().min(2).max(120),
  dob: z
    .string()
    .trim()
    .transform(normaliseDob)
    .refine(isValidDob, "Date of birth must be a real date in DD/MM/YYYY or DD-MM-YYYY"),
});

export async function POST(request: Request) {
  const guard = await guardApi({ required: Role.USER, limiter: "panVerify" });
  if (!guard.ok) return guard.response;

  const { ctx } = guard;
  const context = contextFromRequest(request);

  if (!isApitxtConfigured) {
    return Response.json(
      { error: "not_configured", keys: ["APITXT_AUTH_KEY"] },
      { status: 503 }
    );
  }

  const policy = getVerificationPolicy();
  if (!policy.pan) {
    return Response.json({ error: "not_enabled", message: "PAN verification is not enabled." }, { status: 404 });
  }

  if (policy.didit && ctx.user.kycStatus !== KycStatus.APPROVED) {
    return Response.json(
      {
        error: "identity_required",
        message: "Complete identity document verification before submitting a PAN.",
      },
      { status: 403 }
    );
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid details.")
        : "Invalid request body.";
    return Response.json({ error: "invalid_input", message }, { status: 400 });
  }

  try {
    requirePanSaltEnv();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return Response.json({ error: "not_configured", keys: error.keys }, { status: 503 });
    }
    throw error;
  }

  const panHash = saltedHash(input.pan, env.PAN_HASH_SALT!);
  const panLast4 = input.pan.slice(-4);

  // Same PAN already verified on a different account is a strong fraud signal.
  const conflicting = await db.panVerification.findFirst({
    where: { panHash, status: PanStatus.VERIFIED, userId: { not: ctx.user.id } },
  });
  if (conflicting) {
    await recordAudit({
      action: AuditAction.PanVerifyFailed,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: { reason: "pan_already_linked", panLast4 },
    });
    return Response.json(
      {
        error: "pan_already_linked",
        message: "This PAN is already linked to another verified account.",
      },
      { status: 409 }
    );
  }

  await recordAudit({
    action: AuditAction.PanVerifyAttempted,
    actorUserId: ctx.user.id,
    actorClerkId: ctx.clerkId,
    actorRole: ctx.role,
    context,
    metadata: { panLast4 },
  });

  try {
    const result = await panVerify({ pan: input.pan, name: input.name, dob: input.dob });

    const status = result.matched ? PanStatus.VERIFIED : PanStatus.MISMATCH;

    await db.panVerification.create({
      data: {
        userId: ctx.user.id,
        panHash,
        panLast4,
        status,
        requestId: result.requestId,
        nameMatch: result.nameMatch,
        dobMatch: result.dobMatch,
        panStatusText: result.panStatusText,
        category: result.category,
        aadhaarSeedingStatus: result.aadhaarSeedingStatus,
      },
    });

    if (status === PanStatus.VERIFIED) {
      await db.user.update({
        where: { id: ctx.user.id },
        data: {
          panVerified: true,
          ...(!policy.didit ? { kycStatus: KycStatus.APPROVED } : {}),
        },
      });
      if (!policy.didit) {
        await promoteToVerified({
          targetUserId: ctx.user.id,
          reason: "pan_verified",
          context,
        });
      }
    }

    await recordAudit({
      action: result.matched ? AuditAction.PanVerifySucceeded : AuditAction.PanVerifyFailed,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: result.matched,
      context,
      metadata: {
        panLast4,
        nameMatch: result.nameMatch,
        dobMatch: result.dobMatch,
        aadhaarSeedingStatus: result.aadhaarSeedingStatus,
      },
    });

    return Response.json({
      status,
      nameMatch: result.nameMatch,
      dobMatch: result.dobMatch,
      aadhaarSeedingStatus: result.aadhaarSeedingStatus,
      // PAN alone can grant verified standing when Didit is switched off.
      // When Didit is on, it remains the identity decision; PAN is a second check.
      message: result.matched
        ? "PAN verified successfully."
        : "The PAN exists but the name or date of birth did not match.",
    });
  } catch (error) {
    const apitxt = error instanceof ApitxtError ? error : null;

    await db.panVerification.create({
      data: {
        userId: ctx.user.id,
        panHash,
        panLast4,
        status: PanStatus.FAILED,
        failureCode: apitxt?.code ?? null,
        failureMessage: apitxt?.kind ?? "unknown",
      },
    });

    await recordAudit({
      action: AuditAction.PanVerifyFailed,
      actorUserId: ctx.user.id,
      actorClerkId: ctx.clerkId,
      actorRole: ctx.role,
      success: false,
      context,
      metadata: { panLast4, kind: apitxt?.kind ?? "unknown", code: apitxt?.code ?? null },
    });

    if (apitxt) {
      // 400 for the user's mistake, 503 when the fault is ours or the vendor's.
      const status = apitxt.kind === "invalid_pan" ? 400 : apitxt.retryable ? 503 : 502;
      return Response.json(
        { error: apitxt.kind, message: apitxt.message, retryable: apitxt.retryable },
        { status }
      );
    }

    console.error("[kyc/pan] unexpected failure", error);
    return Response.json(
      { error: "verification_failed", message: "PAN verification failed. Please try again." },
      { status: 502 }
    );
  }
}

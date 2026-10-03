import { Resend } from "resend";
import { formatInr } from "./membership";
import type { User } from "@prisma/client";
import {
  absoluteUrl,
  env,
  isResendConfigured,
  isResendSandbox,
  resendSandboxToEmail,
} from "./env";

/**
 * Transactional email via Resend.
 *
 * Every send is best-effort from the caller's perspective: `deliver` returns a
 * result object instead of throwing, because a bounced notification must never
 * roll back a verification decision or fail a webhook.
 */

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!isResendConfigured) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY!);
  return client;
}

export type EmailResult = {
  sent: boolean;
  id?: string;
  error?: string;
  /** Soft delivery limits (Resend sandbox) — caller may still persist the action. */
  code?: "not_configured" | "sandbox_recipient" | "provider";
};

export function describeResendDelivery(to: string): {
  canEmail: boolean;
  sandbox: boolean;
  hint: string | null;
} {
  if (!isResendConfigured) {
    return { canEmail: false, sandbox: false, hint: "Resend is not configured." };
  }
  if (!isResendSandbox) {
    return { canEmail: true, sandbox: false, hint: null };
  }
  const target = to.trim().toLowerCase();
  if (resendSandboxToEmail && target === resendSandboxToEmail) {
    return {
      canEmail: true,
      sandbox: true,
      hint: `Test mode: email can only go to ${resendSandboxToEmail} until a custom domain is verified.`,
    };
  }
  return {
    canEmail: false,
    sandbox: true,
    hint: resendSandboxToEmail
      ? `Test mode (onboarding@resend.dev): Resend only delivers to ${resendSandboxToEmail}. Reply will be saved in the inbox; set RESEND_FROM_EMAIL to your verified domain to email anyone.`
      : "Test mode (onboarding@resend.dev): Resend only delivers to your Resend account email. Set RESEND_SANDBOX_TO_EMAIL or verify a domain, or save the reply without email.",
  };
}

async function deliver(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] skipped "${params.subject}" — RESEND_API_KEY not set`);
    return { sent: false, error: "not_configured", code: "not_configured" };
  }

  const policy = describeResendDelivery(params.to);
  if (!policy.canEmail) {
    console.warn(`[email] skipped "${params.subject}" — ${policy.hint}`);
    return {
      sent: false,
      error: policy.hint ?? "Cannot deliver to this recipient with the current Resend setup.",
      code: "sandbox_recipient",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error(`[email] Resend rejected "${params.subject}"`, error);
      const message = error.message || "Resend rejected the email.";
      const sandbox =
        /only send testing emails|verify a domain|resend\.com\/domains/i.test(message);
      return {
        sent: false,
        error: message,
        code: sandbox ? "sandbox_recipient" : "provider",
      };
    }
    return { sent: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] send failed "${params.subject}"`, error);
    return { sent: false, error: message, code: "provider" };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(
  body: string,
  cta?: { href: string; label: string },
  note = "You are receiving this because you have an AINF account. This is an automated message — please do not reply."
): string {
  const button = cta
    ? `<p style="margin:28px 0 0"><a href="${cta.href}" style="display:inline-block;background:#39a46b;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:400;font-size:14px">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f8f7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border:1px solid #e2e7e4;border-radius:14px;padding:32px;font-family:Onest,Inter,-apple-system,'Segoe UI',sans-serif;color:#1a1d1b;line-height:1.55">
        <tr><td>
          <p style="margin:0 0 24px;font-size:15px;font-weight:500;color:#39a46b">AINF</p>
          ${body}
          ${button}
          <hr style="border:0;border-top:1px solid #e2e7e4;margin:32px 0 16px">
          <p style="margin:0;font-size:12px;color:#8a938d">
            ${escapeHtml(note)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function greeting(user: Pick<User, "firstName">): string {
  return user.firstName ? `Hi ${escapeHtml(user.firstName)},` : "Hi,";
}

export function sendKycApprovedEmail(user: Pick<User, "email" | "firstName">) {
  const href = absoluteUrl("/account");
  return deliver({
    to: user.email,
    subject: "Your AINF identity verification is approved",
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Verification approved</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${greeting(user)}</p>
       <p style="margin:0;font-size:14.5px;color:#5c6660">Your identity has been verified successfully. Your account is now a verified member account, which unlocks the member-only areas of your dashboard.</p>`,
      { href, label: "Open your dashboard" }
    ),
    text: `Verification approved\n\n${user.firstName ? `Hi ${user.firstName},` : "Hi,"}\n\nYour identity has been verified successfully. Your account is now a verified member account.\n\nOpen your dashboard: ${href}`,
  });
}

/** Sent once when an account is first created (Clerk user.created webhook). */
export function sendWelcomeEmail(user: Pick<User, "email" | "firstName">) {
  const href = absoluteUrl("/account");
  return deliver({
    to: user.email,
    subject: "Welcome to AINF",
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Welcome to AINF</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${greeting(user)}</p>
       <p style="margin:0 0 12px;font-size:14.5px;color:#5c6660">Thank you for creating an AINF account. From your dashboard you can verify your identity, join as a member, and keep every gift receipt in one place.</p>
       <p style="margin:0;font-size:14.5px;color:#5c6660">If you did not create this account, please let us know.</p>`,
      { href, label: "Open your dashboard" }
    ),
    text: `Welcome to AINF\n\n${user.firstName ? `Hi ${user.firstName},` : "Hi,"}\n\nThank you for creating an AINF account. From your dashboard you can verify your identity, join as a member, and keep every gift receipt in one place.\n\nOpen your dashboard: ${href}`,
  });
}

/** Payment confirmation for a membership term (checkout confirm + webhook). */
export function sendMembershipReceiptEmail(params: {
  to: string;
  firstName: string | null;
  tierName: string;
  amountPaise: number;
  interval: "MONTHLY" | "YEARLY";
  expiresAt: Date;
}): Promise<EmailResult> {
  const href = absoluteUrl("/account/membership");
  const hi = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : "Hi,";
  const amount = formatInr(params.amountPaise);
  const term = params.interval === "YEARLY" ? "yearly" : "monthly";
  const until = params.expiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return deliver({
    to: params.to,
    subject: `Your AINF ${escapeHtml(params.tierName)} membership is active`,
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Membership active</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${hi}</p>
       <p style="margin:0 0 12px;font-size:14.5px;color:#5c6660">Thank you. We have received your ${escapeHtml(term)} payment of <strong style="font-weight:500;color:#1a1d1b">${escapeHtml(amount)}</strong> for the <strong style="font-weight:500;color:#1a1d1b">${escapeHtml(params.tierName)}</strong> membership. Your badge is live until <strong style="font-weight:500;color:#1a1d1b">${escapeHtml(until)}</strong>.</p>
       <p style="margin:0;font-size:14.5px;color:#5c6660">Your membership card is ready to view and print from your account.</p>`,
      { href, label: "View your membership" }
    ),
    text: `Membership active\n\n${params.firstName ? `Hi ${params.firstName},` : "Hi,"}\n\nThank you. We have received your ${term} payment of ${amount} for the ${params.tierName} membership. Your badge is live until ${until}.\n\nView your membership: ${href}`,
  });
}

export function sendKycDeclinedEmail(
  user: Pick<User, "email" | "firstName">,
  reason?: string | null
) {
  const href = absoluteUrl("/account/verify");
  const reasonBlock = reason
    ? `<p style="margin:0 0 12px;font-size:14px;color:#5c6660"><strong style="font-weight:500">Reason given:</strong> ${escapeHtml(reason)}</p>`
    : "";
  return deliver({
    to: user.email,
    subject: "We could not verify your identity",
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Verification not completed</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${greeting(user)}</p>
       <p style="margin:0 0 12px;font-size:14.5px;color:#5c6660">We were not able to verify your identity from the documents provided. Your account remains active as a standard member.</p>
       ${reasonBlock}
       <p style="margin:0;font-size:14.5px;color:#5c6660">You can start a new verification attempt whenever you are ready. Make sure your document is well lit, fully in frame, and not expired.</p>`,
      { href, label: "Try again" }
    ),
    text: `Verification not completed\n\n${user.firstName ? `Hi ${user.firstName},` : "Hi,"}\n\nWe were not able to verify your identity from the documents provided.${reason ? `\n\nReason given: ${reason}` : ""}\n\nTry again: ${href}`,
  });
}

/** Security alert for privileged events. Goes to SECURITY_ALERT_EMAIL. */
export function sendAdminAlertEmail(params: {
  subject: string;
  headline: string;
  lines: string[];
}): Promise<EmailResult> {
  const to = env.SECURITY_ALERT_EMAIL;
  if (!to) {
    console.warn(`[email] skipped admin alert "${params.subject}" — SECURITY_ALERT_EMAIL not set`);
    return Promise.resolve({ sent: false, error: "no_recipient" });
  }
  const rows = params.lines
    .map(
      (line) =>
        `<li style="margin-bottom:6px;font-size:13.5px;color:#5c6660">${escapeHtml(line)}</li>`
    )
    .join("");
  return deliver({
    to,
    subject: params.subject,
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:20px;font-weight:500;letter-spacing:-0.02em">${escapeHtml(params.headline)}</h1>
       <ul style="margin:0;padding-left:18px">${rows}</ul>`
    ),
    text: `${params.headline}\n\n${params.lines.join("\n")}`,
  });
}

export function sendOtpEmail(params: {
  to: string;
  firstName?: string | null;
  code: string;
}): Promise<EmailResult> {
  const name = params.firstName ? `Hi ${escapeHtml(params.firstName)},` : "Hi,";
  return deliver({
    to: params.to,
    subject: `${params.code} is your AINF verification code`,
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Your verification code</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${name}</p>
       <p style="margin:0 0 18px;font-size:14.5px;color:#5c6660">Use this code to finish verifying your AINF account. It expires in ten minutes.</p>
       <p style="margin:0;font-size:28px;letter-spacing:0.18em;font-weight:500">${escapeHtml(params.code)}</p>`
    ),
    text: `Your AINF verification code is ${params.code}. It expires in ten minutes.`,
  });
}

/** Standard AINF reply to a public contact-us message. */
export function sendContactReplyEmail(params: {
  to: string;
  name: string;
  originalMessage: string;
  replyBody: string;
}): Promise<EmailResult> {
  const first = params.name.trim().split(/\s+/)[0] || "";
  const hello = first ? `Dear ${escapeHtml(first)},` : "Dear friend,";
  const replyHtml = escapeHtml(params.replyBody).replace(/\n/g, "<br>");
  const originalHtml = escapeHtml(params.originalMessage).replace(/\n/g, "<br>");
  return deliver({
    to: params.to,
    subject: "Reply from All India Nevarlands Foundation (AINF)",
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Message from AINF</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${hello}</p>
       <p style="margin:0 0 16px;font-size:14.5px;color:#5c6660">Thank you for writing to All India Nevarlands Foundation. Here is our reply:</p>
       <div style="margin:0 0 20px;padding:14px 16px;border-radius:12px;background:#f6f8f7;border:1px solid #e2e7e4;font-size:14.5px;color:#1a1d1b">${replyHtml}</div>
       <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#8a938d">Your original message</p>
       <div style="margin:0;padding:12px 14px;border-radius:12px;background:#ffffff;border:1px dashed #d5dbd7;font-size:13.5px;color:#5c6660">${originalHtml}</div>
       <p style="margin:20px 0 0;font-size:14px;color:#5c6660">With care,<br>Team AINF<br>hello@theainf.in · Nala, Jamtara, Jharkhand</p>`
    ),
    text: `Reply from AINF\n\n${first ? `Dear ${first},` : "Dear friend,"}\n\nThank you for writing to All India Nevarlands Foundation. Here is our reply:\n\n${params.replyBody}\n\n—\nYour original message:\n${params.originalMessage}\n\nWith care,\nTeam AINF\nhello@theainf.in`,
  });
}

const GIFT_NOTE =
  "You are receiving this because you gave a gift to All India Nevarlands Foundation. This is an automated message — please do not reply.";

export function sendDonationReceiptEmail(params: {
  to: string;
  name: string;
  amountPaise: number;
  targetTitle: string;
  receiptUrl: string;
}): Promise<EmailResult> {
  const first = params.name.trim().split(/\s+/)[0] || "";
  const hello = first ? `Dear ${escapeHtml(first)},` : "Dear friend,";
  const amount = formatInr(params.amountPaise);
  return deliver({
    to: params.to,
    subject: `Your AINF gift receipt — ${amount}`,
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Gift received</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${hello}</p>
       <p style="margin:0 0 12px;font-size:14.5px;color:#5c6660">Thank you. Your gift of <strong style="font-weight:500;color:#1a1d1b">${escapeHtml(amount)}</strong> for ${escapeHtml(params.targetTitle)} has been received. This is a gift, not a membership.</p>`,
      { href: params.receiptUrl, label: "Open your receipt" },
      GIFT_NOTE
    ),
    text: `Gift received\n\n${first ? `Dear ${first},` : "Dear friend,"}\n\nThank you. Your gift of ${amount} for ${params.targetTitle} has been received. This is a gift, not a membership.\n\nReceipt: ${params.receiptUrl}`,
  });
}

export function sendDonationRefundEmail(params: {
  to: string;
  name: string;
  amountPaise: number;
  targetTitle: string;
}): Promise<EmailResult> {
  const first = params.name.trim().split(/\s+/)[0] || "";
  const hello = first ? `Dear ${escapeHtml(first)},` : "Dear friend,";
  const amount = formatInr(params.amountPaise);
  return deliver({
    to: params.to,
    subject: `Your AINF gift of ${amount} was returned`,
    html: shell(
      `<h1 style="margin:0 0 14px;font-size:21px;font-weight:500;letter-spacing:-0.02em">Gift returned</h1>
       <p style="margin:0 0 12px;font-size:14.5px">${hello}</p>
       <p style="margin:0;font-size:14.5px;color:#5c6660">The gift of <strong style="font-weight:500;color:#1a1d1b">${escapeHtml(amount)}</strong> for ${escapeHtml(params.targetTitle)} has been returned in full. It can take a few working days to show on your statement.</p>`,
      undefined,
      GIFT_NOTE
    ),
    text: `Gift returned\n\n${first ? `Dear ${first},` : "Dear friend,"}\n\nThe gift of ${amount} for ${params.targetTitle} has been returned in full.`,
  });
}

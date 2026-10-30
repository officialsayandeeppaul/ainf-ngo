import type { User } from "@prisma/client";
import { sendSms } from "./apitxt";
import { sendAccountReinstatedEmail, sendAccountSuspendedEmail } from "./email";
import { env } from "./env";
import {
  reinstatedSmsText,
  suspensionEndLabel,
  suspensionNoticeChannel,
  suspensionSmsText,
} from "./suspension";

export type SuspensionNoticeResult = {
  channel: "email" | "sms" | null;
  sent: boolean;
  error: string | null;
};

/**
 * Tells the member their account was suspended (why, and until when) or
 * reinstated. Email for email accounts, SMS for mobile-number accounts.
 * Never throws: a failed notice must not undo the admin's decision.
 */
export async function sendSuspensionNotice(
  user: Pick<User, "email" | "phone" | "firstName">,
  notice: { kind: "suspended"; reason: string; until: Date | null } | { kind: "reinstated" }
): Promise<SuspensionNoticeResult> {
  const channel = suspensionNoticeChannel(user);
  if (!channel) return { channel: null, sent: false, error: "no_contact" };
  try {
    if (channel === "email") {
      const result =
        notice.kind === "suspended"
          ? await sendAccountSuspendedEmail({
              to: user.email,
              firstName: user.firstName,
              reason: notice.reason,
              endLabel: suspensionEndLabel(notice.until),
            })
          : await sendAccountReinstatedEmail({ to: user.email, firstName: user.firstName });
      return { channel, sent: result.sent, error: result.sent ? null : (result.error ?? "not_sent") };
    }
    const result = await sendSms({
      to: user.phone!,
      message: notice.kind === "suspended" ? suspensionSmsText(notice) : reinstatedSmsText(),
      templateId: env.APITXT_DLT_SUSPEND_TEMPLATE_ID,
    });
    return { channel, sent: result.sent, error: result.sent ? null : (result.error ?? "not_sent") };
  } catch (error) {
    console.error("[suspension] notice failed", error);
    return { channel, sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

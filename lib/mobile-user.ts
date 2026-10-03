import { KycStatus, Role, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { e164India, mobileAccountEmail } from "@/lib/mobile-auth";

export async function findMobileAccount(phone10: string) {
  const phone = e164India(phone10);
  const email = mobileAccountEmail(phone10);
  return db.user.findFirst({
    where: { OR: [{ phone }, { email }] },
    select: { clerkId: true, firstName: true },
  });
}

export async function ensureMobileUser(input: {
  clerkId: string;
  phone10: string;
  firstName: string | null;
}) {
  const email = mobileAccountEmail(input.phone10);
  const phone = e164India(input.phone10);
  const existing = await db.user.findUnique({ where: { clerkId: input.clerkId } });
  if (existing) {
    await db.user.update({
      where: { clerkId: input.clerkId },
      data: { phone, firstName: input.firstName ?? existing.firstName },
    });
    return;
  }
  await db.user.upsert({
    where: { email },
    update: { clerkId: input.clerkId, phone, firstName: input.firstName },
    create: {
      clerkId: input.clerkId,
      email,
      phone,
      firstName: input.firstName,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.NOT_STARTED,
    },
  });
}

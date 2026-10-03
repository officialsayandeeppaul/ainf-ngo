import { Role } from "@prisma/client";
import { guardApi } from "@/lib/auth/guard";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 10;

function memberLabel(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

/** Lightweight member picker for admin filters — never returns more than 10 rows. */
export async function GET(request: Request) {
  const guard = await guardApi({ required: Role.SUPER_ADMIN, limiter: "adminRead" });
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? LIMIT) || LIMIT));

  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    take: limit,
  });

  return Response.json({
    options: users.map((user) => ({
      value: user.id,
      label: memberLabel(user),
      hint: user.email,
    })),
  });
}

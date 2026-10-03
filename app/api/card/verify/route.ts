import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { lookupMembershipCard } from "@/lib/membership-card";
import { cardVerifyCopy } from "@/lib/membership-card-art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("c");
  const result = await lookupMembershipCard(token);
  const copy = cardVerifyCopy(result.kind);
  return NextResponse.json({
    live: result.live,
    status: result.kind,
    title: copy.title,
    message: copy.body,
    name: result.name,
    designation: result.designation,
    badge: result.badge,
    validUntil: result.validUntil?.toISOString() ?? null,
  });
}

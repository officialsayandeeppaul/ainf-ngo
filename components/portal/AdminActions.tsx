"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role, UserStatus } from "@prisma/client";
import { ConfirmDialog } from "@/components/portal/ConfirmDialog";
import { PortalSelect } from "@/components/portal/PortalSelect";

const ROLE_LABEL: Record<Role, string> = {
  [Role.USER]: "Member",
  [Role.VERIFIED_USER]: "Verified member",
  [Role.SUPER_ADMIN]: "Super admin",
};

const ROLE_OPTIONS = [
  { value: Role.USER, label: "Member" },
  { value: Role.VERIFIED_USER, label: "Verified" },
  { value: Role.SUPER_ADMIN, label: "Super admin" },
];

async function patchUser(id: string, body: unknown) {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

/** Role selector plus suspend/reinstate for one user row. Changes always ask first. */
export function UserRowActions({
  userId,
  role,
  status,
  isSelf,
}: {
  userId: string;
  role: Role;
  status: UserStatus;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRole, setNextRole] = useState<Role | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);

  useEffect(() => {
    setNextRole(null);
    setSuspendOpen(false);
    setReinstateOpen(false);
    setError(null);
  }, [role, status, userId]);

  if (isSelf) {
    return <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Your own account</span>;
  }

  async function run(body: unknown) {
    setBusy(true);
    setError(null);
    const { ok, payload } = await patchUser(userId, body);
    setBusy(false);
    if (!ok) {
      setError(payload?.message ?? "Action failed.");
      return;
    }
    setNextRole(null);
    setSuspendOpen(false);
    setReinstateOpen(false);
    startTransition(() => router.refresh());
  }

  const suspended = status !== UserStatus.ACTIVE;
  const disabled = busy || pending;
  const rolePending = Boolean(nextRole && nextRole !== role);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <PortalSelect
          size="sm"
          value={nextRole ?? role}
          disabled={disabled}
          ariaLabel="Role"
          options={ROLE_OPTIONS}
          onChange={(value) => {
            const next = value as Role;
            if (next === role) {
              setNextRole(null);
              return;
            }
            setNextRole(next);
          }}
        />

        <button
          type="button"
          className={`pt-btn pt-btn--sm ${suspended ? "pt-btn--secondary" : "pt-btn--danger"}`}
          disabled={disabled}
          onClick={() => (suspended ? setReinstateOpen(true) : setSuspendOpen(true))}
        >
          {suspended ? "Reinstate" : "Suspend"}
        </button>
      </div>
      {error ? (
        <span style={{ fontSize: 12, color: "var(--danger)", textAlign: "right", maxWidth: 220 }}>
          {error}
        </span>
      ) : null}

      <ConfirmDialog
        open={rolePending}
        title="Confirm role change"
        body={
          nextRole
            ? `Change this account from ${ROLE_LABEL[role]} to ${ROLE_LABEL[nextRole]}? The change is audited and takes effect immediately.`
            : undefined
        }
        confirmLabel="Yes, change role"
        cancelLabel="Cancel"
        tone={nextRole === Role.SUPER_ADMIN ? "danger" : "primary"}
        busy={disabled}
        onCancel={() => setNextRole(null)}
        onConfirm={() => {
          if (nextRole) void run({ action: "setRole", role: nextRole });
        }}
      />
      <ConfirmDialog
        open={suspendOpen}
        title="Suspend this account?"
        body="They will not be able to use the portal until you reinstate them. The change is audited."
        confirmLabel="Yes, suspend"
        tone="danger"
        busy={disabled}
        onCancel={() => setSuspendOpen(false)}
        onConfirm={() =>
          void run({
            action: "setStatus",
            status: UserStatus.SUSPENDED,
            reason: "Suspended by administrator",
          })
        }
      />
      <ConfirmDialog
        open={reinstateOpen}
        title="Reinstate this account?"
        body="They can sign in and use the portal again. The change is audited."
        confirmLabel="Yes, reinstate"
        busy={disabled}
        onCancel={() => setReinstateOpen(false)}
        onConfirm={() => void run({ action: "setStatus", status: UserStatus.ACTIVE })}
      />
    </div>
  );
}

/** Approve / decline control for the manual verification queue. */
export function KycReviewActions({ kycId }: { kycId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<null | "approve" | "decline">(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: "approve" | "decline") {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/kyc/${kycId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: note.trim() || undefined }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(payload?.message ?? "Action failed.");
      return;
    }
    setOpen(null);
    setNote("");
    startTransition(() => router.refresh());
  }

  const disabled = busy || pending;

  return (
    <>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="pt-btn pt-btn--sm pt-btn--primary"
          disabled={disabled}
          onClick={() => setOpen("approve")}
        >
          Approve
        </button>
        <button
          type="button"
          className="pt-btn pt-btn--sm pt-btn--secondary"
          disabled={disabled}
          onClick={() => setOpen("decline")}
        >
          Decline
        </button>
      </div>
      <ConfirmDialog
        open={open === "approve"}
        title="Approve this verification?"
        body="The member becomes a verified user. You can add an optional note for the audit log."
        confirmLabel="Yes, approve"
        busy={disabled}
        onCancel={() => {
          setOpen(null);
          setNote("");
          setError(null);
        }}
        onConfirm={() => void submit("approve")}
      >
        <label className="pt-label" htmlFor={`note-approve-${kycId}`}>
          Note (optional)
        </label>
        <textarea
          id={`note-approve-${kycId}`}
          className="pt-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === "decline"}
        title="Decline this verification?"
        body="The member is emailed. Add a reason they can act on."
        confirmLabel="Yes, decline"
        tone="danger"
        busy={disabled}
        confirmDisabled={note.trim().length < 3}
        onCancel={() => {
          setOpen(null);
          setNote("");
          setError(null);
        }}
        onConfirm={() => {
          if (note.trim().length >= 3) void submit("decline");
        }}
      >
        <label className="pt-label" htmlFor={`note-decline-${kycId}`}>
          Reason
        </label>
        <textarea
          id={`note-decline-${kycId}`}
          className="pt-textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Shared with the member by email"
        />
        {error ? <p className="pt-alert pt-alert--error">{error}</p> : null}
      </ConfirmDialog>
    </>
  );
}

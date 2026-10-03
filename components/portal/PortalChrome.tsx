import Link from "next/link";
import { Role } from "@prisma/client";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { AinfBrand } from "./AinfBrand";

type NavItem = { href: string; label: string };

function navFor(role: Role | null): NavItem[] {
  if (role === Role.SUPER_ADMIN) {
    return [
      { href: "/admin", label: "Overview" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/crm", label: "CRM" },
      { href: "/admin/kyc", label: "Verification queue" },
      { href: "/admin/audit", label: "Audit log" },
      { href: "/account", label: "My account" },
    ];
  }
  if (role === Role.VERIFIED_USER) {
    return [
      { href: "/account", label: "Overview" },
      { href: "/account/verify", label: "Verification" },
    ];
  }
  if (role === Role.USER) {
    return [
      { href: "/account", label: "Overview" },
      { href: "/account/verify", label: "Get verified" },
    ];
  }
  return [];
}

export function PortalHeader({
  role,
  currentPath,
  userSlot,
}: {
  role: Role | null;
  currentPath?: string;
  userSlot?: React.ReactNode;
}) {
  const items = navFor(role);
  return (
    <header className="pt-header">
      <div className="pt-header__inner">
        <AinfBrand />

        <nav className="pt-nav" aria-label="Portal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pt-nav__link"
              aria-current={currentPath === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {userSlot}
        </nav>
      </div>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="pt-footer">
      <Link href="/">Back to theainf.in</Link>
      {" · "}
      <Link href="/legal-pages/terms-conditions">Terms &amp; privacy</Link>
      {" · "}
      <Link href="/contact-us">Contact</Link>
    </footer>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const tone =
    role === Role.SUPER_ADMIN ? "danger" : role === Role.VERIFIED_USER ? "success" : "neutral";
  return (
    <span className={`pt-badge pt-badge--${tone}`}>
      <span className="pt-badge__dot" aria-hidden="true" />
      {ROLE_LABEL[role]}
    </span>
  );
}

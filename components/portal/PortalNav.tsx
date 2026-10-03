"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Role } from "@/lib/prisma-enums-client";
import { AinfBrand } from "./AinfBrand";
import { PortalFooter } from "./PortalChrome";

const SITE_LINKS = [
  { href: "/about-us", label: "About AINF" },
  { href: "/causes", label: "Missions" },
  { href: "/projects", label: "Projects" },
  { href: "/blogs", label: "Stories" },
  { href: "/contact-us", label: "Contact" },
] as const;

const RAIL_KEY = "ainf-dash-rail";

type DashItem = { href: string; label: string };
type DashGroup = { label: string; items: DashItem[] };

export type PortalMethods = { didit: boolean; pan: boolean; otp: boolean };

function verifyLabel(methods?: PortalMethods) {
  if (methods?.otp && !methods.didit && !methods.pan) return "Verify phone";
  return "Get verified";
}

function dashboardGroups(role: Role | null, methods?: PortalMethods): DashGroup[] {
  const showVerify = !methods || methods.didit || methods.pan || methods.otp;
  const verifyHref = { href: "/account/verify", label: verifyLabel(methods) };

  if (role === Role.SUPER_ADMIN) {
    const members: DashItem[] = [
      { href: "/admin", label: "Overview" },
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/gifts", label: "Gifts" },
      { href: "/admin/crm", label: "CRM" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/messages", label: "Messages" },
    ];
    if (!methods || methods.didit) {
      members.push({ href: "/admin/kyc", label: "Verification queue" });
    }

    const you: DashItem[] = [
      { href: "/account/okr", label: "OKRs" },
      { href: "/account/membership", label: "Your plan" },
      { href: "/account/donations", label: "Your giving" },
      { href: "/account", label: "My account" },
    ];
    if (showVerify) you.push({ href: "/account/verify", label: "Verification" });

    return [
      { label: "Members", items: members },
      {
        label: "Money",
        items: [
          { href: "/admin/revenue", label: "Revenue" },
          { href: "/admin/plans", label: "Plans" },
        ],
      },
      {
        label: "System",
        items: [
          { href: "/admin/audit", label: "Audit log" },
          { href: "/admin/settings", label: "Settings" },
        ],
      },
      { label: "You", items: you },
    ];
  }

  if (role === Role.VERIFIED_USER || role === Role.USER) {
    const items: DashItem[] = [
      { href: "/account", label: "Overview" },
      { href: "/account/membership", label: "Your plan" },
      { href: "/account/donations", label: "Your giving" },
      { href: "/account/okr", label: "OKRs" },
    ];
    if (showVerify) {
      items.push(role === Role.USER ? verifyHref : { href: "/account/verify", label: "Verification" });
    }
    return [{ label: "Dashboard", items }];
  }

  return [];
}

function isCurrent(href: string, path?: string) {
  if (!path) return false;
  if (href === "/account") return path === "/account";
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`);
}

function groupForPath(groups: DashGroup[], path?: string) {
  if (!path) return groups[0]?.label ?? null;
  for (const group of groups) {
    if (group.items.some((item) => isCurrent(item.href, path))) return group.label;
  }
  return groups[0]?.label ?? null;
}

export function PortalShell({
  role,
  currentPath,
  userSlot,
  children,
  variant = "auth",
  methods,
  supportBanner,
}: {
  role: Role | null;
  currentPath?: string;
  userSlot?: React.ReactNode;
  children: React.ReactNode;
  variant?: "auth" | "dash";
  methods?: PortalMethods;
  supportBanner?: React.ReactNode;
}) {
  return (
    <PortalNav
      role={role}
      currentPath={currentPath}
      userSlot={userSlot}
      sidebar={variant === "dash"}
      methods={methods}
      supportBanner={supportBanner}
    >
      {children}
    </PortalNav>
  );
}

export function PortalNav({
  role,
  currentPath,
  userSlot,
  sidebar = false,
  methods,
  supportBanner,
  children,
}: {
  role: Role | null;
  currentPath?: string;
  userSlot?: React.ReactNode;
  sidebar?: boolean;
  methods?: PortalMethods;
  supportBanner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const panelId = useId();
  const groups = useMemo(() => dashboardGroups(role, methods), [role, methods]);
  const [openGroup, setOpenGroup] = useState(() => groupForPath(groups, currentPath) ?? groups[0]?.label ?? "");
  const signedIn = Boolean(userSlot);

  useEffect(() => {
    // Prefer the hamburger over a second "Show menu" control — keep the rail open on load.
    try {
      window.sessionStorage.removeItem(RAIL_KEY);
    } catch {
      /* ignore */
    }
    setRailCollapsed(false);
  }, []);

  useEffect(() => {
    const next = groupForPath(groups, currentPath) ?? groups[0]?.label ?? "";
    if (next) setOpenGroup(next);
  }, [currentPath, groups]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const persistRail = useCallback((collapsed: boolean) => {
    setRailCollapsed(collapsed);
    try {
      window.sessionStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const onMenuClick = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      setDrawerOpen((value) => !value);
      return;
    }
    if (sidebar) {
      persistRail(!railCollapsed);
      return;
    }
    setDrawerOpen((value) => !value);
  }, [persistRail, railCollapsed, sidebar]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    closeDrawer();
  }, [currentPath, closeDrawer]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia("(min-width: 901px)").matches) closeDrawer();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [closeDrawer]);

  /* Cursor over sidebar: if the rail has no more to scroll, pass the wheel to main. */
  useEffect(() => {
    if (!sidebar) return;
    const aside = document.getElementById(panelId);
    if (!aside) return;

    const onWheel = (event: WheelEvent) => {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
        return;
      }
      const main = aside.parentElement?.querySelector(".pt-dash__body") as HTMLElement | null;
      if (!main) return;

      const canScrollAside = aside.scrollHeight > aside.clientHeight + 1;
      const goingDown = event.deltaY > 0;
      const atTop = aside.scrollTop <= 0;
      const atBottom = aside.scrollTop + aside.clientHeight >= aside.scrollHeight - 1;
      const asideBlocks = canScrollAside && ((goingDown && !atBottom) || (!goingDown && !atTop));
      if (asideBlocks) return;

      main.scrollTop += event.deltaY;
      event.preventDefault();
    };

    aside.addEventListener("wheel", onWheel, { passive: false });
    return () => aside.removeEventListener("wheel", onWheel);
  }, [sidebar, panelId, railCollapsed]);

  return (
    <div
      className={`${sidebar ? "pt-app pt-app--dash" : "pt-app"}${drawerOpen ? " is-nav-open" : ""}${sidebar && railCollapsed ? " is-rail-collapsed" : ""}${supportBanner ? " has-support-strip" : ""}`}
    >
      <header className="pt-header">
        <div className="pt-header__inner">
          <button
            type="button"
            className={`pt-menu-btn${sidebar ? " pt-menu-btn--dash" : ""}`}
            aria-label={
              drawerOpen
                ? "Close menu"
                : sidebar && railCollapsed
                  ? "Show sidebar"
                  : sidebar
                    ? "Hide sidebar"
                    : "Open menu"
            }
            aria-expanded={drawerOpen || (sidebar && !railCollapsed)}
            aria-controls={panelId}
            onClick={onMenuClick}
          >
            {drawerOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 7l10 10M17 7L7 17"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 7h14M5 12h14M5 17h14"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>

          <AinfBrand />

          <nav className="pt-site-links" aria-label="AINF">
            {SITE_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={isCurrent(item.href, currentPath) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-header__right">
            {signedIn ? (
              <div className="pt-user-slot">{userSlot}</div>
            ) : (
              <Link href="/account" className="pt-account" aria-label="Your account">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="pt-account__text">Account</span>
              </Link>
            )}
            <Link href="/donate-now" className="pt-cta">
              <span className="pt-cta__full">Support AINF</span>
              <span className="pt-cta__short">Support</span>
            </Link>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <button
          type="button"
          className="pt-drawer__backdrop"
          aria-label="Close menu"
          onClick={closeDrawer}
        />
      ) : null}

      <div
        className={`${sidebar ? "pt-dash" : "pt-app__row"}${drawerOpen ? " is-nav-open" : ""}${sidebar && railCollapsed ? " is-rail-collapsed" : ""}`}
      >
        <aside
          id={panelId}
          className={`pt-sidebar${drawerOpen ? " is-open" : ""}${sidebar ? " pt-sidebar--dash" : " pt-sidebar--auth"}${sidebar && railCollapsed ? " is-collapsed" : ""}`}
          aria-label={sidebar ? "Dashboard" : "Menu"}
          aria-hidden={sidebar ? undefined : !drawerOpen}
        >
          <div className="pt-drawer__head">
            <p className="pt-drawer__title">Menu</p>
            <button type="button" className="pt-drawer__close" onClick={closeDrawer} aria-label="Close menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 7l10 10M17 7L7 17"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="pt-drawer__scroll">
            <div className="pt-drawer__account">
              <Link
                href="/account"
                className="pt-side-link pt-side-link--account"
                aria-current={isCurrent("/account", currentPath) ? "page" : undefined}
                onClick={closeDrawer}
              >
                {signedIn ? "My account" : "Sign in"}
              </Link>
              {signedIn ? (
                <Link
                  href="/account/membership"
                  className="pt-side-link"
                  aria-current={isCurrent("/account/membership", currentPath) ? "page" : undefined}
                  onClick={closeDrawer}
                >
                  Your plan
                </Link>
              ) : (
                <Link href="/sign-up" className="pt-side-link" onClick={closeDrawer}>
                  Sign up
                </Link>
              )}
              {signedIn && role === Role.SUPER_ADMIN ? (
                <Link
                  href="/admin/projects"
                  className="pt-side-link"
                  aria-current={isCurrent("/admin/projects", currentPath) ? "page" : undefined}
                  onClick={closeDrawer}
                >
                  Projects
                </Link>
              ) : null}
            </div>

            {groups.length ? (
              groups.map((group) => {
                const expanded = sidebar || openGroup === group.label;
                const panelKey = `side-${group.label}`;
                return (
                  <nav
                    className={`pt-side-nav${expanded ? " is-open" : " is-closed"}`}
                    aria-label={group.label}
                    key={group.label}
                  >
                    <button
                      type="button"
                      className="pt-side-nav__toggle"
                      aria-expanded={expanded}
                      aria-controls={panelKey}
                      onClick={() =>
                        setOpenGroup((current) => (current === group.label ? "" : group.label))
                      }
                    >
                      <span>{group.label}</span>
                      <span className="pt-side-nav__chevron" aria-hidden="true" />
                    </button>
                    <div className="pt-side-nav__panel" id={panelKey}>
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          className="pt-side-link"
                          aria-current={isCurrent(item.href, currentPath) ? "page" : undefined}
                          onClick={closeDrawer}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </nav>
                );
              })
            ) : null}

            <nav
              className={`pt-side-nav pt-side-nav--mobile-site${sidebar || openGroup === "Site" ? " is-open" : " is-closed"}`}
              aria-label="Site"
            >
              <button
                type="button"
                className="pt-side-nav__toggle"
                aria-expanded={sidebar || openGroup === "Site"}
                aria-controls="side-Site"
                onClick={() => setOpenGroup((current) => (current === "Site" ? "" : "Site"))}
              >
                <span>The site</span>
                <span className="pt-side-nav__chevron" aria-hidden="true" />
              </button>
              <div className="pt-side-nav__panel" id="side-Site">
                {SITE_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    className="pt-side-link"
                    onClick={closeDrawer}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link href="/donate-now" className="pt-side-link pt-side-link--cta" onClick={closeDrawer}>
                  Support AINF
                </Link>
              </div>
            </nav>
          </div>
        </aside>

        <div className={sidebar ? "pt-dash__body" : "pt-app__body"}>
          {supportBanner}
          {children}
          <PortalFooter />
        </div>
      </div>
    </div>
  );
}

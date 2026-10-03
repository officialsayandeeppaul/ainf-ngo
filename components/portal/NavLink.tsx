"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Marks itself as the current page so the header highlight needs no props. */
export function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link className="pt-nav__link" href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

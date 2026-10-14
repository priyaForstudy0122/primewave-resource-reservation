"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "◧" },
  { href: "/resources", label: "Resources", icon: "◈" },
  { href: "/reservations", label: "Reservations", icon: "◷" },
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) && path !== "/reservations/new");

  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
          <span className="nav-icon">{l.icon}</span>
          {l.label}
        </Link>
      ))}
      <Link href="/reservations/new" className="nav-cta">+ Book now</Link>
    </nav>
  );
}

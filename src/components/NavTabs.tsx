"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inventory", label: "Inventory" },
  { href: "/decks", label: "Deck Builder" },
];

export function NavTabs({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, { href: "/admin", label: "Admin" }] : TABS;

  return (
    <nav className="flex gap-1">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

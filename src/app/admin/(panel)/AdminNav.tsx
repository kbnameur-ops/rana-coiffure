"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Planning" },
  { href: "/admin/rendez-vous", label: "Rendez-vous" },
  { href: "/admin/prestations", label: "Prestations & tarifs" },
  { href: "/admin/equipe", label: "Coiffeurs" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/horaires", label: "Horaires & fermetures" },
  { href: "/admin/parametres", label: "Informations" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-6xl overflow-x-auto px-5 sm:px-8">
      <ul className="flex gap-1">
        {TABS.map((t) => {
          const active =
            t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`block whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors ${
                  active
                    ? "border-gold text-cream"
                    : "border-transparent text-cream/60 hover:text-cream"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

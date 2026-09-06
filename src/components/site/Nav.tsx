"use client";

import { useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/apps/fieldvault/play", label: "FieldVault" },
  { to: "/apps/aether", label: "Aether" },
  { to: "/coming-soon", label: "Coming soon" },
] as const;

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <a href="/" className="font-display text-base text-fg">
          Home
        </a>
        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.to || pathname.startsWith(l.to + "/");
            return (
              <a
                key={l.to}
                href={l.to}
                className={cn(
                  "text-sm transition-colors duration-150",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {l.label}
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          className="ml-auto inline-flex size-11 items-center justify-center text-fg md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open ? (
        <nav className="border-t border-border px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <a
              key={l.to}
              href={l.to}
              className="flex min-h-11 items-center text-base text-fg"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

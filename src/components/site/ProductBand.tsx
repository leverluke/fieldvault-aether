import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/site/Reveal";

export function ProductBand({
  n,
  kicker,
  title,
  dek,
  primary,
  secondary,
  flip = false,
  eager = false,
  children,
}: {
  n: string;
  kicker: string;
  title: string;
  dek: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  flip?: boolean;
  eager?: boolean;
  children: ReactNode;
}) {
  return (
    <Reveal eager={eager} className="border-b border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:py-24">
        <div className={cn("lg:col-span-5", flip && "lg:order-2")}>
          <p className="a-line font-mono text-xs tracking-[0.18em] text-primary">{n}</p>
          <p className="a-line mt-4 text-sm text-muted">{kicker}</p>
          <h2 className="a-line mt-2 font-display text-4xl font-medium tracking-tight text-fg sm:text-5xl">
            {title}
          </h2>
          <p className="a-line mt-4 max-w-md text-base leading-relaxed text-muted">{dek}</p>
          <div className="a-line mt-8 flex flex-wrap gap-3">
            <a
              href={primary.href}
              className="inline-flex h-11 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform duration-150 active:scale-[0.96]"
            >
              {primary.label}
            </a>
            {secondary ? (
              <a
                href={secondary.href}
                className="inline-flex h-11 items-center border border-border px-5 text-sm text-fg transition-colors duration-150 hover:border-primary hover:text-primary"
              >
                {secondary.label}
              </a>
            ) : null}
          </div>
        </div>
        <div className={cn("a-media lg:col-span-7", flip && "lg:order-1")}>{children}</div>
      </div>
    </Reveal>
  );
}

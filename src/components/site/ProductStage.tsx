"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/site/Reveal";
import type { WorkItem } from "@/data/catalog";

export function ProductHero({
  item,
  viewId,
  onView,
  media,
}: {
  item: WorkItem;
  viewId?: string;
  onView?: (id: string) => void;
  media?: ReactNode;
}) {
  const view = item.views.find((v) => v.id === viewId) ?? item.views[0];
  const ctaHref = item.playHref ?? "#module";
  const ctaLabel = item.playHref ? item.cta.label : "Open module";

  return (
    <Reveal eager className="border-b border-border">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:py-20">
        <div className="lg:col-span-5">
          <p className="a-line text-sm text-muted">{item.kicker}</p>
          <h1 className="a-line mt-2 font-display text-4xl font-medium tracking-tight text-fg sm:text-5xl">
            {item.title}
          </h1>
          <p className="a-line mt-4 max-w-md text-base leading-relaxed text-muted">
            {view?.caption ?? item.dek}
          </p>
          <div className="a-line mt-8 flex flex-wrap gap-3">
            <a
              href={ctaHref}
              className="inline-flex h-11 items-center bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform duration-150 active:scale-[0.96]"
            >
              {ctaLabel}
            </a>
            {item.playHref ? (
              <a
                href={`/apps/${item.slug}`}
                className="inline-flex h-11 items-center border border-border px-5 text-sm text-fg hover:border-primary"
              >
                About
              </a>
            ) : null}
          </div>
          {item.views.length > 1 ? (
            <ul className="a-line mt-10 flex flex-col border-t border-border">
              {item.views.map((v) => (
                <li key={v.id} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => onView?.(v.id)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between py-3 text-left text-sm transition-colors duration-150",
                      v.id === view?.id ? "text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {v.label}
                    {v.id === view?.id ? <span className="text-primary">·</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="a-media lg:col-span-7" id="module">
          {media ?? (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {item.views.map((v) => (
                <img
                  key={v.id}
                  src={v.image}
                  alt={v.label}
                  className={cn(
                    "aspect-video w-full object-cover transition-opacity duration-500",
                    v.id === view?.id ? "block" : "hidden",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

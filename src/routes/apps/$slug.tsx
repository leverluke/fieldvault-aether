"use client";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { bySlug } from "@/data/catalog";
import { ProductHero } from "@/components/site/ProductStage";
import { Reveal } from "@/components/site/Reveal";
import { CaptureDemo } from "@/components/demos/CaptureDemo";
import { GpsDemo } from "@/components/demos/GpsDemo";
import { ExportDemo } from "@/components/demos/ExportDemo";
import { AetherPreview } from "@/components/site/AetherPreview";
import { LookoutPreview } from "@/vision/LookoutPreview";

export const Route = createFileRoute("/apps/$slug")({
  component: AppPage,
});

function AppPage() {
  const { slug } = Route.useParams();
  const item = bySlug(slug);
  if (!item) throw notFound();

  const [viewId, setViewId] = useState(item.views[0]?.id);
  const view = item.views.find((v) => v.id === viewId) ?? item.views[0];

  const live =
    item.slug === "fieldvault" ? (
      view?.demo === "gps" ? (
        <GpsDemo />
      ) : view?.demo === "export" ? (
        <ExportDemo />
      ) : (
        <CaptureDemo />
      )
    ) : item.slug === "aether" ? (
      <div className="grid gap-4">
        <AetherPreview />
        <LookoutPreview />
      </div>
    ) : undefined;

  return (
    <div>
      <ProductHero item={item} viewId={viewId} onView={setViewId} media={live} />
      <Reveal className="bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="a-line max-w-2xl text-lg leading-relaxed text-fg">{item.summary}</p>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {item.features.map((f) => (
              <li key={f.title} className="a-line">
                <h3 className="font-medium text-fg">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

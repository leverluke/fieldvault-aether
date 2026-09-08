import { createFileRoute } from "@tanstack/react-router";
import { WORK } from "@/data/catalog";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/apps/")({
  component: AppsIndex,
});

function AppsIndex() {
  return (
    <Reveal eager className="mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6">
      <h1 className="a-line font-display text-4xl font-medium tracking-tight text-fg sm:text-5xl">
        Apps
      </h1>
      <p className="a-line mt-4 max-w-xl text-muted">
        FieldVault is the walkdown — open the live capture at /apps/fieldvault/play. Aether is the cortex.
      </p>
      <ul className="mt-14 divide-y divide-border border-y border-border">
        {WORK.map((w) => (
          <li key={w.slug} className="a-line">
            <a
              href={`/apps/${w.slug}`}
              className="grid gap-6 py-8 sm:grid-cols-12 sm:items-center"
            >
              <div className="sm:col-span-4">
                <p className="text-sm text-muted">{w.kicker}</p>
                <h2 className="mt-1 font-display text-2xl text-fg">{w.title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted sm:col-span-5">{w.dek}</p>
              <p className="text-sm text-primary sm:col-span-3 sm:text-right">
                Open
              </p>
            </a>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

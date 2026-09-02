import { createFileRoute } from "@tanstack/react-router";
import { SOON } from "@/data/catalog";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/coming-soon")({
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <Reveal eager className="mx-auto flex min-h-[70dvh] max-w-6xl flex-col justify-center px-4 py-24 sm:px-6">
      <p className="a-line font-mono text-xs tracking-[0.18em] text-primary">Next</p>
      <h1 className="a-line mt-4 font-display text-4xl font-medium tracking-tight text-fg sm:text-5xl">
        Not in the tab yet
      </h1>
      <ul className="mt-10 max-w-xl space-y-8">
        {SOON.map((item) => (
          <li key={item.title} className="a-line">
            <p className="font-mono text-xs tracking-[0.18em] text-primary">{item.eta}</p>
            <h2 className="mt-2 font-display text-2xl text-fg">{item.title}</h2>
            <p className="mt-2 text-muted leading-relaxed">{item.body}</p>
          </li>
        ))}
      </ul>
      <a
        href="/apps/aether/see"
        className="a-line mt-10 inline-flex h-11 w-fit items-center bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Open eyes
      </a>
    </Reveal>
  );
}

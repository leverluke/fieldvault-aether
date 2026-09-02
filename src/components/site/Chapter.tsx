import { Reveal } from "@/components/site/Reveal";

export function Chapter({
  id,
  kicker,
  title,
  dek,
  image,
  imageAlt,
  primary,
  secondary,
  eager = false,
}: {
  id?: string;
  kicker?: string;
  title: string;
  dek: string;
  image: string;
  imageAlt: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  eager?: boolean;
}) {
  return (
    <Reveal
      eager={eager}
      className="flex min-h-[100dvh] flex-col items-center bg-bg px-4 pb-20 pt-24 sm:px-8"
    >
      <div id={id} className="flex w-full max-w-5xl flex-col items-center text-center">
        <div>
          {kicker ? (
            <p className="a-line text-sm font-medium tracking-wide text-muted">{kicker}</p>
          ) : null}
          <h2 className="a-line mt-3 font-display text-5xl font-semibold tracking-tight text-fg sm:text-6xl lg:text-7xl">
            {title}
          </h2>
          <p className="a-line mx-auto mt-4 max-w-xl text-xl leading-snug text-muted sm:text-2xl">
            {dek}
          </p>
          <p className="a-line link-row mt-5 flex flex-wrap items-center justify-center gap-6 text-lg text-primary">
            <a href={primary.href}>
              {primary.label} <span aria-hidden>›</span>
            </a>
            {secondary ? (
              <a href={secondary.href}>
                {secondary.label} <span aria-hidden>›</span>
              </a>
            ) : null}
          </p>
        </div>
        <img
          src={image}
          alt={imageAlt}
          className="a-media mt-12 w-full max-w-4xl rounded-lg object-cover sm:mt-16"
        />
      </div>
    </Reveal>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ProductBand } from "@/components/site/ProductBand";
import { AetherPreview } from "@/components/site/AetherPreview";
import { CaptureDemo } from "@/components/demos/CaptureDemo";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div>
      <ProductBand
        eager
        n="01"
        kicker="Site capture"
        title="FieldVault"
        dek="Snap the unit. Pin it on the map. Leave with one package the office can send."
        primary={{ href: "/apps/fieldvault/play", label: "Snap a walk" }}
        secondary={{ href: "/apps/fieldvault/play", label: "Open the map" }}
      >
        <CaptureDemo />
      </ProductBand>
      <ProductBand
        n="02"
        kicker="Cortex"
        title="Aether"
        dek="Fourteen subagents behind one voice. This is the mind — not a search bar. Drafts the table, sees the room, steers a hull in the tab. You still talk to the host."
        primary={{ href: "/apps/aether", label: "Meet Aether" }}
        secondary={{ href: "/apps/aether/see", label: "Open eyes" }}
      >
        <AetherPreview />
      </ProductBand>
    </div>
  );
}

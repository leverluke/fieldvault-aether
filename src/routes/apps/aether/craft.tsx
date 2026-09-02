import { createFileRoute } from "@tanstack/react-router";
import { Craft } from "@/vision/Craft";

export const Route = createFileRoute("/apps/aether/craft")({
  component: AetherCraft,
});

function AetherCraft() {
  return <Craft backHref="/apps/aether" />;
}

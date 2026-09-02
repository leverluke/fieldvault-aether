import { createFileRoute } from "@tanstack/react-router";
import { Lookout } from "@/vision/Lookout";

export const Route = createFileRoute("/apps/aether/see")({
  component: AetherSee,
});

function AetherSee() {
  return <Lookout backHref="/apps/aether" />;
}

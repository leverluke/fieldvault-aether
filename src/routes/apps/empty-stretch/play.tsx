import { createFileRoute } from "@tanstack/react-router";
import { SpaceWalk } from "@/space/SpaceWalk";

export const Route = createFileRoute("/apps/empty-stretch/play")({
  component: PlayEmptyStretch,
});

function PlayEmptyStretch() {
  return <SpaceWalk backHref="/apps/empty-stretch" />;
}

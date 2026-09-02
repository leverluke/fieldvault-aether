import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/apps/lookout/play")({
  beforeLoad: () => {
    throw redirect({ to: "/apps/aether/see" });
  },
});

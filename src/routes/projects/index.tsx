import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/")({
  component: () => <Navigate to="/apps/$slug" params={{ slug: "fieldvault" }} />,
});

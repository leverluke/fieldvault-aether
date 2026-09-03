"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import markup from "@/fieldvault/markup.html?raw";
import "@/fieldvault/fieldvault.css";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/apps/fieldvault/play")({
  component: FieldVaultPlay,
});

function FieldVaultPlay() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("fv-active");
    document.body.classList.add("fv-active");
    let cancelled = false;
    void (async () => {
      const [{ loadFieldVaultLibs }, { initFieldVault, seedFieldVaultDemo }] = await Promise.all([
        import("@/fieldvault/libs"),
        import("@/fieldvault/app.js"),
      ]);
      if (cancelled) return;
      loadFieldVaultLibs();
      await initFieldVault();
      if (cancelled) return;
      await seedFieldVaultDemo();
    })();
    return () => {
      cancelled = true;
      html.classList.remove("fv-active");
      document.body.classList.remove("fv-active");
    };
  }, []);

  return <div id="fv-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}

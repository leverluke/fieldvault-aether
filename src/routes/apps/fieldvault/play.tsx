"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import markup from "@/fieldvault/markup.html?raw";
import "@/fieldvault/fieldvault.css";

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
      const [{ ensureFieldVaultLibs }, { requestWalkWake, releaseWalkWake }, { initFieldVault, seedFieldVaultDemo }] =
        await Promise.all([
          import("@/fieldvault/libs"),
          import("@/fieldvault/wake"),
          import("@/fieldvault/app.js"),
        ]);
      if (cancelled) return;
      await ensureFieldVaultLibs();
      await requestWalkWake();
      await initFieldVault();
      if (cancelled) return;
      await seedFieldVaultDemo();
      return () => {
        void releaseWalkWake();
      };
    })();
    return () => {
      cancelled = true;
      html.classList.remove("fv-active");
      document.body.classList.remove("fv-active");
      document.body.classList.remove("fv-cam-open");
      void import("@/fieldvault/wake").then((m) => m.releaseWalkWake());
      void import("@/fieldvault/app.js").then((m) => m.closeFieldCameraUi?.());
    };
  }, []);

  return <div id="fv-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}

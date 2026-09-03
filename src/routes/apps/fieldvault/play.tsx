"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { initFieldVault, seedFieldVaultDemo } from "@/fieldvault/app.js";
import { loadFieldVaultLibs } from "@/fieldvault/libs";
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
    void (async () => {
      loadFieldVaultLibs();
      await initFieldVault();
      await seedFieldVaultDemo();
    })();
    return () => {
      html.classList.remove("fv-active");
      document.body.classList.remove("fv-active");
    };
  }, []);

  return <div id="fv-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}

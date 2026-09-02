"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { initFieldVault } from "@/fieldvault/app.js";
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
    void initFieldVault();
    return () => {
      html.classList.remove("fv-active");
      document.body.classList.remove("fv-active");
    };
  }, []);

  return <div id="fv-root" dangerouslySetInnerHTML={{ __html: markup }} />;
}

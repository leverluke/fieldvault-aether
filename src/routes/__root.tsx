import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppErrorComponent } from "@/lib/error-component";
import { Aether } from "@/aether/Aether";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import appCss from "../styles.css?url";

function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-3xl text-fg">Not found</h1>
      <p className="mt-3 text-muted">That page is not in the catalog.</p>
      <Link to="/" className="mt-8 inline-flex min-h-11 items-center text-sm text-fg">
        Back home
      </Link>
    </div>
  );
}

function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const play =
    pathname.endsWith("/play") || pathname.endsWith("/see") || pathname.endsWith("/craft");
  const fieldVault =
    pathname === "/apps/fieldvault" || pathname.startsWith("/apps/fieldvault/");
  const aether = fieldVault ? null : <Aether />;
  if (play) {
    return (
      <>
        <Outlet />
        {aether}
      </>
    );
  }
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {aether}
    </div>
  );
}

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <Shell />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "FieldVault" },
      { name: "theme-color", content: "#0c0c0d" },
      {
        name: "description",
        content:
          "FieldVault for site capture, and Aether — a cortex with a visible mind.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
  errorComponent: AppErrorComponent,
  notFoundComponent: NotFound,
});

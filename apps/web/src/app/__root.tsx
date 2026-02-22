import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { ModalProvider } from "~/providers/modal";
import { PopupProvider } from "~/providers/popup";
import { ThemeProvider } from "~/providers/theme";
import appCss from "~/styles/globals.css?url";
import { QueryProvider, queryClient } from "~/utils/api";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { title: "Kan" },
      { name: "description", content: "The open source Trello alternative" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootLayout,
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });

  useEffect(() => {
    if (!isPending && !session && pathname !== "/login") {
      navigate({ to: "/login" });
    }
  }, [session, isPending, pathname, navigate]);

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-light-100 dark:bg-dark-100">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-light-300 border-t-light-900 dark:border-dark-300 dark:border-t-dark-900" />
      </div>
    );
  }

  if (!session && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}

function RootLayout() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme') || 'system';
                var resolved = theme;
                if (theme === 'system') {
                  resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.classList.add(resolved);
              })();
            `,
          }}
        />
      </head>
      <body className="relative font-sans">
        <QueryProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ModalProvider>
              <PopupProvider>
                <AuthGuard>
                  <Outlet />
                </AuthGuard>
              </PopupProvider>
            </ModalProvider>
          </ThemeProvider>
        </QueryProvider>
        <Scripts />
      </body>
    </html>
  );
}

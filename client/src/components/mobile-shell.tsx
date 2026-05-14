import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, Globe, ListFilter, Activity, Sun, Moon, Trophy } from "lucide-react";
import { Logo } from "@/components/logo";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Бренды", icon: LayoutGrid, testId: "nav-brands" },
  { href: "/ranking", label: "Рейтинг", icon: Trophy, testId: "nav-ranking" },
  { href: "/sources", label: "Источники", icon: Globe, testId: "nav-sources" },
  { href: "/feed", label: "Лента", icon: ListFilter, testId: "nav-feed" },
  { href: "/monitor", label: "Сбор", icon: Activity, testId: "nav-monitor" },
];

export function MobileShell({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" data-testid="mobile-shell">
      {/* Top app bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2 text-primary hover-elevate -mx-2 px-2 py-1 rounded-md" data-testid="link-home">
            <Logo size={24} />
            <span className="text-sm font-semibold tracking-tight text-foreground">Review Pulse</span>
          </Link>
          <div className="flex items-center gap-1">
            {right}
            <button
              type="button"
              onClick={toggle}
              aria-label="Переключить тему"
              data-testid="button-toggle-theme"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover-elevate"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {title && (
          <div className="mx-auto max-w-md px-4 pb-3 pt-1">
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
              {title}
            </h1>
          </div>
        )}
      </header>

      {/* Main content area, mobile-first column */}
      <main className="flex-1 mx-auto w-full max-w-md px-4 pt-4 pb-28">{children}</main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        data-testid="bottom-nav"
      >
        <div className="mx-auto max-w-md grid grid-cols-5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? location === "/" || location.startsWith("/brand/")
                : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] hover-elevate",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                <span className={cn(active && "font-medium")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

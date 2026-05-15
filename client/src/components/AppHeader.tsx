import { Link, useLocation } from "wouter";
import { Activity, BookOpen, History, CalendarDays } from "lucide-react";

const ORANGE = "#FF6B35";

function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-label="WOD Analyzer" className="h-7 w-7">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ORANGE} />
          <stop offset="100%" stopColor="#FF8A4A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="none" stroke="url(#logo-grad)" strokeWidth="2" />
      <path
        d="M6 21 L11 11 L14 17 L18 9 L22 17 L26 11"
        fill="none"
        stroke="url(#logo-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS: { href: string; label: string; icon: typeof Activity; testid: string }[] = [
  { href: "/", label: "Analyseur", icon: Activity, testid: "tab-analyseur" },
  { href: "/benchmarks", label: "Benchmarks", icon: BookOpen, testid: "tab-benchmarks" },
  { href: "/historique", label: "Historique", icon: History, testid: "tab-historique" },
  { href: "/programmation", label: "Programmation", icon: CalendarDays, testid: "tab-programmation" },
];

export function AppHeader() {
  const [location] = useLocation();

  return (
    <header className="border-b border-border/70 bg-background/85 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-4">
        <Link href="/" data-testid="link-home" className="flex items-center gap-2.5 shrink-0">
          <Logo />
          <div className="hidden sm:block">
            <div className="text-sm sm:text-base font-semibold tracking-tight">WOD Analyzer</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5">
              Filières × capacités neuromusculaires
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Navigation principale">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.href === "/" ? location === "/" : location.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                data-testid={t.testid}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

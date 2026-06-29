import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import {
  Truck, Package, Repeat, Users, MapPin, Calendar, Search, Activity,
  Navigation, Box, Headphones, ChevronRight, Phone, ShieldCheck, Leaf,
  Languages, Gauge, Sun, Moon, Menu, X, ArrowRight, Radio, Facebook,
  Twitter, Instagram, Linkedin,
} from "lucide-react";
import { CAPTAIN_PORTAL_URL } from "@/lib/portals";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoadMitra — Your load, always moving" },
      { name: "description", content: "Book trucks across India. Full loads, shared loads, return-load discounts up to 30%. Live GPS tracking, transparent estimates, 6 languages." },
      { property: "og:title", content: "LoadMitra — India's smart freight marketplace" },
      { property: "og:description", content: "Full loads, shared loads, return-load discounts. Live tracking. 6 Indian languages." },
    ],
  }),
  component: Landing,
});

/* Theme is handled by the shared hook in @/hooks/use-theme (shared with the app). */

type Mode = "full" | "shared" | "return";

function Landing() {
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<Mode>("full");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav theme={theme} onToggleTheme={toggle} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Hero mode={mode} setMode={setMode} theme={theme} />
      <QuickActions />
      <Features />
      <HowItWorks />
      <CaptainBand />
      <Stats />
      <Footer />
    </div>
  );
}

/* ============ NAV ============ */
// `to` = internal shipper-app route (client-side); `href` = on-page anchor or
// external portal (hard navigation). "Find a truck" opens the shipper booking
// app; "Become a captain" hands off to the separate Captain portal.
const navLinks: { label: string; href?: string; to?: string }[] = [
  { label: "Find a truck", to: "/app" },
  { label: "Return loads", href: "#return" },
  { label: "Truck sharing", href: "#sharing" },
  { label: "Become a captain", href: CAPTAIN_PORTAL_URL },
  { label: "Contact", href: "#contact" },
];

function Nav({ theme, onToggleTheme, menuOpen, setMenuOpen }: {
  theme: "light" | "dark"; onToggleTheme: () => void;
  menuOpen: boolean; setMenuOpen: (v: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="#" className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Truck className="h-5 w-5" />
          </span>
          <span className="truncate text-lg font-extrabold tracking-tight text-foreground">
            Load<span className="text-primary">Mitra</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
          {navLinks.map((l) =>
            l.to ? (
              <Link key={l.label} to={l.to} className="hover:text-foreground">{l.label}</Link>
            ) : (
              <a key={l.label} href={l.href} className="hover:text-foreground">{l.label}</a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/login" className="hidden h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-110 sm:inline-flex">
            Login / Register
          </Link>
          <button
            aria-label="Open menu"
            onClick={() => setMenuOpen(!menuOpen)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="border-t border-border bg-card lg:hidden">
          <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {navLinks.map((l) =>
              l.to ? (
                <Link key={l.label} to={l.to} onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                  {l.label}
                </a>
              ),
            )}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground sm:hidden">
              Login / Register
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ============ HERO with animated truck ============ */
const modes: { id: Mode; label: string; icon: typeof Truck; badge?: string; badgeTone?: "savings" | "cyan" }[] = [
  { id: "full", label: "Full truck", icon: Truck },
  { id: "shared", label: "Shared truck", icon: Users, badge: "♻ Share & Save", badgeTone: "cyan" },
  { id: "return", label: "Return load", icon: Repeat, badge: "🔥 Save 25%", badgeTone: "savings" },
];

function Hero({ mode, setMode, theme }: { mode: Mode; setMode: (m: Mode) => void; theme: "light" | "dark" }) {
  return (
    <section id="find" className="relative isolate w-full overflow-hidden">
      <div className="relative min-h-[640px] sm:min-h-[680px] lg:min-h-[85vh]">
        <TruckScene theme={theme} />

        {/* Text overlay */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-4 pt-10 pb-72 sm:px-6 sm:pt-14 sm:pb-80 lg:px-8 lg:pt-20">
          <span className="lm-anim-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
            <Radio className="h-3.5 w-3.5" /> India's smart freight marketplace
          </span>
          <h1 className="hero-title lm-anim-fade-up mt-5 max-w-3xl text-balance text-foreground">
            Your load, <span className="text-primary">always moving.</span>
          </h1>
          <p className="lm-anim-fade-up mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Book trucks, share space, and save big on return trips — across India.
          </p>
          <div className="lm-anim-fade-up mt-6 flex flex-wrap gap-3">
            <Link to="/app" className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-110">
              Find a truck <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={CAPTAIN_PORTAL_URL} className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-border bg-card/70 px-6 text-sm font-semibold text-foreground backdrop-blur hover:bg-card">
              Become a captain
            </a>
          </div>
        </div>

        {/* Search card overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <SearchCard mode={mode} setMode={setMode} />
            <ul className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <Chip tone="success">Verified captains</Chip>
              <Chip tone="cyan">Live tracking</Chip>
              <Chip tone="primary">GST invoice</Chip>
              <Chip tone="savings">24/7 support</Chip>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ TRUCK SCENE ============ */
function TruckScene({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 75%)" }}
    >
      {/* Night stars (only visible in dark mode via opacity contrast) */}
      {theme === "dark" && (
        <div className="absolute inset-0">
          {[
            [12, 18], [22, 9], [35, 22], [48, 14], [62, 8], [73, 24], [84, 12], [92, 20],
            [16, 32], [30, 38], [55, 30], [78, 36], [88, 32],
          ].map(([x, y], i) => (
            <span key={i}
              className="absolute h-[3px] w-[3px] rounded-full bg-white"
              style={{
                left: `${x}%`, top: `${y}%`,
                animation: `lm-star-twinkle ${2 + (i % 4)}s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Sun / moon */}
      <div
        className="absolute right-[8%] top-[12%] h-20 w-20 rounded-full"
        style={{
          background: theme === "dark"
            ? "radial-gradient(circle at 35% 35%, #E2E8F0, #94A3B8 60%, transparent 75%)"
            : "radial-gradient(circle, #FDE68A, #F59E0B 70%, transparent 75%)",
          boxShadow: theme === "dark"
            ? "0 0 60px rgba(226,232,240,.35)"
            : "0 0 80px rgba(245,158,11,.45)",
        }}
      />

      {/* Far hills (parallax slow) */}
      <div
        className="lm-parallax-far absolute bottom-[54%] left-0 h-[28%] w-[200%]"
        style={{ animation: "lm-parallax-far 40s linear infinite" }}
      >
        <Hills color="var(--hill-far)" />
      </div>

      {/* Near hills (faster) */}
      <div
        className="lm-parallax-near absolute bottom-[48%] left-0 h-[22%] w-[200%]"
        style={{ animation: "lm-parallax-near 22s linear infinite" }}
      >
        <Hills color="var(--hill-near)" variant="near" />
      </div>

      {/* Road — lifted above the search card so the driving scene stays visible. */}
      <div
        className="absolute bottom-[26%] left-0 right-0 h-[22%]"
        style={{ background: "linear-gradient(180deg, var(--road-edge) 0%, var(--road) 30%)" }}
      >
        {/* Lane line scrolling */}
        <div
          className="lm-road absolute left-0 right-0 top-[48%] h-[6px] -translate-y-1/2"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, var(--lane) 0 80px, transparent 80px 160px)",
            backgroundSize: "240px 6px",
            animation: "lm-road-dash 0.9s linear infinite",
            opacity: 0.9,
          }}
        />
        {/* Side dashes for depth */}
        <div className="absolute inset-x-0 top-2 h-[2px]" style={{ background: "color-mix(in oklab, var(--lane) 35%, transparent)" }} />
        <div className="absolute inset-x-0 bottom-2 h-[2px]" style={{ background: "color-mix(in oklab, var(--lane) 35%, transparent)" }} />
      </div>

      {/* Truck — sits on the lifted road, clear of the search card. */}
      <div
        className="lm-truck absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "30%",
          animation: "lm-truck-bob 1.6s ease-in-out infinite",
          width: "min(42vw, 420px)",
        }}
      >
        {/* Headlight glow (dark mode mostly visible) */}
        {theme === "dark" && (
          <div
            className="pointer-events-none absolute -right-10 top-1/2 h-24 w-40 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(ellipse at left center, rgba(253,224,71,.55), transparent 70%)", filter: "blur(6px)" }}
          />
        )}
        {/* Motion trail */}
        <div className="pointer-events-none absolute -left-2 top-[60%] flex -translate-y-1/2 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="lm-trail block h-[3px] w-10 origin-right rounded-full"
              style={{
                background: "var(--cyan-accent)",
                opacity: 0,
                animation: `lm-trail 1.1s ease-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
        <TruckSVG />
      </div>
    </div>
  );
}

function Hills({ color, variant = "far" }: { color: string; variant?: "far" | "near" }) {
  // Two repeated panels for seamless loop
  const path = variant === "far"
    ? "M0,100 L0,55 Q120,15 240,45 T480,40 T720,50 T960,30 T1200,55 L1200,100 Z"
    : "M0,100 L0,65 Q90,30 180,55 T360,50 T540,65 T720,40 T900,60 T1080,50 T1200,65 L1200,100 Z";
  return (
    <svg viewBox="0 0 2400 100" preserveAspectRatio="none" className="h-full w-full">
      <path d={path} fill={color} />
      <g transform="translate(1200,0)">
        <path d={path} fill={color} />
      </g>
    </svg>
  );
}

function TruckSVG() {
  return (
    <svg viewBox="0 0 460 200" className="h-auto w-full" role="img" aria-label="Delivery truck">
      {/* Shadow */}
      <ellipse cx="230" cy="186" rx="190" ry="8" fill="rgba(0,0,0,0.25)" />

      {/* Cargo box */}
      <rect x="20" y="40" width="240" height="120" rx="10" fill="var(--primary)" />
      <rect x="30" y="50" width="220" height="100" rx="6" fill="color-mix(in oklab, var(--primary) 80%, white 20%)" />
      <text x="140" y="108" textAnchor="middle" fontFamily="Plus Jakarta Sans, Inter, sans-serif"
        fontWeight={800} fontSize="34" fill="white" letterSpacing="-1">LoadMitra</text>

      {/* Cab */}
      <path d="M260,160 L260,70 Q260,55 275,55 L330,55 Q345,55 355,68 L420,110 Q430,118 430,130 L430,160 Z"
        fill="var(--navy)" />
      {/* Window */}
      <path d="M285,72 L335,72 Q345,72 352,82 L390,108 L285,108 Z"
        fill="var(--cyan-accent)" opacity="0.85" />
      <path d="M285,72 L335,72 Q345,72 352,82 L390,108 L285,108 Z"
        fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      {/* Headlight */}
      <rect x="418" y="130" width="12" height="14" rx="2" fill="#FDE68A" />
      {/* Bumper */}
      <rect x="260" y="155" width="170" height="8" rx="3" fill="#0F172A" />

      {/* Wheels with spinning hub */}
      <g>
        <circle cx="90" cy="170" r="22" fill="#0B1220" />
        <circle cx="90" cy="170" r="10" fill="#475569" />
        <g className="lm-wheel" style={{ transformOrigin: "90px 170px", animation: "lm-wheel-spin 0.5s linear infinite" }}>
          <rect x="88" y="160" width="4" height="20" fill="#94A3B8" />
          <rect x="80" y="168" width="20" height="4" fill="#94A3B8" />
        </g>
      </g>
      <g>
        <circle cx="210" cy="170" r="22" fill="#0B1220" />
        <circle cx="210" cy="170" r="10" fill="#475569" />
        <g className="lm-wheel" style={{ transformOrigin: "210px 170px", animation: "lm-wheel-spin 0.5s linear infinite" }}>
          <rect x="208" y="160" width="4" height="20" fill="#94A3B8" />
          <rect x="200" y="168" width="20" height="4" fill="#94A3B8" />
        </g>
      </g>
      <g>
        <circle cx="380" cy="170" r="22" fill="#0B1220" />
        <circle cx="380" cy="170" r="10" fill="#475569" />
        <g className="lm-wheel" style={{ transformOrigin: "380px 170px", animation: "lm-wheel-spin 0.5s linear infinite" }}>
          <rect x="378" y="160" width="4" height="20" fill="#94A3B8" />
          <rect x="370" y="168" width="20" height="4" fill="#94A3B8" />
        </g>
      </g>
    </svg>
  );
}

/* ============ SEARCH CARD ============ */
function SearchCard({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="rounded-3xl border border-border bg-card/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-4">
      {/* Mode pills */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-secondary p-1.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                "inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all sm:flex-none sm:text-sm",
                active
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{m.label}</span>
              {m.badge && (
                <span
                  className="ml-1 hidden rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline"
                  style={{
                    background: m.badgeTone === "savings" ? "var(--savings)" : "var(--cyan-accent)",
                    color: "#0B1220",
                  }}
                >
                  {m.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fields */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_1fr_0.9fr_auto]">
        <Field icon={MapPin} label="Pickup" placeholder="e.g. Hyderabad" />
        <Field icon={Navigation} label="Drop" placeholder="e.g. Bengaluru" />
        <Field icon={Truck} label="Vehicle" placeholder="Any truck" />
        <Field icon={Calendar} label="Date" placeholder="Tomorrow" />
        <Link to="/app/search" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md hover:brightness-110">
          <Search className="h-4 w-4" /> Search
        </Link>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, placeholder }: { icon: typeof MapPin; label: string; placeholder: string }) {
  return (
    <label className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <input
          className="min-w-0 truncate bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          placeholder={placeholder}
        />
      </span>
    </label>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "success" | "cyan" | "primary" | "savings" }) {
  const map: Record<string, string> = {
    success: "var(--success)",
    cyan: "var(--cyan-accent)",
    primary: "var(--primary)",
    savings: "var(--savings)",
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: map[tone] }} />
      <span className="text-foreground/80">{children}</span>
    </span>
  );
}

/* ============ QUICK ACTIONS ============ */
const quickActions = [
  { icon: Activity, label: "Track shipment", to: "/app/bookings" },
  { icon: Gauge, label: "Price estimate", to: "/app/search" },
  { icon: Repeat, label: "Return loads", to: "/app/search" },
  { icon: Users, label: "Truck sharing", to: "/app/search" },
  { icon: Box, label: "My bookings", to: "/app/bookings" },
  { icon: Truck, label: "Become a captain", to: "/login" },
  { icon: MapPin, label: "Nearby trucks", to: "/app" },
  { icon: Headphones, label: "Support", to: "/app/account" },
] as const;

function QuickActions() {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5 lg:grid-cols-8">
          {quickActions.map((a) => {
            const Icon = a.icon;
            const className =
              "group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-soft)] sm:p-4";
            const inner = (
              <>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary ring-1 ring-border group-hover:bg-primary group-hover:text-primary-foreground sm:h-14 sm:w-14">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
                  {a.label}
                </span>
              </>
            );
            // "Become a captain" lives in the separate Captain portal app.
            return a.label === "Become a captain" ? (
              <a key={a.label} href={CAPTAIN_PORTAL_URL} className={className}>
                {inner}
              </a>
            ) : (
              <Link key={a.label} to={a.to} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============ FEATURES ============ */
function Features() {
  return (
    <section id="return" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          Why LoadMitra
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Smarter freight. Lower costs. Greener roads.
        </h2>
        <p className="mt-3 text-muted-foreground">
          We match shippers and captains by route — not just by location — so trucks move full, not empty.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Return load — savings (amber) */}
        <article id="return" className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--savings) 18%, transparent)", color: "var(--savings)" }}>
              <Repeat className="h-6 w-6" />
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--savings)", color: "#0B1220" }}>
              🔥 Save 25%
            </span>
          </div>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">Return-load savings</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Book a truck on its empty return trip and save 20–30%. We match cargo within a 5–10 km corridor of the captain's route.
          </p>
        </article>

        {/* Sharing — cyan */}
        <article id="sharing" className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--cyan-accent) 18%, transparent)", color: "var(--cyan-accent)" }}>
              <Users className="h-6 w-6" />
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--cyan-accent)", color: "#0B1220" }}>
              ♻ Share & Save
            </span>
          </div>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">Truck sharing</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Split one truck between multiple loads. Pay only for the space you use — per kg or CFT.
          </p>
          {/* Capacity progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Capacity used</span><span className="text-foreground">68%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: "68%", background: "var(--cyan-accent)" }} />
            </div>
          </div>
        </article>

        {/* Live tracking — primary blue + pulse */}
        <article className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="h-6 w-6" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground">
              <span className="relative inline-flex h-2 w-2">
                <span className="lm-pulse absolute inset-0 rounded-full" style={{ background: "var(--cyan-accent)", animation: "lm-pulse-dot 1.4s ease-in-out infinite" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--cyan-accent)" }} />
              </span>
              Live
            </span>
          </div>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">Live tracking</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Real-time GPS map tracking with dynamic ETA, pickup & drop geofence alerts, and offline buffering.
          </p>
        </article>
      </div>
    </section>
  );
}

/* ============ HOW IT WORKS ============ */
function HowItWorks() {
  const steps = [
    { icon: Box, title: "Post your load", text: "Tell us pickup, drop, weight and vehicle preference." },
    { icon: Users, title: "Get matched", text: "We find a nearby captain — full, shared or return." },
    { icon: Navigation, title: "Track to delivery", text: "Live GPS, OTP pickup, ePOD with photo & signature." },
  ];
  return (
    <section className="bg-secondary/50 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How it works</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">Three steps from posting a load to a tracked delivery.</p>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="relative rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </span>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                {i < steps.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-primary md:block" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ============ CAPTAIN BAND ============ */
function CaptainBand() {
  return (
    <section id="captain" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div
        className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
        style={{ background: "var(--navy)", color: "#F8FAFC" }}
      >
        {/* decorative road */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-40"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, var(--cyan-accent) 0 40px, transparent 40px 80px)",
          }}
        />
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "color-mix(in oklab, white 12%, transparent)", color: "var(--cyan-accent)" }}>
              For captains
            </span>
            <h3 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Never drive empty again. Earn more on every trip.
            </h3>
            <p className="mt-3 max-w-xl text-white/80">
              Join thousands of verified captains earning extra with return loads and shared trips on LoadMitra.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={CAPTAIN_PORTAL_URL} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[var(--navy)] shadow-md hover:scale-[1.02]">
              Become a captain <ChevronRight className="ml-1 h-4 w-4" />
            </a>
            <a className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
              Talk to sales <Phone className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ STATS ============ */
function useCountUp(target: number, ref: React.RefObject<HTMLDivElement | null>) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = performance.now();
        const dur = 1400;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          setVal(Math.floor(p * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, ref]);
  return val;
}

function StatCard({ value, suffix, label, icon: Icon }: { value: number; suffix?: string; label: string; icon: typeof Truck }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useCountUp(value, ref);
  return (
    <div ref={ref} className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <div className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {v.toLocaleString("en-IN")}{suffix}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Stats() {
  return (
    <section className="bg-secondary/50 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Truck} value={12500} suffix="+" label="Trucks onboarded" />
          <StatCard icon={MapPin} value={420} suffix="+" label="Cities covered" />
          <StatCard icon={Repeat} value={3800000} label="Empty km saved" />
          <StatCard icon={Leaf} value={1250} suffix=" T" label="CO₂ saved" />
        </div>
      </div>
    </section>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  return (
    <footer id="contact" className="border-t border-border" style={{ background: "var(--navy)", color: "#E2E8F0" }}>
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">LoadMitra</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/70">
            India's smart freight marketplace — full loads, shared loads, return-load discounts.
          </p>

          <div className="mt-5 flex items-center gap-2">
            <Languages className="h-4 w-4 text-white/60" />
            <select aria-label="Language" className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white">
              <option className="text-black">English</option>
              <option className="text-black">తెలుగు</option>
              <option className="text-black">हिन्दी</option>
              <option className="text-black">தமிழ்</option>
              <option className="text-black">ಕನ್ನಡ</option>
              <option className="text-black">മലയാളം</option>
            </select>
          </div>

          <div className="mt-5 flex gap-3">
            {[Facebook, Twitter, Instagram, Linkedin].map((I, i) => (
              <a key={i} aria-label="Social link" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/15 hover:text-white">
                <I className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <FooterCol title="Company" links={["About", "Careers", "Press", "Contact"]} />
        <FooterCol title="For shippers" links={["Find a truck", "Pricing", "Return loads", "Truck sharing"]} />
        <FooterCol title="For captains" links={["Onboarding", "Earnings", "Safety", "Help"]} href={CAPTAIN_PORTAL_URL} />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-white/60 sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} LoadMitra. Made in India 🇮🇳</span>
          <span>Terms · Privacy · Refunds</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links, href }: { title: string; links: string[]; href?: string }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-white/70">
        {links.map((l) => (
          <li key={l}><a href={href} className="hover:text-white">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}

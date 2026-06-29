import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import {
  Truck, Repeat, Users, Wallet, Navigation, ShieldCheck, Clock, Power,
  ChevronRight, Sun, Moon, Menu, X, ArrowRight, Radio, TrendingUp, Star,
  Facebook, Twitter, Instagram, Linkedin, Languages, IndianRupee,
} from "lucide-react";
import { SHIPPER_PORTAL_URL } from "@/lib/portals";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoadMitra Captain — Never drive empty" },
      { name: "description", content: "Drive with LoadMitra. Get loads near you, earn extra on return and shared trips, navigate live, and grow your trucking business across India." },
      { property: "og:title", content: "LoadMitra Captain — Earn more on every trip" },
      { property: "og:description", content: "Return loads, shared loads, live navigation, transparent earnings. Join thousands of verified captains." },
    ],
  }),
  component: CaptainLanding,
});

function CaptainLanding() {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav theme={theme} onToggleTheme={toggle} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Hero theme={theme} />
      <Benefits />
      <HowItWorks />
      <EarningsBand />
      <Stats />
      <Footer />
    </div>
  );
}

/* ============ NAV ============ */
const navLinks = [
  { label: "How it works", href: "#how" },
  { label: "Earnings", href: "#earnings" },
  { label: "Return loads", href: "#benefits" },
  { label: "Help", href: "#contact" },
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
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Captain
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-foreground">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <a
            href={SHIPPER_PORTAL_URL}
            className="hidden h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-secondary sm:inline-flex"
          >
            I need a truck
          </a>
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
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                {l.label}
              </a>
            ))}
            <a href={SHIPPER_PORTAL_URL} className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
              I need a truck
            </a>
            <Link to="/login" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
              Login / Register
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ============ HERO with animated truck ============ */
function Hero({ theme }: { theme: "light" | "dark" }) {
  return (
    <section id="find" className="relative isolate w-full overflow-hidden">
      <div className="relative min-h-[640px] sm:min-h-[680px] lg:min-h-[82vh]">
        <TruckScene theme={theme} />

        {/* Text overlay */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start px-4 pt-10 pb-72 sm:px-6 sm:pt-14 sm:pb-80 lg:px-8 lg:pt-20">
          <span className="lm-anim-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
            <Radio className="h-3.5 w-3.5" /> For truck owners &amp; drivers
          </span>
          <h1 className="hero-title lm-anim-fade-up mt-5 max-w-3xl text-balance text-foreground">
            Never drive empty. <span className="text-primary">Earn more.</span>
          </h1>
          <p className="lm-anim-fade-up mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Get loads going your way, earn extra on return and shared trips, and grow your business — across India.
          </p>
          <div className="lm-anim-fade-up mt-6 flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-110">
              Start earning <ArrowRight className="h-4 w-4" />
            </Link>
            <a href={SHIPPER_PORTAL_URL} className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-border bg-card/70 px-6 text-sm font-semibold text-foreground backdrop-blur hover:bg-card">
              I need a truck
            </a>
          </div>
        </div>

        {/* Earnings teaser card overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <EarningsTeaser />
            <ul className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <Chip tone="success">Weekly payouts</Chip>
              <Chip tone="cyan">Loads near you</Chip>
              <Chip tone="primary">Free to join</Chip>
              <Chip tone="savings">24/7 support</Chip>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function EarningsTeaser() {
  const sample = [
    { route: "Gachibowli → Vijayawada", mode: "Return load", amount: "₹4,180", tone: "savings" as const },
    { route: "HITEC City → Warangal", mode: "Full load", amount: "₹3,240", tone: "primary" as const },
    { route: "Kompally → Secunderabad", mode: "Shared load", amount: "₹980", tone: "cyan" as const },
  ];
  const map: Record<string, string> = {
    primary: "var(--primary)", cyan: "var(--cyan-accent)", savings: "var(--savings)",
  };
  return (
    <div className="rounded-3xl border border-border bg-card/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-4">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-sm font-bold text-foreground">Recent loads near you</p>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-success" style={{ animation: "lm-pulse-dot 1.4s ease-in-out infinite" }} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {sample.map((s) => (
          <div key={s.route} className="rounded-2xl border border-border bg-background p-3">
            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `color-mix(in oklab, ${map[s.tone]} 16%, transparent)`, color: map[s.tone] }}>
              {s.mode}
            </span>
            <p className="mt-2 truncate text-xs font-semibold text-foreground">{s.route}</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-foreground">{s.amount}</p>
            <p className="text-[10px] text-muted-foreground">you earn · est.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "success" | "cyan" | "primary" | "savings" }) {
  const map: Record<string, string> = {
    success: "var(--success)", cyan: "var(--cyan-accent)", primary: "var(--primary)", savings: "var(--savings)",
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: map[tone] }} />
      <span className="text-foreground/80">{children}</span>
    </span>
  );
}

/* ============ TRUCK SCENE (shared brand animation) ============ */
function TruckScene({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 75%)" }}
    >
      {theme === "dark" && (
        <div className="absolute inset-0">
          {[
            [12, 18], [22, 9], [35, 22], [48, 14], [62, 8], [73, 24], [84, 12], [92, 20],
            [16, 32], [30, 38], [55, 30], [78, 36], [88, 32],
          ].map(([x, y], i) => (
            <span key={i}
              className="absolute h-[3px] w-[3px] rounded-full bg-white"
              style={{ left: `${x}%`, top: `${y}%`, animation: `lm-star-twinkle ${2 + (i % 4)}s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      )}

      <div
        className="absolute right-[8%] top-[12%] h-20 w-20 rounded-full"
        style={{
          background: theme === "dark"
            ? "radial-gradient(circle at 35% 35%, #E2E8F0, #94A3B8 60%, transparent 75%)"
            : "radial-gradient(circle, #FDE68A, #F59E0B 70%, transparent 75%)",
          boxShadow: theme === "dark" ? "0 0 60px rgba(226,232,240,.35)" : "0 0 80px rgba(245,158,11,.45)",
        }}
      />

      <div className="lm-parallax-far absolute bottom-[54%] left-0 h-[28%] w-[200%]" style={{ animation: "lm-parallax-far 40s linear infinite" }}>
        <Hills color="var(--hill-far)" />
      </div>
      <div className="lm-parallax-near absolute bottom-[48%] left-0 h-[22%] w-[200%]" style={{ animation: "lm-parallax-near 22s linear infinite" }}>
        <Hills color="var(--hill-near)" variant="near" />
      </div>

      <div className="absolute bottom-[26%] left-0 right-0 h-[22%]" style={{ background: "linear-gradient(180deg, var(--road-edge) 0%, var(--road) 30%)" }}>
        <div
          className="lm-road absolute left-0 right-0 top-[48%] h-[6px] -translate-y-1/2"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, var(--lane) 0 80px, transparent 80px 160px)",
            backgroundSize: "240px 6px", animation: "lm-road-dash 0.9s linear infinite", opacity: 0.9,
          }}
        />
      </div>

      <div className="lm-truck absolute left-1/2 -translate-x-1/2" style={{ bottom: "30%", animation: "lm-truck-bob 1.6s ease-in-out infinite", width: "min(42vw, 420px)" }}>
        {theme === "dark" && (
          <div className="pointer-events-none absolute -right-10 top-1/2 h-24 w-40 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(ellipse at left center, rgba(253,224,71,.55), transparent 70%)", filter: "blur(6px)" }} />
        )}
        <div className="pointer-events-none absolute -left-2 top-[60%] flex -translate-y-1/2 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="lm-trail block h-[3px] w-10 origin-right rounded-full"
              style={{ background: "var(--cyan-accent)", opacity: 0, animation: `lm-trail 1.1s ease-out ${i * 0.15}s infinite` }} />
          ))}
        </div>
        <TruckSVG />
      </div>
    </div>
  );
}

function Hills({ color, variant = "far" }: { color: string; variant?: "far" | "near" }) {
  const path = variant === "far"
    ? "M0,100 L0,55 Q120,15 240,45 T480,40 T720,50 T960,30 T1200,55 L1200,100 Z"
    : "M0,100 L0,65 Q90,30 180,55 T360,50 T540,65 T720,40 T900,60 T1080,50 T1200,65 L1200,100 Z";
  return (
    <svg viewBox="0 0 2400 100" preserveAspectRatio="none" className="h-full w-full">
      <path d={path} fill={color} />
      <g transform="translate(1200,0)"><path d={path} fill={color} /></g>
    </svg>
  );
}

function TruckSVG() {
  return (
    <svg viewBox="0 0 460 200" className="h-auto w-full" role="img" aria-label="Delivery truck">
      <ellipse cx="230" cy="186" rx="190" ry="8" fill="rgba(0,0,0,0.25)" />
      <rect x="20" y="40" width="240" height="120" rx="10" fill="var(--primary)" />
      <rect x="30" y="50" width="220" height="100" rx="6" fill="color-mix(in oklab, var(--primary) 80%, white 20%)" />
      <text x="140" y="108" textAnchor="middle" fontFamily="Plus Jakarta Sans, Inter, sans-serif" fontWeight={800} fontSize="34" fill="white" letterSpacing="-1">LoadMitra</text>
      <path d="M260,160 L260,70 Q260,55 275,55 L330,55 Q345,55 355,68 L420,110 Q430,118 430,130 L430,160 Z" fill="var(--navy)" />
      <path d="M285,72 L335,72 Q345,72 352,82 L390,108 L285,108 Z" fill="var(--cyan-accent)" opacity="0.85" />
      <path d="M285,72 L335,72 Q345,72 352,82 L390,108 L285,108 Z" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <rect x="418" y="130" width="12" height="14" rx="2" fill="#FDE68A" />
      <rect x="260" y="155" width="170" height="8" rx="3" fill="#0F172A" />
      {[90, 210, 380].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="170" r="22" fill="#0B1220" />
          <circle cx={cx} cy="170" r="10" fill="#475569" />
          <g className="lm-wheel" style={{ transformOrigin: `${cx}px 170px`, animation: "lm-wheel-spin 0.5s linear infinite" }}>
            <rect x={cx - 2} y="160" width="4" height="20" fill="#94A3B8" />
            <rect x={cx - 10} y="168" width="20" height="4" fill="#94A3B8" />
          </g>
        </g>
      ))}
    </svg>
  );
}

/* ============ BENEFITS ============ */
function Benefits() {
  return (
    <section id="benefits" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          Why drive with LoadMitra
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          More loads. Fewer empty kilometres.
        </h2>
        <p className="mt-3 text-muted-foreground">
          We match you to loads by your route — so your truck moves full, both ways.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <article className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--savings) 18%, transparent)", color: "var(--savings)" }}>
              <Repeat className="h-6 w-6" />
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--savings)", color: "#0B1220" }}>🔥 Top pick</span>
          </div>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">Return-load bonus</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Get paid for the trip back home. We find loads within a 5–10 km corridor of your route and add a bonus on top.
          </p>
        </article>

        <article className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--cyan-accent) 18%, transparent)", color: "var(--cyan-accent)" }}>
              <Users className="h-6 w-6" />
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--cyan-accent)", color: "#0B1220" }}>+ bonus</span>
          </div>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">Shared loads</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Fill spare capacity with a second load on the same route and earn extra per trip without extra driving.
          </p>
        </article>

        <article className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Navigation className="h-6 w-6" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground">
              <span className="relative inline-flex h-2 w-2">
                <span className="lm-pulse absolute inset-0 rounded-full" style={{ background: "var(--cyan-accent)", animation: "lm-pulse-dot 1.4s ease-in-out infinite" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--cyan-accent)" }} />
              </span>
              Live
            </span>
          </div>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">Live navigation &amp; OTP</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Turn-by-turn routing to pickup and drop, OTP-verified handovers, and transparent earnings on every job.
          </p>
        </article>
      </div>
    </section>
  );
}

/* ============ HOW IT WORKS ============ */
function HowItWorks() {
  const steps = [
    { icon: Power, title: "Go online", text: "Tap online and start receiving loads matched to your truck and route." },
    { icon: Wallet, title: "Accept a load", text: "See the exact payout, pickup and drop before you accept. No surprises." },
    { icon: Navigation, title: "Deliver & earn", text: "Navigate, verify with OTP, deliver — your earnings update instantly." },
  ];
  return (
    <section id="how" className="bg-secondary/50 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Start earning in 3 steps</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">From going online to a delivered load and money in your pocket.</p>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="relative rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{i + 1}</span>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
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

/* ============ EARNINGS BAND ============ */
function EarningsBand() {
  return (
    <section id="earnings" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12" style={{ background: "var(--navy)", color: "#F8FAFC" }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-40"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--cyan-accent) 0 40px, transparent 40px 80px)" }} />
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "color-mix(in oklab, white 12%, transparent)", color: "var(--cyan-accent)" }}>
              <TrendingUp className="h-3.5 w-3.5" /> Earnings
            </span>
            <h3 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Top captains earn ₹70,000+ a month with LoadMitra.
            </h3>
            <p className="mt-3 max-w-xl text-white/80">
              Transparent payouts, weekly settlements, and incentives for keeping your truck full. Free to join — no monthly fee.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ShieldCheck className="h-4 w-4 text-cyan-accent" /> Verified loads</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Clock className="h-4 w-4 text-cyan-accent" /> Weekly payouts</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><IndianRupee className="h-4 w-4 text-cyan-accent" /> No money in app</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[var(--navy)] shadow-md hover:scale-[1.02]">
              Register your truck <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
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

function StatCard({ value, prefix, suffix, label, icon: Icon }: { value: number; prefix?: string; suffix?: string; label: string; icon: typeof Truck }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useCountUp(value, ref);
  return (
    <div ref={ref} className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span>
      <div className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {prefix}{v.toLocaleString("en-IN")}{suffix}
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
          <StatCard icon={Truck} value={12500} suffix="+" label="Captains onboarded" />
          <StatCard icon={Wallet} value={70000} prefix="₹" suffix="+" label="Top monthly earnings" />
          <StatCard icon={Repeat} value={3800000} label="Empty km filled" />
          <StatCard icon={Star} value={48} label="Avg captain rating ×10" />
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
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary"><Truck className="h-5 w-5 text-primary-foreground" /></span>
            <span className="text-lg font-extrabold tracking-tight text-white">LoadMitra Captain</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/70">
            India's smart freight marketplace — for the captains who keep it moving.
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
        <FooterCol title="For captains" links={["Onboarding", "Earnings", "Safety", "Help"]} />
        <FooterCol title="Company" links={["About", "Careers", "Press", "Contact"]} />
        <div>
          <h4 className="text-sm font-bold text-white">Looking to ship?</h4>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><a href={SHIPPER_PORTAL_URL} className="hover:text-white">Book a truck →</a></li>
            <li><a href={SHIPPER_PORTAL_URL} className="hover:text-white">Shipper app</a></li>
          </ul>
        </div>
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

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-white/70">
        {links.map((l) => (<li key={l}><a className="hover:text-white">{l}</a></li>))}
      </ul>
    </div>
  );
}

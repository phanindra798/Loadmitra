import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck, Phone, ArrowRight, ShieldCheck, Repeat, Wallet, Navigation, User, Mail, ChevronDown } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { SHIPPER_PORTAL_URL } from "@/lib/portals";
import { api, ApiError, setToken } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Captain login · LoadMitra" }],
  }),
  component: LoginPage,
});

type Mode = "signin" | "register";
type Step = "form" | "otp" | "profile";

/** Common country dial codes — India-first. */
const DIAL_CODES = [
  { code: "+91", flag: "🇮🇳" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+971", flag: "🇦🇪" },
  { code: "+65", flag: "🇸🇬" },
  { code: "+61", flag: "🇦🇺" },
  { code: "+966", flag: "🇸🇦" },
];

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [dialCode, setDialCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string>();
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIndia = dialCode === "+91";
  const maxDigits = isIndia ? 10 : 14;
  const phoneValid = isIndia ? /^[6-9]\d{9}$/.test(phone) : /^\d{6,14}$/.test(phone);
  const isRegister = mode === "register";
  const profileValid = name.trim().length >= 2 && emailValid(email);
  const formValid = phoneValid && (!isRegister || profileValid);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  async function sendOtp() {
    if (!formValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.sendOtp(phone, "captain");
      setDevOtp(result.devOtp);
      // The development API displays a real expiring challenge for local testing.
      setOtp("");
      setStep("otp");
      setResendIn(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (otp.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const withProfile = isRegister || step === "profile";
    try {
      const r = await api.verifyOtp({
        phone,
        role: "captain",
        otp,
        dialCode,
        ...(withProfile ? { name: name.trim(), email: email.trim() } : {}),
      });
      setToken(r.token);
      navigate({ to: "/app" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "registration_required") {
        setStep("profile");
      } else {
        setError(e instanceof Error ? e.message : "Verification failed");
      }
    } finally {
      setBusy(false);
    }
  }

  function completeProfile() {
    if (!profileValid) return;
    verify();
  }

  const heading =
    step === "otp"
      ? "Verify your number"
      : step === "profile" || isRegister
        ? "Register your truck"
        : "Captain login";

  const subheading =
    step === "otp"
      ? `Enter the 6-digit code sent to ${dialCode} ${phone}.`
      : step === "profile"
        ? "Just a couple of details to finish setting up."
        : isRegister
          ? "Tell us a bit about you to start earning."
          : "Login with your registered mobile number.";

  return (
    <div className="grid min-h-[100dvh] w-full lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <div
        className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ background: "linear-gradient(160deg, var(--primary), var(--navy))" }}
      >
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <Truck className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">LoadMitra</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Captain
          </span>
        </Link>

        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Never drive empty again.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Get loads going your way, earn extra on return and shared trips, and track every rupee —
            across India.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: Repeat, t: "Return-load bonuses on your trip home" },
              { icon: Wallet, t: "Transparent earnings, weekly payouts" },
              { icon: Navigation, t: "Live navigation with OTP handovers" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/60">Made in India 🇮🇳 · 6 languages</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              Load<span className="text-primary">Mitra</span>
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Captain
            </span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
          {devOtp && step !== "form" && <p role="status" className="mt-3 text-sm font-semibold">Development verification code: {devOtp}</p>}

          {/* Login / Register toggle */}
          {step === "form" && (
            <div className="mt-5 flex gap-4 text-sm">
              {(["signin", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={[
                    "border-b-2 pb-1 font-semibold transition-colors",
                    mode === m
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {m === "signin" ? "Login" : "Register"}
                </button>
              ))}
            </div>
          )}

          {step === "form" ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                sendOtp();
              }}
            >
              {isRegister && (
                <>
                  <TextField
                    id="name"
                    label="Full name"
                    icon={User}
                    placeholder="e.g. Ramesh K."
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                  />
                  <TextField
                    id="email"
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                  />
                </>
              )}

              <div>
                <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phone number
                </label>
                <div className="mt-1.5 flex items-center rounded-xl border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="relative flex items-center border-r border-border">
                    <Phone className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                    <select
                      aria-label="Country code"
                      value={dialCode}
                      onChange={(e) => setDialCode(e.target.value)}
                      className="appearance-none bg-transparent py-3 pl-2 pr-7 text-sm font-semibold text-foreground focus:outline-none"
                    >
                      {DIAL_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                </div>
              </div>
              <Button type="submit" disabled={!formValid || busy} className="h-12 w-full rounded-xl text-base">
                {isRegister ? "Register" : "Send OTP"} <ArrowRight className="h-4 w-4" />
              </Button>
              {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
            </form>
          ) : step === "otp" ? (
            <div className="mt-6 space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  autoFocus
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-12 w-11 rounded-xl border-l text-lg font-bold"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button onClick={verify} disabled={otp.length !== 6 || busy} className="h-12 w-full rounded-xl text-base">
                Verify &amp; continue <ArrowRight className="h-4 w-4" />
              </Button>
              {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Change number
                </button>
                <button
                  type="button"
                  disabled={resendIn > 0 || busy}
                  onClick={sendOtp}
                  className="font-semibold text-primary disabled:text-muted-foreground"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Enter the code shown above for local testing.
              </p>
            </div>
          ) : (
            // step === "profile" — new number signing in for the first time
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                completeProfile();
              }}
            >
              <TextField
                id="name2"
                label="Full name"
                icon={User}
                placeholder="e.g. Ramesh K."
                value={name}
                onChange={setName}
                autoComplete="name"
              />
              <TextField
                id="email2"
                label="Email"
                icon={Mail}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Button type="submit" disabled={!profileValid} className="h-12 w-full rounded-xl text-base">
                Finish &amp; continue <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          <p className="mt-6 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-center text-xs text-muted-foreground">
            Looking to send a load?{" "}
            <a href={SHIPPER_PORTAL_URL} className="font-semibold text-primary hover:underline">
              Go to the shipper app →
            </a>
          </p>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            By continuing you agree to our Terms &amp; Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3 text-base font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

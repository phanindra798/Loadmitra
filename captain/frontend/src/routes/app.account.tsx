import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Pencil, Sun, Moon, Languages, Truck, FileCheck, Headphones, Info, Star,
  LogOut, ChevronRight, ShieldCheck, BadgeCheck, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTheme } from "@/hooks/use-theme";
import { LANGS, useLanguage } from "@/features/captain/i18n";
import { useCaptain } from "@/features/captain/captain-context";
import { OnlineToggle } from "@/components/app/online-toggle";
import { truckById } from "@/features/captain/mock-data";
import { SHIPPER_PORTAL_URL } from "@/lib/portals";
import { fetchProfile, clearSession, type Profile } from "@/lib/account";
import { api } from "@/lib/api";

export const Route = createFileRoute("/app/account")({
  component: AccountPage,
});

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function AccountPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const { profile, refreshProfile } = useCaptain();
  const truck = truckById(profile.truckTypeId);
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [promo, setPromo] = useState(true);

  // Registered identity (from the API) overrides the demo name/email if present.
  const [account, setAccount] = useState<Profile | null>(null);
  useEffect(() => {
    fetchProfile().then(setAccount);
  }, []);
  const displayName = account?.name || profile.name;
  const [editOpen, setEditOpen] = useState(false);

  async function saveEdit(name: string, email: string) {
    try {
      const { user } = await api.updateMe({ name, email });
      setAccount({ name: user.name, email: user.email, phone: user.phone });
      refreshProfile(); // propagate the new name to the dashboard + sidebar
      setEditOpen(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update profile");
    }
  }

  function logout() {
    clearSession();
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title="Account" back={false} />

      <div className="space-y-5 px-4 pt-4 sm:px-6">
        {/* Profile */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
            style={{ background: `hsl(${profile.hue} 60% 45%)` }}
          >
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-base font-bold text-foreground">
              {displayName} {profile.kycVerified && <ShieldCheck className="h-4 w-4 shrink-0 text-success" />}
            </p>
            {account?.email && <p className="truncate text-xs text-muted-foreground">{account.email}</p>}
            <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="h-3.5 w-3.5 fill-current text-savings" /> {profile.rating}
              </span>
              · {profile.trips.toLocaleString("en-IN")} trips
            </p>
            <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {profile.joinedLabel}
            </span>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label="Edit profile"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-secondary"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* Availability */}
        <Section title="Availability" icon={Truck}>
          <p className="mb-2 text-xs text-muted-foreground">
            Toggle whether you receive load requests right now.
          </p>
          <OnlineToggle size="block" />
        </Section>

        {/* Vehicle */}
        <Section title="Your vehicle" icon={Truck}>
          <div className="flex items-center gap-3 py-1">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
              {truck?.emoji ?? "🚚"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{truck?.name ?? "Truck"}</p>
              <p className="truncate text-xs text-muted-foreground">{truck?.desc}</p>
            </div>
            <span className="rounded-lg border border-border bg-background px-2.5 py-1 text-sm font-bold text-foreground">
              {profile.vehicleNumber}
            </span>
          </div>
        </Section>

        {/* Documents / KYC */}
        <Section title="Documents & KYC" icon={FileCheck}>
          {[
            { label: "Driving licence", status: "Verified" },
            { label: "Vehicle RC", status: "Verified" },
            { label: "Insurance", status: "Verified" },
            { label: "Aadhaar / PAN", status: profile.kycVerified ? "Verified" : "Pending" },
          ].map((d) => (
            <div key={d.label} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                <FileCheck className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground">{d.label}</span>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  d.status === "Verified" ? "bg-success/10 text-success" : "bg-savings/10 text-savings",
                ].join(" ")}
              >
                <BadgeCheck className="h-3.5 w-3.5" /> {d.status}
              </span>
            </div>
          ))}
        </Section>

        {/* Language */}
        <Section title="Language" icon={Languages}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={[
                    "flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40",
                  ].join(" ")}
                >
                  <span className={["text-sm font-bold", active ? "text-primary" : "text-foreground"].join(" ")}>
                    {l.native}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{l.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Appearance" icon={theme === "dark" ? Moon : Sun}>
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary p-1.5">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={[
                  "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold capitalize transition-all",
                  theme === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
                ].join(" ")}
              >
                {t === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {t}
              </button>
            ))}
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <ToggleRow label="New load alerts" hint="Get notified of loads near you" checked={push} onChange={setPush} />
          <ToggleRow label="SMS updates" hint="Trip & payout updates by SMS" checked={sms} onChange={setSms} />
          <ToggleRow label="Incentives & offers" hint="Bonus and surge alerts" checked={promo} onChange={setPromo} />
        </Section>

        {/* More */}
        <Section title="More">
          <LinkRow icon={Headphones} label="Help & support" />
          <LinkRow icon={Phone} label="Contact captain care" />
          <LinkRow icon={Info} label="About LoadMitra" />
          <LinkRow icon={Star} label="Rate the app" />
        </Section>

        {/* Switch to shipper */}
        <a
          href={SHIPPER_PORTAL_URL}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground hover:bg-secondary"
        >
          <Truck className="h-4 w-4 text-primary" /> Need to send a load? Open shipper app
        </a>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>

        <p className="pb-2 text-center text-[11px] text-muted-foreground">
          LoadMitra Captain · v0.1 · Made in India 🇮🇳
        </p>
      </div>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        name={displayName}
        email={account?.email ?? ""}
        onSave={saveEdit}
      />
    </div>
  );
}

/* ============ Edit profile ============ */
function EditProfileDialog({
  open,
  onOpenChange,
  name,
  email,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  email: string;
  onSave: (name: string, email: string) => void;
}) {
  const [n, setN] = useState(name);
  const [e, setE] = useState(email);

  function handleOpenChange(v: boolean) {
    if (v) {
      setN(name);
      setE(email);
    }
    onOpenChange(v);
  }

  const emailValid = e.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const valid = n.trim().length >= 2 && emailValid;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your name and email.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (valid) onSave(n.trim(), e.trim());
          }}
        >
          <div>
            <label htmlFor="edit-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Full name
            </label>
            <input
              id="edit-name"
              value={n}
              onChange={(ev) => setN(ev.target.value)}
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label htmlFor="edit-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Email
            </label>
            <input
              id="edit-email"
              type="email"
              value={e}
              onChange={(ev) => setE(ev.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-3 text-base font-semibold text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button type="submit" disabled={!valid} className="h-11 w-full rounded-xl">
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />} {title}
      </h2>
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LinkRow({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

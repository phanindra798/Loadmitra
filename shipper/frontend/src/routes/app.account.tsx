import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Sun,
  Moon,
  Languages,
  Home as HomeIcon,
  Briefcase,
  Headphones,
  Info,
  Star,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Phone,
  MessageSquare,
  Mail,
  Truck,
  Leaf,
  Repeat,
  Users,
  MapPin,
} from "lucide-react";
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
import { ChatSheet } from "@/components/app/chat-sheet";
import { useTheme } from "@/hooks/use-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { clearSession } from "@/lib/account";
import { api } from "@/lib/api";
import { useProfile } from "@/features/shipper/profile-context";
import { LANGS, useLanguage, useT } from "@/features/shipper/i18n";
import { SAVED_PLACES } from "@/features/shipper/mock-data";

export const Route = createFileRoute("/app/account")({
  component: AccountPage,
});

/** Demo customer-care line — not a real, dialable number. */
const CARE_DISPLAY = "+91 90909 90909";
const CARE_TEL = "tel:+919090990909";
const CARE_EMAIL = "support@loadmitra.in";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "LM"
  );
}

function formatPhone(phone: string): string {
  return phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}

function AccountPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  // Notification preferences now persist (cookie-backed) so they survive reloads.
  const [push, setPush] = usePersistedState("lm-notif-push", true);
  const [sms, setSms] = usePersistedState("lm-notif-sms", true);
  const [promo, setPromo] = usePersistedState("lm-notif-promo", false);

  // Saved app rating (0 = not yet rated).
  const [rating, setRating] = usePersistedState("lm-app-rating", 0);

  // Signed-in profile from the shared context (shows the registered name everywhere).
  const { profile, setProfile, displayName } = useProfile();
  const displayPhone = profile ? formatPhone(profile.phone) : "+91 98765 43210";

  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  async function saveEdit(name: string, email: string) {
    try {
      const { user } = await api.updateMe({ name, email });
      setProfile({ name: user.name, email: user.email, phone: user.phone });
      setEditOpen(false);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update profile");
    }
  }

  function logout() {
    clearSession();
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl pb-28 lg:pb-10">
      <PageHeader title={t("account.title")} back={false} />

      <div className="space-y-5 px-4 pt-4 sm:px-6">
        {/* Profile */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-base font-bold text-foreground">
              {displayName} <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            </p>
            <p className="truncate text-sm text-muted-foreground">{displayPhone}</p>
            {profile?.email && (
              <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
            )}
            <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {t("common.shipperAccount")}
            </span>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label={t("account.editProfile")}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-foreground hover:bg-secondary"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* Language */}
        <Section title={t("account.language")} icon={Languages}>
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
          <p className="mt-2 text-[11px] text-muted-foreground">{t("account.langSaved")}</p>
        </Section>

        {/* Appearance */}
        <Section title={t("account.appearance")} icon={theme === "dark" ? Moon : Sun}>
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary p-1.5">
            {(["light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={[
                  "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                  theme === mode ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
                ].join(" ")}
              >
                {mode === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {t(mode === "light" ? "account.lightLabel" : "account.darkLabel")}
              </button>
            ))}
          </div>
        </Section>

        {/* Notifications */}
        <Section title={t("account.notifications")}>
          <ToggleRow
            label={t("account.push")}
            hint={t("account.pushHint")}
            checked={push}
            onChange={(v) => {
              setPush(v);
              toast.success(`${t("account.push")} ${v ? t("common.on") : t("common.off")}`);
            }}
          />
          <ToggleRow
            label={t("account.sms")}
            hint={t("account.smsHint")}
            checked={sms}
            onChange={(v) => {
              setSms(v);
              toast.success(`${t("account.sms")} ${v ? t("common.on") : t("common.off")}`);
            }}
          />
          <ToggleRow
            label={t("account.promo")}
            hint={t("account.promoHint")}
            checked={promo}
            onChange={(v) => {
              setPromo(v);
              toast.success(`${t("account.promo")} ${v ? t("common.on") : t("common.off")}`);
            }}
          />
        </Section>

        {/* Saved places */}
        <Section title={t("account.savedPlaces")}>
          {SAVED_PLACES.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                {p.kind === "home" ? <HomeIcon className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <p className="truncate text-xs text-muted-foreground">{p.address}</p>
              </div>
              <button aria-label={`Edit ${p.label}`} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Section>

        {/* More */}
        <Section title={t("account.more")}>
          <LinkRow icon={Headphones} label={t("account.help")} onClick={() => setHelpOpen(true)} />
          <LinkRow icon={Info} label={t("account.about")} onClick={() => setAboutOpen(true)} />
          <LinkRow
            icon={Star}
            label={t("account.rate")}
            value={rating > 0 ? `${rating}★` : undefined}
            onClick={() => setRateOpen(true)}
          />
        </Section>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" /> {t("account.logout")}
        </button>

        <p className="pb-2 text-center text-[11px] text-muted-foreground">LoadMitra · v0.1 · Made in India 🇮🇳</p>
      </div>

      {/* Edit profile */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        name={displayName}
        email={profile?.email ?? ""}
        onSave={saveEdit}
      />

      {/* Help & support */}
      <HelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onStartChat={() => {
          setHelpOpen(false);
          setSupportChatOpen(true);
        }}
      />

      {/* About LoadMitra */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Rate the app */}
      <RateDialog
        open={rateOpen}
        onOpenChange={setRateOpen}
        rating={rating}
        onSubmit={(stars) => {
          setRating(stars);
          setRateOpen(false);
          toast.success(t("rate.thanks"), { description: t("rate.thanksDesc", { n: stars }) });
        }}
      />

      {/* Support chat */}
      <ChatSheet
        open={supportChatOpen}
        onOpenChange={setSupportChatOpen}
        title={t("support.title")}
        subtitle={t("support.subtitle")}
        avatar="LM"
        seed={[
          {
            id: "s0",
            from: "them",
            text: t("support.greeting", { name: displayName.split(" ")[0] }),
            time: "Now",
          },
        ]}
        autoReplies={[t("support.r1"), t("support.r2"), t("support.r3")]}
        placeholder={t("support.placeholder")}
      />
    </div>
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

function LinkRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      {value && <span className="text-xs font-bold text-primary">{value}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
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
  const t = useT();
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
          <DialogTitle>{t("account.editProfile")}</DialogTitle>
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
              {t("login.fullName")}
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
              {t("login.email")}
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
            {t("common.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Help & support ============ */
function HelpDialog({
  open,
  onOpenChange,
  onStartChat,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStartChat: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("help.title")}</DialogTitle>
          <DialogDescription>{t("help.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <a
            href={CARE_TEL}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <Phone className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{t("help.call")}</span>
              <span className="block text-sm font-semibold text-primary">{CARE_DISPLAY}</span>
              <span className="block text-xs text-muted-foreground">{t("help.callSub")}</span>
            </span>
          </a>

          <button
            onClick={onStartChat}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <MessageSquare className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{t("help.chat")}</span>
              <span className="block text-xs text-muted-foreground">{t("help.chatSub")}</span>
            </span>
          </button>

          <a
            href={`mailto:${CARE_EMAIL}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cyan-accent/15 text-cyan-accent">
              <Mail className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{t("help.email")}</span>
              <span className="block text-sm font-semibold text-primary">{CARE_EMAIL}</span>
            </span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ About LoadMitra ============ */
function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT();
  const features = [
    { icon: Truck, key: "about.f1" as const },
    { icon: Repeat, key: "about.f2" as const },
    { icon: Users, key: "about.f3" as const },
    { icon: MapPin, key: "about.f4" as const },
    { icon: Leaf, key: "about.f5" as const },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </span>
            <DialogTitle>{t("about.title")}</DialogTitle>
          </div>
          <DialogDescription>{t("about.subtitle")}</DialogDescription>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">{t("about.body")}</p>

        <ul className="space-y-2.5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.key} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-foreground">{t(f.key)}</span>
              </li>
            );
          })}
        </ul>

        <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {t("about.version")}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Rate the app ============ */
function RateDialog({
  open,
  onOpenChange,
  rating,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rating: number;
  onSubmit: (stars: number) => void;
}) {
  const t = useT();
  const [sel, setSel] = useState(rating);
  const [hover, setHover] = useState(0);

  // Reflect the saved rating each time the dialog opens.
  function handleOpenChange(v: boolean) {
    if (v) setSel(rating);
    onOpenChange(v);
  }

  const labels = ["", t("rate.poor"), t("rate.fair"), t("rate.good"), t("rate.great"), t("rate.love")];
  const shown = hover || sel;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("rate.title")}</DialogTitle>
          <DialogDescription>{t("rate.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}★`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setSel(n)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={[
                    "h-9 w-9 transition-colors",
                    n <= shown ? "fill-current text-savings" : "text-muted-foreground/40",
                  ].join(" ")}
                />
              </button>
            ))}
          </div>
          <p className="h-5 text-sm font-semibold text-foreground">{labels[shown]}</p>
        </div>

        <Button disabled={sel < 1} onClick={() => onSubmit(sel)} className="h-11 w-full rounded-xl">
          {rating > 0 ? t("rate.update") : t("rate.submit")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shipperApi } from "@/lib/api";
import { useT } from "@/features/shipper/i18n";

/** Codes live only in this screen's memory; only their keyed hashes are stored by the API. */
export function HandoverCode({ bookingId, stage }: { bookingId: string; stage: "picked" | "delivered" }) {
  const t = useT();
  const [challenge, setChallenge] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [readyAt, setReadyAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const valid = challenge && Date.parse(challenge.expiresAt) > now;
  const cooldown = Math.max(0, Math.ceil((readyAt - now) / 1000));

  async function generate() {
    if (busyRef.current || Date.now() < readyAt) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    // A replacement invalidates the previous code, even if the response is lost.
    setChallenge(null);
    try {
      const result = await shipperApi.issueHandoverOtp(bookingId);
      if (result.stage !== stage) throw new Error("Trip changed. Wait for tracking to refresh.");
      setChallenge(result);
      setReadyAt(Date.now() + 30_000);
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate a handover code");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3" aria-label="Handover verification">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {stage === "picked" ? t("track.pickupOtp") : t("track.dropOtp")}
          </p>
          {valid && <p className="text-2xl font-extrabold tracking-[0.3em]">{challenge.code}</p>}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Share only when the goods are being {stage === "picked" ? "picked up" : "delivered"}.
        {valid ? ` Expires in ${Math.ceil((Date.parse(challenge.expiresAt) - now) / 60_000)} min.`
          : challenge ? " This code has expired. Generate a new one." : " Generate a code when you are ready."}
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      <Button className="mt-3 w-full rounded-xl" onClick={generate} disabled={busy || cooldown > 0}>
        {busy ? "Generating…" : cooldown > 0 ? `New code available in ${cooldown}s` : "Generate new code"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">A new code replaces the previous one. Five attempts per code.</p>
    </section>
  );
}

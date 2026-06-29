import { useState } from "react";
import { toast } from "sonner";
import { Phone, MessageSquare, Star, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSheet } from "@/components/app/chat-sheet";
import { useT } from "@/features/shipper/i18n";
import { truckById } from "@/features/shipper/mock-data";
import type { Captain } from "@/features/shipper/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CaptainCard({
  captain,
  showActions = true,
  className,
}: {
  captain: Captain;
  showActions?: boolean;
  className?: string;
}) {
  const t = useT();
  const truck = truckById(captain.truckTypeId);
  const [chatOpen, setChatOpen] = useState(false);
  const firstName = captain.name.split(" ")[0];
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
          style={{ background: `hsl(${captain.hue} 60% 45%)` }}
        >
          {initials(captain.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-bold text-foreground">{captain.name}</p>
            {captain.badges.includes("verified") && (
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Star className="h-3.5 w-3.5 fill-current text-savings" /> {captain.rating}
            </span>
            <span>· {t("captain.tripsSuffix", { n: captain.trips.toLocaleString("en-IN") })}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-foreground">{captain.vehicleNumber}</p>
          <p className="text-xs text-muted-foreground">{truck?.name ?? "Truck"}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" /> {t("captain.minToPickup", { min: captain.etaMins })}
        </span>
        {showActions && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                toast.success(t("captain.connecting", { name: firstName }), {
                  description: t("captain.connectingDesc"),
                })
              }
              aria-label={t("captain.connecting", { name: captain.name })}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary hover:bg-secondary"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              aria-label={t("captain.messagePlaceholder", { name: captain.name })}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary hover:bg-secondary"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {showActions && (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("captain.maskedNote")}</p>
      )}

      {showActions && (
        <ChatSheet
          open={chatOpen}
          onOpenChange={setChatOpen}
          title={captain.name}
          subtitle={`${truck?.name ?? "Truck"} · ${captain.vehicleNumber}`}
          avatar={initials(captain.name)}
          accentHue={captain.hue}
          placeholder={t("captain.messagePlaceholder", { name: firstName })}
          seed={[
            {
              id: "c0",
              from: "them",
              text: t("captain.greeting", { name: firstName, min: captain.etaMins }),
              time: "Now",
            },
          ]}
          autoReplies={[t("captain.r1"), t("captain.r2"), t("captain.r3"), t("captain.r4")]}
        />
      )}
    </div>
  );
}

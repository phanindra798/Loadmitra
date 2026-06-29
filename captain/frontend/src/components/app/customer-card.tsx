import { useState } from "react";
import { toast } from "sonner";
import { Phone, MessageSquare, Star, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSheet } from "@/components/app/chat-sheet";
import type { Trip } from "@/features/captain/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Demo masked customer number — calls connect through a privacy relay. */
const MASKED_NUMBER = "+91 98765 ••• 21";

/** The customer (shipper) on an active trip, from the captain's side. */
export function CustomerCard({
  trip,
  showActions = true,
  className,
}: {
  trip: Trip;
  showActions?: boolean;
  className?: string;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const firstName = trip.customerName.split(" ")[0];

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials(trip.customerName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-foreground">{trip.customerName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Star className="h-3.5 w-3.5 fill-current text-savings" /> {trip.customerRating}
            </span>
            <span className="inline-flex items-center gap-1">
              · <Package className="h-3.5 w-3.5" /> {trip.goodsType}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-foreground">
            {trip.loadWeightKg.toLocaleString("en-IN")} kg
          </p>
          <p className="text-xs text-muted-foreground">{trip.truckTypeName}</p>
        </div>
      </div>

      {showActions && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">Chats &amp; calls are number-masked.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                toast.success(`Connecting to ${firstName}…`, {
                  description: `Calling on a masked number · ${MASKED_NUMBER}`,
                })
              }
              aria-label={`Call ${trip.customerName} (number masked)`}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary hover:bg-secondary"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              aria-label={`Chat with ${trip.customerName}`}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary hover:bg-secondary"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showActions && (
        <ChatSheet
          open={chatOpen}
          onOpenChange={setChatOpen}
          title={trip.customerName}
          subtitle={`${trip.goodsType} · ${trip.loadWeightKg.toLocaleString("en-IN")} kg`}
          avatar={initials(trip.customerName)}
          placeholder={`Message ${firstName}…`}
          seed={[
            {
              id: "c0",
              from: "them",
              text: `Hi! This is ${firstName}. Please collect the load from the gate — I'll share the OTP when you arrive.`,
              time: "Now",
            },
          ]}
          autoReplies={[
            "Okay, I'll be at the gate.",
            "Sure, the OTP is ready.",
            "Thanks, drive safe!",
            "Please handle the boxes carefully.",
          ]}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
}

function timeLabel(): string {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

const DEFAULT_REPLIES = [
  "Sure, thanks!",
  "Okay, I'll be ready.",
  "Got it 👍",
  "Please call if you can't find the spot.",
];

/**
 * Lightweight in-app chat thread shown as a right-side drawer (full-width on
 * mobile). Messages are local state with canned auto-replies — the real-time
 * socket/transport drops in here later without changing call sites.
 */
export function ChatSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  avatar,
  seed = [],
  autoReplies = DEFAULT_REPLIES,
  placeholder = "Type a message…",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  avatar?: string;
  seed?: ChatMessage[];
  autoReplies?: string[];
  placeholder?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(seed);
  const [text, setText] = useState("");
  const replyIdx = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages(seed);
      replyIdx.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send() {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: `me-${m.length}-${t.length}`, from: "me", text: t, time: timeLabel() }]);
    setText("");
    const reply = autoReplies[replyIdx.current % autoReplies.length];
    replyIdx.current += 1;
    window.setTimeout(() => {
      setMessages((m) => [...m, { id: `them-${m.length}`, from: "them", text: reply, time: timeLabel() }]);
    }, 900);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md" aria-describedby={undefined}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 pr-12">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {avatar ?? title.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-secondary/30 px-4 py-4 lm-no-scrollbar">
          {messages.length === 0 && (
            <p className="mx-auto mt-6 max-w-[16rem] text-center text-xs text-muted-foreground">
              Start the conversation — messages are private and number-masked.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  m.from === "me"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border bg-card text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn("mt-0.5 text-[10px]", m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {m.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-border bg-background p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

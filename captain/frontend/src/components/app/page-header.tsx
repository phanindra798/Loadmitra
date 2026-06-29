import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

/** Sticky header for inner app pages with an optional back button + right slot. */
export function PageHeader({
  title,
  subtitle,
  back = true,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const { open } = useSidebar();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6",
        // When the sidebar is collapsed, leave room for the floating reopen button (lg).
        !open && !back && "lg:pl-16",
        className,
      )}
    >
      {back && (
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Go back"
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
          {title}
        </h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

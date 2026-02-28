"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { closeEvent } from "@/app/actions";

export function CloseEventButton({ eventId, isClosed }: { eventId: string; isClosed: boolean }) {
  const [error, formAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        await closeEvent(formData);
        return null;
      } catch {
        return "Failed to close event. Try again.";
      }
    },
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />

      {error && (
        <p className="text-sm font-bold text-destructive mb-2">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isPending || isClosed}
        className="w-full border-2 border-foreground bg-foreground text-background font-bold uppercase tracking-wider hover:bg-foreground/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50"
      >
        <Lock className="h-4 w-4 mr-2" />
        {isClosed ? "Event Closed" : isPending ? "Closing..." : "show results"}
      </Button>
      {!isClosed && (
        <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
          <p>share the link with the crew</p>
          <p>once everyone&apos;s in, hit show results</p>
        </div>
      )}
    </form>
  );
}

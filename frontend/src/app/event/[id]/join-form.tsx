"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BudgetSlider } from "@/components/budget-slider";
import { joinEvent } from "@/app/actions";

export function JoinForm({
  eventId,
  maxBudget = 100,
}: {
  eventId: string;
  maxBudget?: number;
}) {
  const router = useRouter();
  const [error, formAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        await joinEvent(formData);
        router.refresh();
        return null;
      } catch {
        return "Failed to join. Try again.";
      }
    },
    null
  );

  return (
    <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full">
      <CardHeader>
        <CardTitle className="uppercase tracking-wide text-2xl">
          Join the plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="eventId" value={eventId} />

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Your name *
            </label>
            <Input
              name="name"
              placeholder="Your name"
              required
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Your budget range *
            </label>
            <BudgetSlider nameMin="minBudget" nameMax="maxBudget" max={maxBudget} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Preferences
            </label>
            <Textarea
              name="preferences"
              placeholder="Thai food, scary movie, outdoor activity..."
              rows={2}
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Phone number (optional)
            </label>
            <p className="text-xs text-muted-foreground">
              Add to link event with account & get text updates
            </p>
            <Input
              name="phoneNumber"
              type="tel"
              placeholder="+1 (555) 123-4567"
              className="border-2 border-foreground"
            />
          </div>

          {error && (
            <p className="text-sm font-bold text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full border-2 border-foreground bg-money text-foreground font-bold uppercase tracking-wider hover:bg-money/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50"
          >
            {isPending ? "Joining..." : "I'm in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BudgetSlider } from "@/components/budget-slider";
import { createEvent } from "./actions";

const ACTIVITY_TYPES = ["dinner", "drinks", "trip", "event", "gift", "other"];

export default function Home() {
  return (
    <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle className="uppercase tracking-wide text-lg">
          Start a plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createEvent} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              What&apos;s the plan?
            </label>
            <Input
              name="name"
              placeholder="Birthday dinner for Alex"
              required
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Where?
            </label>
            <Input
              name="location"
              placeholder="Downtown, NYC"
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map((type) => (
                <label key={type} className="cursor-pointer">
                  <input
                    type="radio"
                    name="activityType"
                    value={type}
                    className="peer sr-only"
                    defaultChecked={type === "dinner"}
                  />
                  <span className="inline-block border-2 border-foreground px-3 py-1 text-xs font-bold uppercase peer-checked:bg-foreground peer-checked:text-background transition-colors hover:bg-muted">
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Your name
            </label>
            <Input
              name="creatorName"
              placeholder="Your name"
              required
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Your budget range
            </label>
            <BudgetSlider nameMin="minBudget" nameMax="maxBudget" />
          </div>

          <Button
            type="submit"
            className="w-full border-2 border-foreground bg-money text-foreground font-bold uppercase tracking-wider hover:bg-money/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
          >
            Create &amp; Share Link
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createEvent } from "./actions";

export default function Home() {
  return (
    <Card className="border-2 max-w-lg mx-auto border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle className="uppercase tracking-wide text-lg">
          Create new event
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createEvent} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Event name *
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
              Description
            </label>
            <Textarea
              name="description"
              placeholder="What's the occasion? Any details people should know?"
              rows={3}
              className="border-2 border-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider">
              Location (zipcode) *
            </label>
            <Input
              name="zipcode"
              placeholder="15213"
              required
              maxLength={10}
              className="border-2 border-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider">
                Start date
              </label>
              <Input
                type="date"
                name="dateStart"
                className="border-2 border-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider">
                End date
              </label>
              <Input
                type="date"
                name="dateEnd"
                className="border-2 border-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider">
                Start time
              </label>
              <Input
                type="time"
                name="timeStart"
                className="border-2 border-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider">
                End time
              </label>
              <Input
                type="time"
                name="timeEnd"
                className="border-2 border-foreground"
              />
            </div>
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

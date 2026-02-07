import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Lock, MapPin } from "lucide-react";
import { JoinForm } from "./join-form";
import { ParticipantList, BudgetSummary } from "./participant-list";
import { CloseEventButton } from "./close-event-button";
import { CopyLinkButton } from "./copy-link-button";
import { Suggestions } from "./suggestions";

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const isClosed = event.is_closed ?? false;

  const hasDateRange = event.date_start || event.date_end;
  const hasTimeRange = event.time_start || event.time_end;

  return (
    <div className="flex flex-col md:h-full gap-4 px-8">
      {/* Left + Right columns */}
      <div className="flex flex-col md:flex-row md:flex-1 md:min-h-0 md:items-stretch gap-3 pb-1">
        {/* Left column: event name + details */}
        <div className="flex flex-col md:w-80 md:shrink-0 md:min-h-0 gap-4">
          {/* Event name box */}
          <Card className="border-2 py-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <CardContent className="flex items-center gap-3">
              <div>
              <h2 className="text-2xl font-bold uppercase tracking-wide">
                Event:
              </h2>
              <h2 className="text-2xl font-bold uppercase tracking-wide">
                {event.name}
                </h2>
                </div>
              {isClosed && (
                <Badge
                  variant="outline"
                  className="border-2 border-foreground font-bold uppercase text-xs shrink-0 flex items-center gap-1"
                >
                  <Lock className="h-3 w-3" />
                  Closed
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Details box */}
          <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-1 md:min-h-0">
            <CardHeader className="shrink-0">
              <CardTitle className="text-sm font-bold uppercase tracking-wide">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 gap-3">
              {/* Static event info */}
              <div className="space-y-2 shrink-0">
                {event.description && (
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                )}
                {event.zipcode && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {event.zipcode}
                  </span>
                )}
                {(hasDateRange || hasTimeRange) && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {hasDateRange && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {event.date_start && formatDate(event.date_start)}
                        {event.date_start && event.date_end && " \u2013 "}
                        {event.date_end && formatDate(event.date_end)}
                      </span>
                    )}
                    {hasTimeRange && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {event.time_start && formatTime(event.time_start)}
                        {event.time_start && event.time_end && " \u2013 "}
                        {event.time_end && formatTime(event.time_end)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Budget summary — always visible, not scrollable */}
              <BudgetSummary
                eventId={id}
                initialParticipants={participants ?? []}
                isClosed={isClosed}
              />

              {/* Scrollable participant list */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-brutal">
                <ParticipantList
                  eventId={id}
                  initialParticipants={participants ?? []}
                  isClosed={isClosed}
                />
              </div>

              {/* Buttons pinned to bottom */}
              <div className="gap-3 flex flex-col shrink-0">
                <CopyLinkButton />
                <CloseEventButton eventId={id} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: join form when open, suggestions when closed */}
        {!isClosed ? (
          <div className="flex-1 md:overflow-y-auto scrollbar-brutal md:min-h-0">
            <div className="max-w-2xl mx-auto h-full">
              <JoinForm eventId={id} />
            </div>
          </div>
        ) : (
          <div className="flex-1 md:min-h-0">
            <Suggestions
              eventName={event.name}
              zipcode={event.zipcode}
              participants={(participants ?? []).map((p) => ({
                name: p.name,
                min_budget: p.min_budget,
                max_budget: p.max_budget,
                preferences: p.preferences,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

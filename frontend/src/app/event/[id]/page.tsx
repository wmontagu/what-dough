import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Lock, MapPin } from "lucide-react";
import { JoinForm } from "./join-form";
import { ParticipantList } from "./participant-list";
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
    <div className="space-y-6 max-w-[80vw] mx-auto">
      {/* Event title at the top */}
      <div className="flex justify-center">
      <Card className="border-2 py-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block">
        <CardContent className="flex items-center gap-3">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-center">
            Event: {event.name}
          </h2>
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
      </div>

      {/* Main content: sidebar + centered join form */}
      <div className="flex flex-col min-w-1/2 md:flex-row md:items-stretch gap-8">
        {/* Left sidebar: event details + copy link */}
        <div className="flex">
          <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wide">
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 flex justify-between flex-col h-full">
              <div>
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
              <ParticipantList
                eventId={id}
                initialParticipants={participants ?? []}
                isClosed={isClosed}
                />
                </div>
              <div className="gap-3 flex flex-col">
                <CopyLinkButton />
                <CloseEventButton eventId={id} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: join form when open, suggestions when closed */}
        {!isClosed ? (
          <div className="mx-auto space-y-6 min-w-1/2">
            <JoinForm eventId={id} />
          </div>
        ) : (
          <div className="flex-1">
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

        {/* Invisible spacer to balance the sidebar so the form is truly centered */}
        {!isClosed && <div className="hidden md:block md:w-64 md:shrink-0" />}
      </div>
    </div>
  );
}

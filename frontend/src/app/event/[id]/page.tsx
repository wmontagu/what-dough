import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { JoinForm } from "./join-form";
import { ParticipantList } from "./participant-list";

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

  return (
    <div className="space-y-6">
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-lg font-bold uppercase tracking-wide">
              {event.name}
            </CardTitle>
            {event.activity_type && (
              <Badge
                variant="outline"
                className="border-2 border-foreground font-bold uppercase text-xs shrink-0"
              >
                {event.activity_type}
              </Badge>
            )}
          </div>
          {event.location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {event.location}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <ParticipantList
            eventId={id}
            initialParticipants={participants ?? []}
          />
        </CardContent>
      </Card>

      <JoinForm eventId={id} />
    </div>
  );
}

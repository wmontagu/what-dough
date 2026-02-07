"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, DollarSign } from "lucide-react";

type Participant = {
  id: string;
  name: string;
  min_budget: number;
  max_budget: number;
  created_at: string;
};

export function ParticipantList({
  eventId,
  initialParticipants,
}: {
  eventId: string;
  initialParticipants: Participant[];
}) {
  const [participants, setParticipants] =
    useState<Participant[]>(initialParticipants);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as Participant]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const overlapMin = Math.max(...participants.map((p) => p.min_budget), 0);
  const overlapMax = Math.min(...participants.map((p) => p.max_budget), Infinity);
  const hasOverlap = participants.length > 1 && overlapMin <= overlapMax;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="font-bold">
          {participants.length} participant{participants.length !== 1 && "s"}
        </span>
      </div>

      {participants.length > 0 && (
        <div className="space-y-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-2 border-foreground p-3"
            >
              <span className="font-bold text-sm">{p.name}</span>
              <span className="text-sm font-mono flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {p.min_budget}&ndash;{p.max_budget}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasOverlap && (
        <div className="border-2 border-money bg-money/10 p-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-1">
            Sweet spot
          </p>
          <p className="text-lg font-bold">
            ${overlapMin}&ndash;${overlapMax}
            <span className="text-xs text-muted-foreground ml-2">per person</span>
          </p>
        </div>
      )}

      {participants.length > 1 && !hasOverlap && (
        <div className="border-2 border-destructive bg-destructive/10 p-3">
          <p className="text-xs font-bold uppercase tracking-wider">
            No budget overlap yet
          </p>
        </div>
      )}
    </div>
  );
}

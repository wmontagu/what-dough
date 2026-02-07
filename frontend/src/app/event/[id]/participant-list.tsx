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
  isClosed,
}: {
  eventId: string;
  initialParticipants: Participant[];
  isClosed: boolean;
}) {
  const [participants, setParticipants] =
    useState<Participant[]>(initialParticipants);

  useEffect(() => {
    if (isClosed) return;

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
  }, [eventId, isClosed]);

  // Calculate aggregate price point from all participants' budgets
  const overlapMin = Math.max(...participants.map((p) => p.min_budget), 0);
  const overlapMax = Math.min(
    ...participants.map((p) => p.max_budget),
    Infinity
  );
  const hasOverlap = participants.length > 1 && overlapMin <= overlapMax;

  const avgMin =
    participants.length > 0
      ? Math.round(
          participants.reduce((sum, p) => sum + p.min_budget, 0) /
            participants.length
        )
      : 0;
  const avgMax =
    participants.length > 0
      ? Math.round(
          participants.reduce((sum, p) => sum + p.max_budget, 0) /
            participants.length
        )
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="font-bold">
          {participants.length} participant{participants.length !== 1 && "s"}
        </span>
      </div>

      {/* Sidebar: Show only names — budget and preferences are never shown per-participant */}
      {participants.length > 0 && (
        <div className="space-y-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center border-2 border-foreground p-3"
            >
              <span className="font-bold text-sm">{p.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Closed state: Show aggregate price point */}
      {isClosed && participants.length > 0 && (
        <div className="space-y-3">
          {hasOverlap ? (
            <div className="border-2 border-money bg-money/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Desired Price Point
              </p>
              <p className="text-lg font-bold">
                ${overlapMin}&ndash;${overlapMax}
                <span className="text-xs text-muted-foreground ml-2">
                  per person
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on the overlap of all {participants.length} participants&apos;
                budgets
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-destructive bg-destructive/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-1">
                  No exact budget overlap
                </p>
                <p className="text-xs text-muted-foreground">
                  Participants&apos; budgets don&apos;t perfectly overlap
                </p>
              </div>
              <div className="border-2 border-foreground bg-muted/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Average Price Range
                </p>
                <p className="text-lg font-bold">
                  ${avgMin}&ndash;${avgMax}
                  <span className="text-xs text-muted-foreground ml-2">
                    per person
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Join phase: no budget info shown */}
      {!isClosed && participants.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No one has joined yet. Share the link to get started!
        </p>
      )}
    </div>
  );
}

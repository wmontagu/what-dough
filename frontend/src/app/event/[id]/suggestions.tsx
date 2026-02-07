"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, DollarSign, Star, MapPin, ExternalLink } from "lucide-react";

type Suggestion = {
  name: string;
  type: string;
  cost_per_person: number;
  why_it_fits: string;
  fit_score: number;
  location: string | null;
  booking_link: string | null;
};

type AnalyzeResponse = {
  consensus_budget: { min: number; max: number; has_overlap: boolean };
  suggestions: Suggestion[];
  model_usage: Record<string, string>;
};

type Participant = {
  name: string;
  min_budget: number;
  max_budget: number;
  preferences: string | null;
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function Suggestions({
  eventName,
  zipcode,
  participants,
}: {
  eventName: string;
  zipcode: string | null;
  participants: Participant[];
}) {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zipcode || participants.length === 0) {
      setLoading(false);
      setError("Need a zipcode and at least one participant to get suggestions.");
      return;
    }

    const controller = new AbortController();

    async function fetchSuggestions() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/analyze-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            event_name: eventName,
            zipcode,
            participants: participants.map((p) => ({
              name: p.name,
              min_budget: p.min_budget,
              max_budget: p.max_budget,
              preferences: p.preferences,
            })),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || `Backend returned ${res.status}`);
        }

        const json: AnalyzeResponse = await res.json();
        setData(json);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load suggestions"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
    return () => controller.abort();
  }, [eventName, zipcode, participants]);

  if (loading) {
    return (
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Finding activities near {zipcode}...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2 border-destructive shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="py-6">
          <p className="text-sm font-bold text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure the backend is running at {BACKEND_URL}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.suggestions.length === 0) {
    return (
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            No suggestions found. Try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.suggestions.map((s, i) => (
            <div
              key={i}
              className="border-2 border-foreground p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm">{s.name}</h3>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {s.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Star className="h-3 w-3" />
                  <span className="text-xs font-bold">
                    {Math.round(s.fit_score * 100)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{s.why_it_fits}</p>

              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 font-bold">
                  <DollarSign className="h-3 w-3" />
                  {s.cost_per_person}/person
                </span>
                {s.location && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {s.location}
                  </span>
                )}
              </div>

              {s.booking_link && (
                <a
                  href={s.booking_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-money hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {s.booking_link.includes("google.com/maps")
                    ? "View on Maps"
                    : "Book / Get Tickets"}
                </a>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

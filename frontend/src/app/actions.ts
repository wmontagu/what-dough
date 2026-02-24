"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runWithGroqPlaces } from "@/lib/analyze/groq-places";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const zipcode = (formData.get("zipcode") as string) || null;
  const dateStart = (formData.get("dateStart") as string) || null;
  const dateEnd = (formData.get("dateEnd") as string) || null;
  const timeStart = (formData.get("timeStart") as string) || null;
  const timeEnd = (formData.get("timeEnd") as string) || null;
  const maxBudget = formData.get("maxBudget")
    ? parseInt(formData.get("maxBudget") as string, 10)
    : 100;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      name,
      description,
      zipcode,
      date_start: dateStart,
      date_end: dateEnd,
      time_start: timeStart,
      time_end: timeEnd,
      max_budget: maxBudget,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    throw new Error("Failed to create event");
  }

  redirect(`/event/${event.id}`);
}

export async function joinEvent(formData: FormData) {
  const supabase = await createClient();

  const eventId = formData.get("eventId") as string;
  const name = formData.get("name") as string;
  const minBudget = parseInt(formData.get("minBudget") as string, 10);
  const maxBudget = parseInt(formData.get("maxBudget") as string, 10);
  const preferences = (formData.get("preferences") as string) || null;

  // Check if event is closed
  const { data: event } = await supabase
    .from("events")
    .select("is_closed")
    .eq("id", eventId)
    .single();

  if (event?.is_closed) {
    throw new Error("This event is closed and no longer accepting participants");
  }

  const { error } = await supabase.from("participants").insert({
    event_id: eventId,
    name,
    min_budget: minBudget,
    max_budget: maxBudget,
    preferences,
  });

  if (error) {
    throw new Error("Failed to join event");
  }

  revalidatePath(`/event/${eventId}`);
}

export async function closeEvent(formData: FormData) {
  const supabase = await createClient();

  const eventId = formData.get("eventId") as string;

  // Close the event first
  const { error } = await supabase
    .from("events")
    .update({ is_closed: true })
    .eq("id", eventId);

  if (error) throw new Error("Failed to close event");

  // Fetch event + participants to generate recommendations
  const [{ data: event }, { data: participants }] = await Promise.all([
    supabase.from("events").select("name, description, zipcode, date_start, date_end, time_start, time_end").eq("id", eventId).single(),
    supabase.from("participants").select("name, min_budget, max_budget, preferences").eq("event_id", eventId),
  ]);

  if (event?.zipcode && participants && participants.length > 0) {
    try {
      const result = await runWithGroqPlaces(
        event.name,
        event.zipcode,
        participants,
        {
          dateStart: event.date_start,
          dateEnd: event.date_end,
          timeStart: event.time_start,
          timeEnd: event.time_end,
        },
        event.description,
      );
      await supabase
        .from("events")
        .update({ recommendations: result })
        .eq("id", eventId);
    } catch (e) {
      // Non-fatal — page will fall back to generating on load
      console.warn("Failed to generate recommendations on close:", e);
    }
  }

  revalidatePath(`/event/${eventId}`);
}

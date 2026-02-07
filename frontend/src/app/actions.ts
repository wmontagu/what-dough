"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const location = formData.get("location") as string;
  const activityType = formData.get("activityType") as string;
  const creatorName = formData.get("creatorName") as string;
  const minBudget = parseInt(formData.get("minBudget") as string, 10);
  const maxBudget = parseInt(formData.get("maxBudget") as string, 10);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({ name, location, activity_type: activityType })
    .select("id")
    .single();

  if (eventError || !event) {
    throw new Error("Failed to create event");
  }

  await supabase.from("participants").insert({
    event_id: event.id,
    name: creatorName,
    min_budget: minBudget,
    max_budget: maxBudget,
  });

  redirect(`/event/${event.id}`);
}

export async function joinEvent(formData: FormData) {
  const supabase = await createClient();

  const eventId = formData.get("eventId") as string;
  const name = formData.get("name") as string;
  const minBudget = parseInt(formData.get("minBudget") as string, 10);
  const maxBudget = parseInt(formData.get("maxBudget") as string, 10);

  const { error } = await supabase.from("participants").insert({
    event_id: eventId,
    name,
    min_budget: minBudget,
    max_budget: maxBudget,
  });

  if (error) {
    throw new Error("Failed to join event");
  }
}

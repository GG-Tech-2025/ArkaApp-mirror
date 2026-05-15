import supabase from "../../lib/supabaseClient";
import { ProductionInput } from "../types";

/**
 * TEMP MOCK — replace with Supabase later
 */
export async function createProductionEntry(
  payload: ProductionInput,
) {
  
const productionDate = payload.date.split("T")[0];

  const insertPayload = {
    production_date: productionDate,
    round: payload.round,
    bricks: payload.bricks,
    wet_ash_kg: payload.wetAsh,
    marble_powder_kg: payload.marblePowder,
    crusher_powder_kg: payload.crusherPowder,
    fly_ash_kg: payload.flyAsh,
    cement_bags: payload.cement,
    notes: payload.notes ?? null,
  };

  
  console.table(insertPayload);

  const { error } = await supabase.from("production_entries").insert([
    insertPayload,
  ]);
  

  if (error) {
    console.error("Supabase insert error:", error);
    throw new Error(error.message);
  }
}

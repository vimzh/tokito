"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { ApiError, sendSimulationTurn, startSimulation, type SimulationStart, type SimulationTurn } from "@/lib/api";
import { campaignContent } from "@/data/campaign";

export type StartState = { started?: SimulationStart; error?: string };
export type TurnState = { turn?: SimulationTurn; error?: string };

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return campaignContent.errors.unavailable;
}

export async function startSimulationAction(id: string, input: { contactId?: string; personName?: string }): Promise<StartState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  try {
    return { started: await startSimulation(id, input) };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function simulationTurnAction(id: string, callId: string, text: string): Promise<TurnState> {
  if (!(await auth())?.user) throw new Error("Unauthorized");
  try {
    const turn = await sendSimulationTurn(id, callId, text);
    if (turn.ended) revalidatePath(`/survey/${id}`);
    return { turn };
  } catch (error) {
    return { error: message(error) };
  }
}

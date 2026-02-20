import apiClient from "./client";
import type {
  SlotSuggestRequest,
  SlotSuggestResponse,
  SlotBookRequest,
  Appointment,
} from "@/types/models";

export async function suggestSlots(
  payload: SlotSuggestRequest
): Promise<SlotSuggestResponse> {
  const { data } = await apiClient.post<SlotSuggestResponse>(
    "/slots/suggest",
    payload
  );
  return data;
}

export async function bookSlot(payload: SlotBookRequest): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>("/slots/book", payload);
  return data;
}

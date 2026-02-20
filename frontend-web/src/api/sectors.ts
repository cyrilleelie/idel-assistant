import apiClient from "./client";
import type {
  Sector,
  SectorCreate,
  SectorUpdate,
  PaginatedResponse,
} from "@/types/models";

export async function listSectors(): Promise<PaginatedResponse<Sector>> {
  const { data } = await apiClient.get<PaginatedResponse<Sector>>("/sectors/");
  return data;
}

export async function getSector(id: string): Promise<Sector> {
  const { data } = await apiClient.get<Sector>(`/sectors/${id}`);
  return data;
}

export async function createSector(payload: SectorCreate): Promise<Sector> {
  const { data } = await apiClient.post<Sector>("/sectors/", payload);
  return data;
}

export async function updateSector(
  id: string,
  payload: SectorUpdate
): Promise<Sector> {
  const { data } = await apiClient.patch<Sector>(`/sectors/${id}`, payload);
  return data;
}

export async function deleteSector(id: string): Promise<void> {
  await apiClient.delete(`/sectors/${id}`);
}

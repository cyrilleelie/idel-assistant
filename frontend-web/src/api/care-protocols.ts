import apiClient from "./client";
import type { CareProtocol, PaginatedResponse } from "@/types/models";

export async function listCareProtocols(params?: {
  patient_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<CareProtocol>> {
  const { data } = await apiClient.get<PaginatedResponse<CareProtocol>>(
    "/care-protocols/",
    { params }
  );
  return data;
}

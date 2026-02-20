import apiClient from './client';
import type { Sector, PaginatedResponse } from '../types/models';

export async function listSectors(): Promise<PaginatedResponse<Sector>> {
  const { data } = await apiClient.get<PaginatedResponse<Sector>>('/sectors');
  return data;
}

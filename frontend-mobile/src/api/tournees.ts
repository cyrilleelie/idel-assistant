import apiClient from './client';
import type { TourneeDetail } from '../types/models';

export async function getTodayTournee(date?: string): Promise<TourneeDetail> {
  const params = date ? { date } : {};
  const { data } = await apiClient.get<TourneeDetail>('/tournees/today', { params });
  return data;
}

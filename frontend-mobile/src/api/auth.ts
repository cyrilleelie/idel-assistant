import apiClient from './client';
import type { TokenResponse } from '../types/models';

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/login', {
    email,
    password,
  });
  return data;
}

export async function register(payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  rpps: string;
}): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/register', payload);
  return data;
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}

import axios from 'axios';
import client from './client';

const authClient = axios.create({
  baseURL: '/api/v1',
});

export async function login(email, password) {
  const { data } = await authClient.post('/auth/login', { email, password });
  return data; // { access_token, refresh_token, token_type }
}

export async function refreshTokens(refreshToken) {
  const { data } = await authClient.post('/auth/refresh', { refresh_token: refreshToken });
  return data; // { access_token, refresh_token, token_type }
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me');
  return data; // { user: {...}, cabinet: {...} }
}

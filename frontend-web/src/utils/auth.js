/**
 * Decode a JWT token payload (no signature verification — that's the backend's job).
 * Returns the parsed payload or null on failure.
 */
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Read the access_token from localStorage, decode it, and return the user role.
 * Returns 'admin' | 'member' | 'replacement' | null.
 */
export function getUserRole() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  const payload = decodeToken(token);
  return payload?.role ?? null;
}

/**
 * Read the access_token from localStorage, decode it, and return the email (sub).
 */
export function getUserEmail() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  const payload = decodeToken(token);
  return payload?.sub ?? null;
}

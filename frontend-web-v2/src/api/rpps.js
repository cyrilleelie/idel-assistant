import client from './client';

/**
 * Recherche dans le référentiel RPPS.
 * @param {string} q - Terme de recherche (min 2 caractères)
 * @param {AbortSignal} [signal] - Signal d'annulation optionnel
 * @returns {Promise<Array>} Liste de médecins correspondants
 */
export async function searchRppsDoctor(q, signal) {
  const { data } = await client.get('/rpps-doctors/', {
    params: { q, limit: 10 },
    signal,
  });
  return data;
}

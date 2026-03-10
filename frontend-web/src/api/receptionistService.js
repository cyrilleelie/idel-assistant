/**
 * Service API pour le secrétaire médical IA.
 * Consomme les endpoints /api/v1/receptionist/*.
 */

import apiClient from './client';

/**
 * Récupère les appels du jour avec statistiques.
 * @returns {Promise<{stats: object, calls: Array}>}
 */
export async function getCallsToday() {
  const { data } = await apiClient.get('/receptionist/calls/today');
  return data;
}

/**
 * Récupère la transcription pseudonymisée d'un appel.
 * @param {string} callId - UUID de l'appel
 * @returns {Promise<{id: string, transcript: Array, ...}>}
 */
export async function getCallTranscript(callId) {
  const { data } = await apiClient.get(`/receptionist/calls/${callId}/transcript`);
  return data;
}

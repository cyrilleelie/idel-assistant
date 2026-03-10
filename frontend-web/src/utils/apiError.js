/**
 * Extrait un message d'erreur lisible depuis une erreur API axios.
 */
export function getErrorMessage(err, fallback = 'Une erreur est survenue') {
  if (!err) return fallback;
  // Erreur axios avec réponse serveur
  if (err.response?.data?.detail) {
    return err.response.data.detail;
  }
  // Timeout
  if (err.code === 'ECONNABORTED') {
    return 'La requête a expiré. Veuillez réessayer.';
  }
  // Erreur réseau
  if (err.code === 'ERR_NETWORK' || !err.response) {
    return 'Erreur réseau. Vérifiez votre connexion.';
  }
  // Message générique
  return err.message || fallback;
}

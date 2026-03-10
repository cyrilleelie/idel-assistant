import client from '../api/client';

/**
 * Telecharge un fichier blob depuis l'API et declenche le telechargement navigateur.
 * Recupere le nom de fichier depuis Content-Disposition si disponible.
 */
export async function downloadFile(url, params, defaultFilename) {
  const response = await client.get(url, { params, responseType: 'blob' });
  const contentDisposition = response.headers['content-disposition'];
  let filename = defaultFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\s]+)"?/);
    if (match) filename = match[1];
  }
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Ouvre un PDF blob dans un nouvel onglet.
 */
export function openPdfBlob(blobData) {
  const blob = new Blob([blobData], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

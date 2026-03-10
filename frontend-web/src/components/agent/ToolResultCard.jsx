/**
 * Dispatcher des ToolResultCards — sélectionne la bonne card selon le nom de l'outil.
 */
import { useEffect, useState } from 'react';
import CotationCard from './cards/CotationCard';
import TransmissionCard from './cards/TransmissionCard';
import CreneauxCard from './cards/CreneauxCard';
import TourneeReoptCard from './cards/TourneeReoptCard';
import OrdonnanceCard from './cards/OrdonnanceCard';

/**
 * Compte à rebours basé sur `expires_at` (ISO string).
 * Appelle `onExpire` quand le délai est dépassé.
 */
export function ConfirmationTimer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire, remaining]);

  if (remaining === 0) {
    return <span className="text-xs text-slate-400">⏳ Délai dépassé — reformule ta demande</span>;
  }
  return <span className="text-xs text-slate-400">⏱ {remaining}s</span>;
}

/**
 * @param {{
 *   tool: string,
 *   data: object,
 *   pendingConfirmation: {id: string, action_type: string, label: string, expires_at: string}|null,
 *   onConfirm: (actionId: string) => void,
 *   onCancel: (actionId: string) => void,
 * }} props
 */
export function ToolResultCard({ tool, data, pendingConfirmation, onConfirm, onCancel }) {
  const commonProps = { data, pending: pendingConfirmation, onConfirm, onCancel };

  switch (tool) {
    case 'analyser_et_coter':
      return <CotationCard {...commonProps} />;
    case 'structurer_transmission':
      return <TransmissionCard {...commonProps} />;
    case 'proposer_creneaux_geooptimises':
      return <CreneauxCard {...commonProps} />;
    case 'reoptimize_tournee':
      return <TourneeReoptCard {...commonProps} />;
    case 'interpreter_ordonnance':
      return <OrdonnanceCard {...commonProps} />;
    default:
      return null;
  }
}

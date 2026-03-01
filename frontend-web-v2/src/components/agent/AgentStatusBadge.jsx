/**
 * Badge indiquant le statut de connexion de l'agent IA.
 * @param {{'online'|'offline'|'connecting'}} status
 */
export default function AgentStatusBadge({ status }) {
  const config = {
    online: {
      label: 'En ligne',
      className: 'bg-green-100 text-green-700 border-green-200',
      dot: 'bg-green-500',
    },
    connecting: {
      label: 'Connexion...',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      dot: 'bg-yellow-500 animate-pulse',
    },
    offline: {
      label: 'Hors ligne',
      className: 'bg-gray-100 text-gray-500 border-gray-200',
      dot: 'bg-gray-400',
    },
  };

  const { label, className, dot } = config[status] ?? config.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

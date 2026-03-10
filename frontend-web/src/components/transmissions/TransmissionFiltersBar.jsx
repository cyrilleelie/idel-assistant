import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function TransmissionFiltersBar({
  filters,
  onFiltersChange,
}) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        onFiltersChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        placeholder="Rechercher dans les transmissions..."
        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  );
}

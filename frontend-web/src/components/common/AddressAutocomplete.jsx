import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';

/**
 * Champ d'auto-complétion d'adresse via l'API Adresse gouv.fr (BAN).
 *
 * Props :
 *   value       : string (adresse courante)
 *   onChange     : (address: string) => void
 *   placeholder  : string
 *   disabled     : bool
 */
export default function AddressAutocomplete({ value, onChange, placeholder = 'Saisissez une adresse...', disabled = false }) {
  const [inputText, setInputText] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const containerRef = useRef(null);

  // Sync prop → state quand le parent change la valeur
  useEffect(() => {
    setInputText(value || '');
  }, [value]);

  // Fermer le dropdown en cliquant en dehors
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerSearch = useCallback((text) => {
    if (text.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(text)}&limit=5`, {
      signal: abortRef.current.signal,
    })
      .then(res => res.json())
      .then(data => {
        setResults(data.features || []);
        setOpen(true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setResults([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function handleInputChange(e) {
    const text = e.target.value;
    setInputText(text);
    onChange(text);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSearch(text), 300);
  }

  function handleSelect(feature) {
    const label = feature.properties.label;
    setInputText(label);
    setOpen(false);
    setResults([]);
    onChange(label);
  }

  function handleClear() {
    setInputText('');
    setResults([]);
    setOpen(false);
    onChange('');
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-10"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {loading && (
            <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {inputText && !disabled && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5"
              title="Effacer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((feature) => (
            <button
              key={feature.properties.id}
              type="button"
              onMouseDown={() => handleSelect(feature)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-slate-100 last:border-0 flex items-start gap-2"
            >
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-slate-800">
                  {feature.properties.name}
                </span>
                <span className="ml-1.5 text-xs text-slate-500">
                  {feature.properties.postcode} {feature.properties.city}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

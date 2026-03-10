import { useState, useEffect, useRef, useCallback } from 'react';
import { searchRppsDoctor } from '../../api/rpps';

/**
 * Champ d'auto-complétion RPPS pour la saisie d'un médecin.
 *
 * Props :
 *   value       : { name: string, rpps_number: string | null }
 *   onChange    : ({ name, rpps_number }) => void
 *   placeholder : string
 *   disabled    : bool
 */
export default function DoctorAutocomplete({ value, onChange, placeholder = 'Dr. ...', disabled = false }) {
  const [inputText, setInputText] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(!!value?.rpps_number);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const containerRef = useRef(null);

  // Sync prop → state quand le parent change la valeur (ex: reset form)
  useEffect(() => {
    setInputText(value?.name || '');
    setSelected(!!value?.rpps_number);
  }, [value?.name, value?.rpps_number]);

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
    if (text.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Annuler la requête précédente
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    searchRppsDoctor(text, abortRef.current.signal)
      .then((data) => {
        setResults(data || []);
        setOpen(true);
      })
      .catch((err) => {
        if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') {
          setResults([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function handleInputChange(e) {
    const text = e.target.value;
    setInputText(text);
    setSelected(false);

    // Notifier le parent en mode saisie libre (sans rpps_number)
    onChange({ name: text, rpps_number: null });

    // Debounce 350ms
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSearch(text), 350);
  }

  function handleSelect(doctor) {
    const name = `${doctor.first_name} ${doctor.last_name}`;
    setInputText(name);
    setSelected(true);
    setOpen(false);
    setResults([]);
    onChange({ name, rpps_number: doctor.rpps_number });
  }

  function handleClear() {
    setInputText('');
    setSelected(false);
    setResults([]);
    setOpen(false);
    onChange({ name: '', rpps_number: null });
  }

  function formatDoctorLine(doctor) {
    const parts = [`${doctor.first_name} ${doctor.last_name}`];
    if (doctor.specialty_label) parts.push(doctor.specialty_label);
    else if (doctor.profession_label) parts.push(doctor.profession_label);
    if (doctor.department) parts.push(`Dép. ${doctor.department}`);
    if (doctor.city) parts.push(doctor.city);
    return parts.join(' · ');
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
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white pr-16"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {loading && (
            <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {selected && value?.rpps_number && (
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
              RPPS
            </span>
          )}
          {(inputText || selected) && !disabled && (
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

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 italic">
              Introuvable dans le RPPS — saisie libre conservée
            </div>
          ) : (
            results.map((doctor) => (
              <button
                key={doctor.rpps_number}
                type="button"
                onMouseDown={() => handleSelect(doctor)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-slate-100 last:border-0"
              >
                <span className="font-medium text-slate-800">
                  {doctor.first_name} {doctor.last_name}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {doctor.specialty_label || doctor.profession_label}
                  {doctor.department ? ` · Dép. ${doctor.department}` : ''}
                  {doctor.city ? ` · ${doctor.city}` : ''}
                </span>
                <span className="ml-2 text-xs text-slate-400 font-mono">
                  {doctor.rpps_number}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

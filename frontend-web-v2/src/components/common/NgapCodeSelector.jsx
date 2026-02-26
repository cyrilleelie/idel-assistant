import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { suggestNgapCodes } from '../../api/cotation';

export default function NgapCodeSelector({ careType, value = [], onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!careType) return;
    suggestNgapCodes(careType)
      .then(data => setSuggestions(data.suggested_codes || []))
      .catch(() => setSuggestions([]));
  }, [careType]);

  const addCode = (code) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeCode = (code) => {
    onChange(value.filter(c => c !== code));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCode(inputValue);
    }
  };

  const unusedSuggestions = suggestions.filter(s => !value.includes(s));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 items-center">
        {value.map(code => (
          <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {code}
            <button type="button" onClick={() => removeCode(code)} className="hover:text-blue-900">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Code NGAP..."
          className="w-24 px-2 py-0.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unusedSuggestions.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => addCode(code)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus size={10} />
              {code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

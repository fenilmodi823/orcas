import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { fuzzyMatch } from './fuzzy-match.js';
import './SearchPanel.css';

export interface SearchableObject {
  id: string;
  name: string;
  noradId: string;
}

export interface SearchPanelProps {
  items: readonly SearchableObject[];
  onSelect: (id: string) => void;
  onClose?: () => void;
}

/**
 * Fuzzy search over name and NORAD ID. `/` focuses it from anywhere on the
 * page; arrow keys move the selection, Enter selects, Escape closes
 * (Design.md §6).
 */
export function SearchPanel({ items, onSelect, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // Resets the selection when the query changes — adjusted during render,
  // not in an effect, per React's own guidance for this exact case.
  const [queryAtLastReset, setQueryAtLastReset] = useState(query);
  if (query !== queryAtLastReset) {
    setQueryAtLastReset(query);
    setActiveIndex(0);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const results = useMemo(() => {
    if (query.length === 0) return items;
    return items
      .map((item) => {
        const byName = fuzzyMatch(query, item.name);
        const byId = fuzzyMatch(query, item.noradId);
        return { item, ...(byName.score >= byId.score ? byName : byId) };
      })
      .filter((result) => result.matched)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.item);
  }, [items, query]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const target = results[activeIndex];
      if (target) onSelect(target.id);
    } else if (event.key === 'Escape') {
      onClose?.();
    }
  }

  return (
    <div className="search-panel">
      <div className="search-panel__field">
        <Search aria-hidden size={15} strokeWidth={2} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search name or NORAD ID…"
          aria-label="Search objects"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <ul className="search-panel__results" role="listbox" aria-label="Search results">
        {results.map((item, index) => (
          <li key={item.id} role="option" aria-selected={index === activeIndex}>
            <button
              type="button"
              data-active={index === activeIndex ? '' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <span className="search-panel__name">{item.name}</span>
              <span className="search-panel__id">{item.noradId}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

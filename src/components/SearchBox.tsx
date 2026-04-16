'use client';

// =============================================================================
// COMPONENT: SearchBox - Responsive Search
// =============================================================================
import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import type { SearchResult } from '@/types';
import { search } from '@/actions/search';
import { useRouter } from 'next/navigation';

interface SearchBoxProps {
  className?: string;
}

export function SearchBox({ className = '' }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await search(query);
        if (result.success) {
          setResults(result.data || []);
          setIsOpen(true);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].url);
            setIsOpen(false);
            setQuery('');
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, router]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSelect = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={inputRef}>
      {/* Input Container */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) setIsOpen(true);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Buscar..."
          className="w-full pl-10 pr-10 py-2 text-sm bg-gray-100 border border-transparent rounded-lg
            focus:bg-white focus:border-blue-500 focus:outline-none transition-all
            placeholder:text-gray-400"
        />
        
        {/* Loading / Clear Icons */}
        <div className="absolute right-3">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : query ? (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              type="button"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 max-h-80 overflow-y-auto">
          <ul>
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  onClick={() => handleSelect(result)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3
                    ${index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="text-lg">
                    {result.type === 'propietario' ? '👤' : result.type === 'unidad' ? '🏠' : '🏢'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          
          {/* Footer hint */}
          <div className="px-4 py-2 bg-gray-50 border-t">
            <p className="text-xs text-gray-400">↑↓ navegar • Enter selecionar • Esc cerrar</p>
          </div>
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
          <p className="text-sm text-gray-500 text-center">
            No hay resultados para &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';

export interface Select2Option {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface Select2Props {
  options: Select2Option[];
  value?: string | string[];
  onChange: (value: any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  isMulti?: boolean;
  isClearable?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
}

export function Select2({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  isMulti = false,
  isClearable = true,
  isLoading = false,
  disabled = false,
  className = '',
  label,
  error,
}: Select2Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filtered options
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  // Selected option(s) display
  const selectedOptions = useMemo(() => {
    if (isMulti && Array.isArray(value)) {
      return options.filter((opt) => value.includes(opt.value));
    }
    if (!isMulti && typeof value === 'string') {
      return options.filter((opt) => opt.value === value);
    }
    return [];
  }, [options, value, isMulti]);

  const handleSelect = (option: Select2Option) => {
    if (option.disabled) return;

    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      const exists = currentValues.includes(option.value);
      const newValues = exists
        ? currentValues.filter((v) => v !== option.value)
        : [...currentValues, option.value];
      onChange(newValues);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(isMulti ? [] : '');
  };

  const handleRemoveItem = (valToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti && Array.isArray(value)) {
      onChange(value.filter((v) => v !== valToRemove));
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      {/* Main Trigger Box */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`flex min-h-[42px] items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-all cursor-pointer select-none ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md'
            : error
            ? 'border-rose-500 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-200'
            : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-400 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 pr-2">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          ) : isMulti ? (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-200 text-xs font-medium"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(opt.value, e)}
                  className="hover:text-blue-900 dark:hover:text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <div className="flex items-center gap-2 truncate">
              {selectedOptions[0].icon}
              <span className="truncate font-medium text-slate-900 dark:text-slate-100">{selectedOptions[0].label}</span>
              {selectedOptions[0].badge && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {selectedOptions[0].badge}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right action icons */}
        <div className="flex items-center gap-1 text-slate-400 shrink-0">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" />}
          {isClearable && selectedOptions.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`}
          />
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl backdrop-blur-md">
          {/* Search Bar */}
          <div className="sticky top-0 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No results found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = isMulti
                  ? Array.isArray(value) && value.includes(opt.value)
                  : value === opt.value;

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-md cursor-pointer transition-colors ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon}
                      <div className="truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.subLabel && (
                          <div className="text-[10px] text-slate-500 truncate">{opt.subLabel}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

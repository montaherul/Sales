'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  X, 
  Sparkles, 
  Clock 
} from 'lucide-react';
import { MONTH_NAMES } from '@/shared/constants';

export interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  showPresets?: boolean;
  align?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date...',
  label,
  disabled = false,
  className = '',
  minDate,
  maxDate,
  showPresets = true,
  align = 'left',
  size = 'md',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current date or fallback
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return { year: y, month: m, day: d };
    }
    return null;
  }, [value]);

  // Calendar View State (which month/year is currently being viewed)
  const [viewYear, setViewYear] = useState<number>(() => parsedValue?.year || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsedValue?.month ?? new Date().getMonth());
  const [yearSelectorOpen, setYearSelectorOpen] = useState(false);

  // Synchronize view when selected value changes
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [parsedValue]);

  // Close popover on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setYearSelectorOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setYearSelectorOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Compute days in month and offsets
  const calendarDays = useMemo(() => {
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 1. Trailing days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isSelected: value === dateStr,
        isToday: todayStr === dateStr,
        isDisabled: (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false),
      });
    }

    // 2. Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isSelected: value === dateStr,
        isToday: todayStr === dateStr,
        isDisabled: (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false),
      });
    }

    // 3. Leading days for next month to complete standard 6-row (42 cells) grid
    const remainingCells = 42 - days.length;
    for (let d = 1; d <= remainingCells; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isSelected: value === dateStr,
        isToday: todayStr === dateStr,
        isDisabled: (minDate ? dateStr < minDate : false) || (maxDate ? dateStr > maxDate : false),
      });
    }

    return days;
  }, [viewYear, viewMonth, value, minDate, maxDate]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
    setYearSelectorOpen(false);
  };

  // Formatted display text
  const displayLabel = useMemo(() => {
    if (!value) return placeholder;
    try {
      const [y, m, d] = value.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (isNaN(dateObj.getTime())) return value;
      const monthStr = dateObj.toLocaleString('en-US', { month: 'short' });
      return `${String(d).padStart(2, '0')} ${monthStr} ${y}`;
    } catch {
      return value;
    }
  }, [value, placeholder]);

  // Size styling maps
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-2 text-xs gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2.5',
  };

  // Available years list
  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = 2022; y <= 2030; y++) {
      list.push(y);
    }
    return list;
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between rounded-xl border transition-all text-left font-medium cursor-pointer ${
          sizeClasses[size]
        } ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900 shadow-sm'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
        } ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900'
            : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className={`font-mono text-xs font-semibold ${!value ? 'text-slate-400 dark:text-slate-500 font-sans' : ''}`}>
            {displayLabel}
          </span>
        </div>

        {value && !disabled && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {value}
          </span>
        )}
      </button>

      {/* Popover Calendar Container */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-76 sm:w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xl backdrop-blur-md animate-fadeIn ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="dialog"
          aria-label="Calendar date picker"
        >
          {/* Header Navigation */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1">
              {/* Year decrement */}
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Previous Year"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              {/* Month decrement */}
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="text-xs font-bold bg-transparent text-slate-900 dark:text-white rounded-md px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus:outline-none"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="text-xs font-bold font-mono bg-transparent text-slate-900 dark:text-white rounded-md px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus:outline-none"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              {/* Month increment */}
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {/* Year increment */}
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Next Year"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1">
                {wd}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cd, index) => {
              return (
                <button
                  key={`${cd.dateStr}_${index}`}
                  type="button"
                  disabled={cd.isDisabled}
                  onClick={() => handleSelectDate(cd.dateStr)}
                  className={`h-8 w-full rounded-lg text-xs font-medium transition-all flex items-center justify-center relative cursor-pointer ${
                    cd.isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30'
                      : cd.isToday
                      ? 'border border-blue-500/50 font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      : cd.isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  } ${cd.isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
                >
                  <span>{cd.dayNum}</span>
                  {cd.isToday && !cd.isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Preset Buttons Strip */}
          {showPresets && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const y = today.getFullYear();
                  const m = String(today.getMonth() + 1).padStart(2, '0');
                  const d = String(today.getDate()).padStart(2, '0');
                  handleSelectDate(`${y}-${m}-${d}`);
                }}
                className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold cursor-pointer"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  const yest = new Date();
                  yest.setDate(yest.getDate() - 1);
                  const y = yest.getFullYear();
                  const m = String(yest.getMonth() + 1).padStart(2, '0');
                  const d = String(yest.getDate()).padStart(2, '0');
                  handleSelectDate(`${y}-${m}-${d}`);
                }}
                className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold cursor-pointer"
              >
                Yesterday
              </button>

              <button
                type="button"
                onClick={() => {
                  const y = viewYear;
                  const m = String(viewMonth + 1).padStart(2, '0');
                  handleSelectDate(`${y}-${m}-01`);
                }}
                className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold cursor-pointer"
              >
                1st of Month
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

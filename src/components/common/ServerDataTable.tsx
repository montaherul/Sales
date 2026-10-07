'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  RefreshCw, 
  Trash2, 
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface ServerDataTableProps<T> {
  endpoint: string;
  columns: ColumnDef<T>[];
  idField?: string;
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
  title?: string;
  searchPlaceholder?: string;
  additionalParams?: Record<string, any>;
  onRowClick?: (row: T) => void;
  renderTopActions?: (selectedIds: string[], refresh: () => void) => React.ReactNode;
  onBatchDelete?: (selectedIds: string[]) => Promise<void>;
  exportFilenamePrefix?: string;
}

export function ServerDataTable<T extends Record<string, any>>({
  endpoint,
  columns,
  idField = 'id',
  defaultSortBy = 'created_at',
  defaultSortOrder = 'desc',
  title,
  searchPlaceholder = 'Search records...',
  additionalParams = {},
  onRowClick,
  renderTopActions,
  onBatchDelete,
  exportFilenamePrefix = 'Export',
}: ServerDataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  // Serialize additionalParams to primitive string so reference instability in parent components does not trigger continuous re-fetch loops
  const serializedAdditionalParams = JSON.stringify(additionalParams || {});

  // Reset to page 1 ONLY when search or filter params genuinely change
  const prevSearchRef = React.useRef(debouncedSearch);
  const prevParamsRef = React.useRef(serializedAdditionalParams);

  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearch || prevParamsRef.current !== serializedAdditionalParams) {
      prevSearchRef.current = debouncedSearch;
      prevParamsRef.current = serializedAdditionalParams;
      setPage(1);
    }
  }, [debouncedSearch, serializedAdditionalParams]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch data from endpoint
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const extra = JSON.parse(serializedAdditionalParams || '{}');
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: debouncedSearch,
        sortBy,
        sortOrder,
        ...Object.entries(extra).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== '') acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>),
      });

      const res = await fetch(`${endpoint}?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data || []);
        if (json.pagination) {
          setTotalRecords(json.pagination.totalRecords || 0);
          setTotalPages(json.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, debouncedSearch, sortBy, sortOrder, serializedAdditionalParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Multi-Selection handlers
  const allCurrentIds = data.map((r) => r[idField]);
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allCurrentIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allCurrentIds])));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Sorting handler
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Server-side CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const extra = JSON.parse(serializedAdditionalParams || '{}');
      const params = new URLSearchParams({
        export: 'csv',
        search: debouncedSearch,
        sortBy,
        sortOrder,
        ...Object.entries(extra).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== '') acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>),
      });

      const response = await fetch(`${endpoint}?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportFilenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Batch delete action
  const handleBatchDeleteClick = async () => {
    if (!onBatchDelete || selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected record(s)?`)) return;

    setBatchActionLoading(true);
    try {
      await onBatchDelete(selectedIds);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setBatchActionLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-3.5 sm:p-5 lg:p-6 backdrop-blur-md shadow-lg dark:shadow-2xl transition-colors duration-200">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          {title && <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>}
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Total {totalRecords} records found • Page {page} of {totalPages}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Server-side search box */}
          <div className="relative flex-1 md:w-64 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:border-slate-700 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}`} />
          </button>

          {/* Server-side CSV Export */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 cursor-pointer shrink-0"
            title="Export full table to CSV"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" /> : <Download className="w-4 h-4" />}
            <span className="hidden xs:inline">Export CSV</span>
          </button>

          {/* Custom Action (e.g. Create Button) */}
          {renderTopActions && renderTopActions(selectedIds, fetchData)}
        </div>
      </div>

      {/* Multi-Selection Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-4 py-2 text-xs text-blue-800 dark:text-blue-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              {selectedIds.length} {selectedIds.length === 1 ? 'row' : 'rows'} selected
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 ml-2 cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onBatchDelete && (
              <button
                onClick={handleBatchDeleteClick}
                disabled={batchActionLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-600/30 border border-rose-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {batchActionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
                <span>Delete ({selectedIds.length}) Selected</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Swipe Hint */}
      <div className="lg:hidden text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 py-0.5">
        <span>⇄ Swipe table horizontally to view full records</span>
      </div>

      {/* Main Tabulator-Style Data Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 -mx-1 sm:mx-0">
        <table className="w-full text-left text-xs border-collapse min-w-[620px] md:min-w-full">
          {/* Table Header */}
          <thead className="bg-slate-100 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0">
            <tr>
              {/* Checkbox Header */}
              <th className="w-10 px-3 py-3 text-center">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>

              {/* Data Columns */}
              {columns.map((col) => {
                const isSorted = sortBy === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`px-4 py-3 select-none ${
                      col.sortable !== false ? 'cursor-pointer hover:text-slate-900 dark:hover:text-slate-200' : ''
                    } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span className="text-slate-400 dark:text-slate-500">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="text-xs">Loading records from server...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  No records match your criteria.
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowId = row[idField];
                const isSelected = selectedIds.includes(rowId);

                return (
                  <tr
                    key={rowId || idx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {/* Row Checkbox */}
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => toggleSelectRow(rowId, e)}
                        className="text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Column Cells */}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-slate-800 dark:text-slate-300 ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        } ${col.className || ''}`}
                      >
                        {col.render ? col.render(row, idx) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>

        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-xs">
          <button
            onClick={() => setPage(1)}
            disabled={page <= 1 || loading}
            className="p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || loading}
            className="p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2.5 py-1 font-mono text-[11px] sm:text-xs text-slate-700 dark:text-slate-300">
            {page} / {totalPages || 1}
          </span>

          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || loading}
            className="p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || loading}
            className="p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

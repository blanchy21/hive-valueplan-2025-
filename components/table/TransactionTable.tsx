'use client';

import { useState, useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { parseDate, filterTransactions, filterByDateRange } from '@/lib/utils/data';

interface TransactionTableProps {
  transactions: Transaction[];
  filters: {
    country?: string;
    category?: string;
    eventType?: string;
    wallet?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
  };
}

type SortField = keyof Transaction | 'totalSpend';
type SortDirection = 'asc' | 'desc';

interface SortIconProps {
  field: SortField;
  currentSortField: SortField;
  sortDirection: SortDirection;
}

function SortIcon({ field, currentSortField, sortDirection }: SortIconProps) {
  if (currentSortField !== field) return <span className="text-gray-400">↕</span>;
  return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
}

export default function TransactionTable({ transactions, filters }: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = filterTransactions(transactions, filters);

    // Apply date range filter
    if (filters.startDate || filters.endDate) {
      // If month filter is set, use it; otherwise use startDate/endDate
      let startDate: Date;
      let endDate: Date;
      
      if (filters.month) {
        const [year, month] = filters.month.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      } else {
        startDate = filters.startDate ? parseDate(filters.startDate) : new Date(2025, 0, 1);
        endDate = filters.endDate ? parseDate(filters.endDate) : new Date(2025, 11, 31, 23, 59, 59, 999);
      }
      
      filtered = filterByDateRange(filtered, startDate, endDate);
    }

    // Sort transactions
    filtered.sort((a, b) => {
      let aValue: string | number | undefined;
      let bValue: string | number | undefined;

      if (sortField === 'totalSpend') {
        aValue = a.totalSpend || 0;
        bValue = b.totalSpend || 0;
      } else if (sortField === 'date') {
        // Parse dates for proper comparison
        try {
          aValue = parseDate(a.date).getTime();
          bValue = parseDate(b.date).getTime();
        } catch {
          // If date parsing fails, fall back to string comparison
          aValue = a.date;
          bValue = b.date;
        }
      } else if (sortField === 'hbd' || sortField === 'hive') {
        // Ensure numbers are compared as numbers
        aValue = Number(a[sortField]) || 0;
        bValue = Number(b[sortField]) || 0;
      } else {
        const aFieldValue = a[sortField];
        const bFieldValue = b[sortField];
        aValue = typeof aFieldValue === 'string' || typeof aFieldValue === 'number' ? aFieldValue : undefined;
        bValue = typeof bFieldValue === 'string' || typeof bFieldValue === 'number' ? bFieldValue : undefined;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [transactions, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate totals for all filtered transactions (when wallet filter is applied)
  const showTotals = !!filters.wallet && filteredTransactions.length > 0;
  const totals = useMemo(() => {
    if (!showTotals) return null;
    const totalHbd = filteredTransactions.reduce((sum, tx) => sum + (tx.hbd || 0), 0);
    const totalHive = filteredTransactions.reduce((sum, tx) => sum + (tx.hive || 0), 0);
    const totalSpend = filteredTransactions.reduce((sum, tx) => sum + (tx.totalSpend || 0), 0);
    return { totalHbd, totalHive, totalSpend };
  }, [filteredTransactions, showTotals]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Wallet', 'Date', 'HBD', 'Hive', 'Event/Project', 'Country', 'Theme', 'Event Type', 'Category', 'Total Spend'];
    const rows = filteredTransactions.map(tx => [
      tx.wallet,
      tx.date,
      tx.hbd,
      tx.hive,
      tx.eventProject,
      tx.country,
      tx.theme,
      tx.eventType,
      tx.category,
      tx.totalSpend || 0,
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `value-plan-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="text-sm text-gray-600">
          Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
        </div>
        <button
          onClick={exportToCSV}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="cursor-pointer px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100 sm:px-6"
                onClick={() => handleSort('wallet')}
              >
                Wallet <SortIcon field="wallet" currentSortField={sortField} sortDirection={sortDirection} />
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100 sm:px-6"
                onClick={() => handleSort('date')}
              >
                Date <SortIcon field="date" currentSortField={sortField} sortDirection={sortDirection} />
              </th>
              <th
                className="hidden cursor-pointer px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100 sm:table-cell sm:px-6"
                onClick={() => handleSort('hbd')}
              >
                HBD <SortIcon field="hbd" currentSortField={sortField} sortDirection={sortDirection} />
              </th>
              <th
                className="hidden cursor-pointer px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100 lg:table-cell lg:px-6"
                onClick={() => handleSort('hive')}
              >
                Hive <SortIcon field="hive" currentSortField={sortField} sortDirection={sortDirection} />
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell lg:px-6">
                Event/Project
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">
                Country
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell md:px-6">
                Category
              </th>
              <th className="hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:table-cell lg:px-6">
                Event Type
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100 sm:px-6"
                onClick={() => handleSort('totalSpend')}
              >
                Total <SortIcon field="totalSpend" currentSortField={sortField} sortDirection={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedTransactions.map((tx, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 sm:px-6">{tx.wallet}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 sm:px-6">
                  {formatDate(parseDate(tx.date))}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-right text-sm text-gray-700 sm:table-cell sm:px-6">
                  {formatCurrency(tx.hbd)}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-right text-sm text-gray-700 lg:table-cell lg:px-6">
                  {formatCurrency(tx.hive)}
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-700 lg:table-cell lg:px-6">{tx.eventProject}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 sm:px-6">{tx.country}</td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-700 md:table-cell md:px-6">{tx.category}</td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-700 lg:table-cell lg:px-6">{tx.eventType}</td>
                <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-semibold text-gray-900 sm:px-6">
                  {formatCurrency(tx.totalSpend || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          {showTotals && totals && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900 sm:px-6" colSpan={2}>
                  Total ({filteredTransactions.length} transactions)
                </td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-right text-sm font-bold text-gray-900 sm:table-cell sm:px-6">
                  {formatCurrency(totals.totalHbd)}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-right text-sm font-bold text-gray-900 lg:table-cell lg:px-6">
                  {formatCurrency(totals.totalHive)}
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-700 lg:table-cell lg:px-6"></td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 sm:px-6"></td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-700 md:table-cell md:px-6"></td>
                <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-700 lg:table-cell lg:px-6"></td>
                <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-bold text-gray-900 sm:px-6">
                  {formatCurrency(totals.totalSpend)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


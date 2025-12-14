'use client';

import { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { getUniqueValues, formatCurrency } from '@/lib/utils/format';
import { parseDate, filterByDateRange } from '@/lib/utils/data';

interface FilterBarProps {
  transactions: Transaction[];
  filters: {
    country?: string;
    category?: string;
    eventType?: string;
    wallet?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    month?: string; // Format: "2025-01" for January 2025
  };
  onFilterChange: (filters: FilterBarProps['filters']) => void;
}

export default function FilterBar({ transactions, filters, onFilterChange }: FilterBarProps) {
  const countries = getUniqueValues(transactions, 'country').sort();
  const categories = getUniqueValues(transactions, 'category').sort();
  const eventTypes = getUniqueValues(transactions, 'eventType').sort();
  const wallets = getUniqueValues(transactions, 'wallet').sort();

  // Calculate monthly totals for filtered transactions
  const monthlyTotals = useMemo(() => {
    let filtered = transactions;
    
    // Apply date range if month is selected
    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      filtered = filterByDateRange(transactions, startDate, endDate);
    } else if (filters.startDate || filters.endDate) {
      const startDate = filters.startDate ? parseDate(filters.startDate) : new Date(2025, 0, 1);
      const endDate = filters.endDate ? parseDate(filters.endDate) : new Date(2025, 11, 31, 23, 59, 59, 999);
      filtered = filterByDateRange(transactions, startDate, endDate);
    }
    
    const totals = filtered.reduce((acc, tx) => {
      acc.totalHbd += tx.hbd || 0;
      acc.totalHive += tx.hive || 0;
      acc.totalSpend += tx.totalSpend || 0;
      return acc;
    }, { totalHbd: 0, totalHive: 0, totalSpend: 0 });
    
    return totals;
  }, [transactions, filters]);

  const handleChange = (key: keyof typeof filters, value: string) => {
    onFilterChange({ ...filters, [key]: value || undefined });
  };

  return (
    <div className="mb-6 space-y-4 rounded-lg border border-[#334155] bg-[#1e293b] p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Search</label>
          <input
            type="text"
            value={filters.search || ''}
            onChange={e => handleChange('search', e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white placeholder-[#64748b] focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Country</label>
          <select
            value={filters.country || ''}
            onChange={e => handleChange('country', e.target.value)}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          >
            <option value="">All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Category</label>
          <select
            value={filters.category || ''}
            onChange={e => handleChange('category', e.target.value)}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Event Type</label>
          <select
            value={filters.eventType || ''}
            onChange={e => handleChange('eventType', e.target.value)}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          >
            <option value="">All Event Types</option>
            {eventTypes.map(eventType => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Wallet</label>
          <select
            value={filters.wallet || ''}
            onChange={e => handleChange('wallet', e.target.value)}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          >
            <option value="">All Wallets</option>
            {wallets.map(wallet => (
              <option key={wallet} value={wallet}>
                {wallet}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Month</label>
          <input
            type="month"
            value={filters.month || ''}
            onChange={e => {
              const monthValue = e.target.value;
              if (monthValue) {
                // Set start and end dates for the selected month
                const [year, month] = monthValue.split('-');
                const startDate = `${year}-${month}-01`;
                const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
                onFilterChange({ ...filters, month: monthValue, startDate, endDate });
              } else {
                onFilterChange({ ...filters, month: undefined, startDate: undefined, endDate: undefined });
              }
            }}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">Start Date</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={e => {
              handleChange('startDate', e.target.value);
              // Clear month filter if manually setting dates
              if (e.target.value && filters.month) {
                onFilterChange({ ...filters, startDate: e.target.value, month: undefined });
              } else {
                handleChange('startDate', e.target.value);
              }
            }}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#94a3b8]">End Date</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={e => {
              // Clear month filter if manually setting dates
              if (e.target.value && filters.month) {
                onFilterChange({ ...filters, endDate: e.target.value, month: undefined });
              } else {
                handleChange('endDate', e.target.value);
              }
            }}
            className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => onFilterChange({})}
            className="w-full rounded-md bg-[#334155] px-4 py-2 text-sm font-medium text-white hover:bg-[#475569]"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Monthly Totals Summary */}
      {(filters.month || filters.startDate || filters.endDate) && (
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-[#334155] bg-[#0f172a] p-4 md:grid-cols-3">
          <div>
            <div className="text-sm font-medium text-[#94a3b8]">Total HBD</div>
            <div className="text-2xl font-bold text-[#ef4444]">{formatCurrency(monthlyTotals.totalHbd)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-[#94a3b8]">Total Hive</div>
            <div className="text-2xl font-bold text-[#ef4444]">{formatCurrency(monthlyTotals.totalHive)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-[#94a3b8]">Total Spend</div>
            <div className="text-2xl font-bold text-[#ef4444]">{formatCurrency(monthlyTotals.totalSpend)}</div>
          </div>
        </div>
      )}
    </div>
  );
}


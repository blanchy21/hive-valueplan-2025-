'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/types';
import FilterBar from '@/components/table/FilterBar';
import TransactionTable from '@/components/table/TransactionTable';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<{
    country?: string;
    category?: string;
    eventType?: string;
    wallet?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
  }>({
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  });

  useEffect(() => {
    setMounted(true);
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching transactions:', err);
        setLoading(false);
      });
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Transactions</h1>
        <p className="mt-2 text-lg text-gray-600">View and filter all Value Plan transactions</p>
      </div>

      <FilterBar transactions={transactions} filters={filters} onFilterChange={setFilters} />

      <TransactionTable transactions={transactions} filters={filters} />
    </div>
  );
}


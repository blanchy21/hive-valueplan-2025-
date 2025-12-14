'use client';

import { useEffect, useState } from 'react';
import { Metrics } from '@/lib/types';
import MetricCard from '@/components/dashboard/MetricCard';
import { formatCurrency } from '@/lib/utils/format';

export default function ExecutiveSummary() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    fetch('/api/metrics?year=2025')
      .then(res => res.json())
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching metrics:', err);
        setLoading(false);
      });
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#94a3b8]">Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        Unable to load metrics. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">2025 Year Overview</h2>
          {metrics && metrics.sourceOfTruth && (
            <div className="text-xs text-[#94a3b8]">
              Source: <span className="font-semibold text-green-400">{metrics.sourceOfTruth}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total HBD"
            value={formatCurrency(metrics.totalHbd)}
            subtitle="Hive Backed Dollars"
          />
          <MetricCard
            title="Total Hive"
            value={formatCurrency(metrics.totalHive)}
            subtitle="Hive Tokens"
          />
          <MetricCard
            title="Combined Total (HBD)"
            value={formatCurrency(metrics.combinedTotalHbd)}
            subtitle="HBD Equivalent"
          />
          <MetricCard
            title="Remaining Q4 Funds"
            value={formatCurrency(metrics.remainingQ4Funds)}
            subtitle="Available for Q4"
          />
        </div>
      </div>

      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
        <h3 className="mb-4 text-xl font-semibold text-white">Strategic Initiatives</h3>
        <div className="space-y-4 text-[#94a3b8]">
          <div>
            <h4 className="font-semibold text-white">1. Strategic Partnerships</h4>
            <p className="mt-1">
              Engagement with blockchain networks, DApps, and traditional finance entities to expand Hive&apos;s ecosystem.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white">2. Community Engagement</h4>
            <p className="mt-1">
              Workshops, events, and community-driven initiatives to grow user base and increase retention.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white">3. Brand Awareness</h4>
            <p className="mt-1">
              Media expansion, viral campaigns, and strategic marketing to increase Hive&apos;s visibility.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white">4. HBD Adoption</h4>
            <p className="mt-1">
              Focus on B2B partnerships and initiatives to drive adoption of Hive Backed Dollars.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-xl font-semibold text-white">Loans & Refunds</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total Loans"
            value={formatCurrency(metrics.totalLoansHbdEquivalent)}
            subtitle={`${formatCurrency(metrics.totalLoansHbd)} HBD + ${formatCurrency(metrics.totalLoansHive)} HIVE`}
          />
          <MetricCard
            title="Total Refunds"
            value={formatCurrency(metrics.totalRefundsHbdEquivalent)}
            subtitle={`${formatCurrency(metrics.totalRefundsHbd)} HBD + ${formatCurrency(metrics.totalRefundsHive)} HIVE`}
          />
          <MetricCard
            title="Total Loan Refunds"
            value={formatCurrency(metrics.totalLoanRefundsHbdEquivalent)}
            subtitle={`${formatCurrency(metrics.totalLoanRefundsHbd)} HBD + ${formatCurrency(metrics.totalLoanRefundsHive)} HIVE`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Top Categories</h3>
          <div className="space-y-2">
            {Object.entries(metrics.spendingByCategory)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-[#94a3b8]">{category}</span>
                  <span className="font-semibold text-[#ef4444]">{formatCurrency(amount)}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Top Countries</h3>
          <div className="space-y-2">
            {Object.entries(metrics.spendingByCountry)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([country, amount]) => (
                <div key={country} className="flex items-center justify-between">
                  <span className="text-[#94a3b8]">{country}</span>
                  <span className="font-semibold text-[#ef4444]">{formatCurrency(amount)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}


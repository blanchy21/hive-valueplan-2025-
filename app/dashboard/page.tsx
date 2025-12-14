'use client';

import { useEffect, useState } from 'react';
import { Metrics } from '@/lib/types';
import ChartCard from '@/components/dashboard/ChartCard';
import SpendingChart from '@/components/dashboard/SpendingChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import MonthlyTrendChart from '@/components/dashboard/MonthlyTrendChart';
import WalletRankingList from '@/components/dashboard/WalletRankingList';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    fetch('/api/metrics')
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
        <div className="text-[#94a3b8]">Loading dashboard...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        Unable to load dashboard data. Please try again later.
      </div>
    );
  }

  const categoryData = Object.entries(metrics.spendingByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const countryData = Object.entries(metrics.spendingByCountry)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const eventTypeData = Object.entries(metrics.spendingByEventType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const eventProjectData = Object.entries(metrics.spendingByEventProject)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .filter(item => item.name && item.name !== 'Unknown' && item.value > 0); // Filter out empty/unknown projects

  const walletData = Object.entries(metrics.spendingByWallet)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .filter(item => item.name && item.name !== 'Unknown' && item.value > 0); // Filter out empty/unknown wallets

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Value Plan Dashboard</h1>
        <p className="mt-2 text-lg text-[#94a3b8]">Interactive analytics and visualizations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Spending by Category">
          <SpendingChart data={categoryData} title="Category Spending" />
        </ChartCard>

        <ChartCard title="Spending by Country">
          <SpendingChart data={countryData} title="Country Spending" />
        </ChartCard>

        <ChartCard title="Spending by Event Type">
          <SpendingChart data={eventTypeData} title="Event Type Spending" />
        </ChartCard>

        <ChartCard title="Spending by Event Project">
          <div className="mb-3 rounded-md bg-[#1e293b] border border-[#334155] p-2 text-xs text-[#94a3b8]">
            <strong>Note:</strong> These totals show funding for each project across all wallets. A wallet may appear in multiple projects, and project names must match exactly.
          </div>
          <SpendingChart data={eventProjectData} title="Event Project Spending" />
        </ChartCard>

        <ChartCard title="Category Distribution">
          <CategoryPieChart data={categoryData} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard title="Monthly Spending Trends">
          <MonthlyTrendChart data={metrics.monthlySpending} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <WalletRankingList 
          data={walletData} 
          title="Top Funded Wallets"
        />
        <div className="mt-4 rounded-lg border border-[#475569] bg-[#1e293b] p-4 text-sm text-[#94a3b8]">
          <div className="font-semibold mb-2 text-white">📊 Understanding Wallet vs Project Totals</div>
          <div className="space-y-1 text-xs">
            <p><strong>Wallet Totals:</strong> Show the total amount received by each wallet across <em>all projects</em> they&apos;re involved in.</p>
            <p><strong>Project Totals:</strong> Show the total amount spent on each project across <em>all wallets</em> that received funding for that project.</p>
            <p className="mt-2 text-[#94a3b8]"><strong>Why they differ:</strong> A wallet can receive funding for multiple projects (e.g., SWC, SWC/B2B), and a project can have funding sent to multiple wallets. Project names must match exactly (case-sensitive).</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Spending Breakdown (Excludes Loans & Refunds)</h3>
          <div className="mb-4 rounded-md bg-[#0f172a] border border-[#334155] p-3 text-xs text-[#94a3b8]">
            <strong>Note:</strong> These totals match the charts above and exclude loans and refunds.
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[#94a3b8]">HBD Spending</span>
                <span className="text-lg font-bold text-[#ef4444]">
                  {metrics.totalHbd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#0f172a]">
                <div
                  className="h-full bg-[#ef4444]"
                  style={{
                    width: `${metrics.combinedTotalHbd > 0 ? (metrics.totalHbd / metrics.combinedTotalHbd) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[#94a3b8]">Hive Spending (HBD equivalent)</span>
                <span className="text-lg font-bold text-green-400">
                  {(metrics.combinedTotalHbd - metrics.totalHbd).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#0f172a]">
                <div
                  className="h-full bg-green-400"
                  style={{
                    width: `${metrics.combinedTotalHbd > 0 ? ((metrics.combinedTotalHbd - metrics.totalHbd) / metrics.combinedTotalHbd) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-4 border-t border-[#334155] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#94a3b8]">Total Spending</span>
                <span className="text-lg font-bold text-white">
                  {metrics.combinedTotalHbd.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Key Statistics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">Total Categories</span>
              <span className="font-semibold text-white">{Object.keys(metrics.spendingByCategory).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">Total Countries</span>
              <span className="font-semibold text-white">{Object.keys(metrics.spendingByCountry).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">Event Types</span>
              <span className="font-semibold text-white">{Object.keys(metrics.spendingByEventType).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">Event Projects</span>
              <span className="font-semibold text-white">
                {Object.entries(metrics.spendingByEventProject)
                  .filter(([name, value]) => name && name.trim() !== '' && name !== 'Unknown' && value > 0).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8]">Months Tracked</span>
              <span className="font-semibold text-white">{metrics.monthlySpending.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


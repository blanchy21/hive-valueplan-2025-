'use client';

import { useEffect, useState } from 'react';
import { VerticalsData } from '@/lib/types/verticals';
import VerticalsChart from '@/components/verticals/VerticalsChart';
import CategorySpendingPieChart from '@/components/verticals/CategorySpendingPieChart';
import CategorySpendingBarChart from '@/components/verticals/CategorySpendingBarChart';
import CategoryAnalysisCard from '@/components/verticals/CategoryAnalysisCard';
import ChartCard from '@/components/dashboard/ChartCard';
import { formatCurrency } from '@/lib/utils/format';

type VerticalsResponse = VerticalsData | (VerticalsData & {
  error?: string;
  details?: string;
  url?: string;
  debug?: unknown;
});

export default function VerticalsPage() {
  const [data, setData] = useState<VerticalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    fetch('/api/verticals')
      .then(res => res.json())
      .then(fetchedData => {
        setData(fetchedData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching verticals:', err);
        setLoading(false);
      });
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#94a3b8]">Loading verticals data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        <h3 className="font-semibold mb-2">Unable to load verticals data</h3>
        <p>Please check:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>The Google Sheets document is accessible</li>
          <li>The correct tab (gid) is configured in lib/utils/sheets.ts</li>
          <li>Check the browser console for detailed error messages</li>
        </ul>
      </div>
    );
  }

  // Check if there's an error in the response
  if (data && 'error' in data && data.error) {
    const errorData = data as VerticalsData & { error: string; details?: string; url?: string; debug?: unknown };
    return (
      <div className="rounded-lg border border-[#475569] bg-[#1e293b] p-6 text-[#94a3b8]">
        <h3 className="font-semibold mb-2 text-lg text-white">Warning: {String(errorData.error)}</h3>
        {errorData.details && (
          <p className="mb-2 text-sm">{String(errorData.details)}</p>
        )}
        {errorData.url && (
          <p className="mb-2 text-xs font-mono bg-[#0f172a] border border-[#334155] p-2 rounded text-[#94a3b8]">{String(errorData.url)}</p>
        )}
        {errorData.debug !== undefined && errorData.debug !== null && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-white">Debug Information</summary>
            <pre className="mt-2 text-xs bg-[#0f172a] border border-[#334155] p-2 rounded overflow-auto text-[#94a3b8]">
              {JSON.stringify(errorData.debug, null, 2)}
            </pre>
          </details>
        )}
        <p className="mt-4 text-sm">
          If the verticals data is in a different tab, update <code className="bg-[#0f172a] border border-[#334155] px-1 rounded text-[#94a3b8]">SHEET_TABS.VERTICALS</code> in <code className="bg-[#0f172a] border border-[#334155] px-1 rounded text-[#94a3b8]">lib/utils/sheets.ts</code>
        </p>
      </div>
    );
  }

  // Filter projects based on selected category and status
  let filteredProjects = data.projects;
  if (selectedCategory) {
    filteredProjects = filteredProjects.filter(p => p.category === selectedCategory);
  }
  if (selectedStatus) {
    filteredProjects = filteredProjects.filter(p => p.status === selectedStatus);
  }

  const statusCounts = Object.entries(data.byStatus).map(([status, projects]) => ({
    status,
    count: projects.length,
  }));

  // Ensure data has the required properties
  if (!data || !('projects' in data) || !('categories' in data)) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        Invalid data structure received from API.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Verticals & Initiatives</h1>
        <p className="mt-2 text-lg text-[#94a3b8]">Strategic initiatives and project tracking</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Total Projects</h3>
          <p className="mt-2 text-3xl font-bold text-white">{data.projects.length}</p>
        </div>
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Categories</h3>
          <p className="mt-2 text-3xl font-bold text-white">{data.categories.length}</p>
        </div>
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Active Projects</h3>
          <p className="mt-2 text-3xl font-bold text-[#ef4444]">
            {data.byStatus['Ongoing']?.length || 0}
          </p>
        </div>
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Total Spending (2025)</h3>
          <p className="mt-2 text-3xl font-bold text-[#ef4444]">
            {formatCurrency(
              data.categories.reduce((sum, cat) => sum + (cat.combinedTotalHbd || 0), 0),
              2
            )} HBD
          </p>
        </div>
      </div>

      {/* Charts */}
      <VerticalsChart data={data} />

      {/* Financial Analysis Charts */}
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-white">Financial Analysis by Category</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Category Spending Distribution" className="h-96">
            <CategorySpendingPieChart categories={data.categories} />
          </ChartCard>
          <ChartCard title="HBD vs HIVE Breakdown by Category" className="h-96">
            <CategorySpendingBarChart categories={data.categories} />
          </ChartCard>
        </div>
      </div>

      {/* Category Analysis */}
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-white">Detailed Category Analysis</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((category, index) => (
            <CategoryAnalysisCard key={`${category.name}-${index}`} category={category} />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-[#334155] bg-[#1e293b] p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#94a3b8]">Filter by Category</label>
            <select
              value={selectedCategory || ''}
              onChange={e => setSelectedCategory(e.target.value || null)}
              className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
            >
              <option value="">All Categories</option>
              {data.categories.map((cat, index) => (
                <option key={`${cat.name}-${index}`} value={cat.name}>
                  {cat.name} ({cat.projects.length})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#94a3b8]">Filter by Status</label>
            <select
              value={selectedStatus || ''}
              onChange={e => setSelectedStatus(e.target.value || null)}
              className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
            >
              <option value="">All Statuses</option>
              {statusCounts.map(({ status, count }) => (
                <option key={status} value={status}>
                  {status} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>
        {(selectedCategory || selectedStatus) && (
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedStatus(null);
            }}
            className="mt-4 text-sm text-[#ef4444] hover:text-[#dc2626]"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Category Overview */}
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold text-white">Categories Overview</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((category, index) => (
            <div
              key={`${category.name}-${index}`}
              className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-[#475569]"
              onClick={() => setSelectedCategory(category.name)}
            >
              <h3 className="text-lg font-semibold text-white">{category.name}</h3>
              {category.description && (
                <p className="mt-2 text-sm text-[#94a3b8]">{category.description}</p>
              )}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94a3b8]">Projects</span>
                  <span className="text-lg font-bold text-white">{category.projects.length}</span>
                </div>
                
                {/* Financial Values for 2025 */}
                {(category.combinedTotalHbd !== undefined && category.combinedTotalHbd > 0) && (
                  <div className="rounded-md bg-[#0f172a] border border-[#334155] p-3 space-y-2">
                    <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
                      2025 Spending
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#94a3b8]">Total HBD:</span>
                        <span className="font-semibold text-white">
                          {formatCurrency(category.totalHbd || 0, 2)} HBD
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#94a3b8]">Total Hive:</span>
                        <span className="font-semibold text-white">
                          {formatCurrency(category.totalHive || 0, 2)} HIVE
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#94a3b8]">Hive (HBD equiv.):</span>
                        <span className="font-semibold text-white">
                          {formatCurrency(category.totalHiveInHbd || 0, 2)} HBD
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#334155] flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#94a3b8]">Combined Total:</span>
                        <span className="text-base font-bold text-[#ef4444]">
                          {formatCurrency(category.combinedTotalHbd || 0, 2)} HBD
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(
                      category.projects.reduce((acc, p) => {
                        acc[p.status] = (acc[p.status] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([status, count]) => (
                      <span
                        key={status}
                        className={`rounded-full px-2 py-1 text-xs font-medium border ${
                          status === 'Ongoing'
                            ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                            : status === 'Concluded'
                            ? 'bg-[#94a3b8]/20 text-[#94a3b8] border-[#94a3b8]/30'
                            : status === 'Transitioning'
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            : 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                        }`}
                      >
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Table */}
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] shadow-sm">
        <div className="px-6 py-4 border-b border-[#334155]">
          <h2 className="text-xl font-semibold text-white">
            Projects {selectedCategory && `- ${selectedCategory}`} {selectedStatus && `(${selectedStatus})`}
          </h2>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Showing {filteredProjects.length} of {data.projects.length} projects
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#334155]">
            <thead className="bg-[#0f172a]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#94a3b8]">
                    No projects found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project, index) => (
                  <tr key={index} className="hover:bg-[#0f172a]">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                      {project.project}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[#94a3b8]">{project.category}</td>
                    <td className="px-6 py-4 text-sm text-[#94a3b8]">{project.type}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold border ${
                          project.status === 'Ongoing'
                            ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                            : project.status === 'Concluded'
                            ? 'bg-[#94a3b8]/20 text-[#94a3b8] border-[#94a3b8]/30'
                            : project.status === 'Transitioning'
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            : project.status === 'Initiating'
                            ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30'
                            : 'bg-[#94a3b8]/20 text-[#94a3b8] border-[#94a3b8]/30'
                        }`}
                      >
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


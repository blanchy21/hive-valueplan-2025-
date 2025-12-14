'use client';

import { VerticalCategory } from '@/lib/types/verticals';
import { formatCurrency } from '@/lib/utils/format';

interface CategoryAnalysisCardProps {
  category: VerticalCategory;
}

export default function CategoryAnalysisCard({ category }: CategoryAnalysisCardProps) {
  const totalSpending = category.combinedTotalHbd || 0;
  const hbdAmount = category.totalHbd || 0;
  const hiveAmount = category.totalHive || 0;
  const hiveInHbd = category.totalHiveInHbd || 0;
  const projectCount = category.projects.length;

  // Calculate status breakdown
  const statusBreakdown = category.projects.reduce((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate average spending per project
  const avgSpendingPerProject = projectCount > 0 ? totalSpending / projectCount : 0;

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ongoing':
        return 'bg-green-100 text-green-800';
      case 'Transitioning':
        return 'bg-yellow-100 text-yellow-800';
      case 'Concluded':
        return 'bg-gray-100 text-gray-800';
      case 'Initiating':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900">{category.name}</h3>
        {category.description && (
          <p className="mt-1 text-sm text-gray-600">{category.description}</p>
        )}
      </div>

      {/* Financial Summary */}
      <div className="mb-4 rounded-lg bg-blue-50 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          2025 Financial Summary
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(totalSpending, 2)} HBD
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">HBD:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {formatCurrency(hbdAmount, 2)} HBD
            </span>
          </div>
          <div>
            <span className="text-gray-600">HIVE:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {formatCurrency(hiveAmount, 2)} HIVE
            </span>
          </div>
          <div>
            <span className="text-gray-600">HIVE (equiv):</span>
            <span className="ml-2 font-semibold text-gray-900">
              {formatCurrency(hiveInHbd, 2)} HBD
            </span>
          </div>
          <div>
            <span className="text-gray-600">Avg/Project:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {formatCurrency(avgSpendingPerProject, 2)} HBD
            </span>
          </div>
        </div>
      </div>

      {/* Project Statistics */}
      <div className="mb-4">
        <div className="mb-2 text-sm font-semibold text-gray-700">Project Statistics</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">{projectCount}</div>
            <div className="text-xs text-gray-600">Total Projects</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {statusBreakdown['Ongoing'] || 0}
            </div>
            <div className="text-xs text-gray-600">Active Projects</div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      {Object.keys(statusBreakdown).length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-gray-700">Status Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <span
                key={status}
                className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(status)}`}
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


'use client';

import { Bar } from 'react-chartjs-2';
import { VerticalsData } from '@/lib/types/verticals';
import { chartOptions } from '@/lib/chart-config';
import '@/lib/chart-config'; // Initialize Chart.js

interface VerticalsChartProps {
  data: VerticalsData;
}

export default function VerticalsChart({ data }: VerticalsChartProps) {
  // Chart 1: Projects by Category
  const categoryData = {
    labels: data.categories.map(cat => cat.name),
    datasets: [
      {
        label: 'Projects',
        data: data.categories.map(cat => cat.projects.length),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',   // Blue - Ecosystem Marketing
          'rgba(16, 185, 129, 0.8)',   // Green - Social Impact
          'rgba(245, 158, 11, 0.8)',   // Amber - Hive and HBD Adoption
          'rgba(139, 92, 246, 0.8)',   // Purple - Conferences
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(139, 92, 246, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Chart 2: Projects by Status
  const statusData = {
    labels: Object.keys(data.byStatus),
    datasets: [
      {
        label: 'Projects',
        data: Object.values(data.byStatus).map(projects => projects.length),
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',   // Green - Ongoing
          'rgba(245, 158, 11, 0.8)',   // Amber - Transitioning
          'rgba(107, 114, 128, 0.8)', // Gray - Concluded
          'rgba(59, 130, 246, 0.8)',   // Blue - Initiating
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(107, 114, 128, 1)',
          'rgba(59, 130, 246, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Chart 3: Stacked Bar Chart - Status breakdown by Category
  const statuses = ['Ongoing', 'Transitioning', 'Concluded', 'Initiating'];
  const statusColors: Record<string, { bg: string; border: string }> = {
    'Ongoing': { bg: 'rgba(16, 185, 129, 0.8)', border: 'rgba(16, 185, 129, 1)' },
    'Transitioning': { bg: 'rgba(245, 158, 11, 0.8)', border: 'rgba(245, 158, 11, 1)' },
    'Concluded': { bg: 'rgba(107, 114, 128, 0.8)', border: 'rgba(107, 114, 128, 1)' },
    'Initiating': { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },
  };

  const stackedData = {
    labels: data.categories.map(cat => cat.name),
    datasets: statuses.map(status => ({
      label: status,
      data: data.categories.map(cat => 
        cat.projects.filter(p => p.status === status).length
      ),
      backgroundColor: statusColors[status]?.bg || 'rgba(156, 163, 175, 0.8)',
      borderColor: statusColors[status]?.border || 'rgba(156, 163, 175, 1)',
      borderWidth: 1,
    })),
  };

  const categoryOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Projects by Category',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y} projects`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          callback: function(value: string | number) {
            return Number(value);
          },
        },
      },
    },
  };

  const statusOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Projects by Status',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y} projects`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          callback: function(value: string | number) {
            return Number(value);
          },
        },
      },
    },
  };

  const stackedOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Status Breakdown by Category',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y} projects`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          callback: function(value: string | number) {
            return Number(value);
          },
        },
      },
    },
  };

  return (
    <div className="mb-8 space-y-8">
      {/* Projects by Category */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-80">
          <Bar data={categoryData} options={categoryOptions} />
        </div>
      </div>

      {/* Projects by Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-80">
          <Bar data={statusData} options={statusOptions} />
        </div>
      </div>

      {/* Stacked Chart - Status by Category */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-80">
          <Bar data={stackedData} options={stackedOptions} />
        </div>
      </div>
    </div>
  );
}


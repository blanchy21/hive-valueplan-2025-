'use client';

import { Bar } from 'react-chartjs-2';
import { VerticalCategory } from '@/lib/types/verticals';
import { formatCurrency } from '@/lib/utils/format';
import '@/lib/chart-config'; // Initialize Chart.js

interface CategorySpendingBarChartProps {
  categories: VerticalCategory[];
}

const CATEGORY_COLORS = [
  'rgba(59, 130, 246, 0.8)',   // Blue - Ecosystem Marketing
  'rgba(16, 185, 129, 0.8)',   // Green - Social Impact
  'rgba(245, 158, 11, 0.8)',   // Amber - Hive and HBD Adoption
  'rgba(139, 92, 246, 0.8)',   // Purple - Conferences
];

export default function CategorySpendingBarChart({ categories }: CategorySpendingBarChartProps) {
  const filteredCategories = categories.filter(cat => (cat.combinedTotalHbd || 0) > 0);
  
  const chartData = {
    labels: filteredCategories.map(cat => cat.name),
    datasets: [
      {
        label: 'HBD',
        data: filteredCategories.map(cat => cat.totalHbd || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
      },
      {
        label: 'HIVE (HBD equivalent)',
        data: filteredCategories.map(cat => cat.totalHiveInHbd || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatCurrency(value, 2)} HBD`;
          },
          footer: function(tooltipItems: any[]) {
            const total = tooltipItems.reduce((sum, item) => sum + (item.parsed.y || 0), 0);
            return `Total: ${formatCurrency(total, 2)} HBD`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: false,
      },
      y: {
        beginAtZero: true,
        stacked: false,
        ticks: {
          callback: function(value: string | number) {
            return formatCurrency(Number(value), 0);
          },
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}


'use client';

import { Pie } from 'react-chartjs-2';
import { VerticalCategory } from '@/lib/types/verticals';
import { formatCurrency } from '@/lib/utils/format';
import '@/lib/chart-config'; // Initialize Chart.js

interface CategorySpendingPieChartProps {
  categories: VerticalCategory[];
}

const CATEGORY_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },    // Blue - Ecosystem Marketing
  { bg: 'rgba(16, 185, 129, 0.8)', border: 'rgba(16, 185, 129, 1)' },    // Green - Social Impact
  { bg: 'rgba(245, 158, 11, 0.8)', border: 'rgba(245, 158, 11, 1)' },    // Amber - Hive and HBD Adoption
  { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgba(139, 92, 246, 1)' },    // Purple - Conferences
];

export default function CategorySpendingPieChart({ categories }: CategorySpendingPieChartProps) {
  const filteredCategories = categories.filter(cat => (cat.combinedTotalHbd || 0) > 0);
  
  const chartData = {
    labels: filteredCategories.map(cat => cat.name),
    datasets: [
      {
        label: 'Spending (HBD)',
        data: filteredCategories.map(cat => cat.combinedTotalHbd || 0),
        backgroundColor: filteredCategories.map((_, index) => 
          CATEGORY_COLORS[index % CATEGORY_COLORS.length].bg
        ),
        borderColor: filteredCategories.map((_, index) => 
          CATEGORY_COLORS[index % CATEGORY_COLORS.length].border
        ),
        borderWidth: 2,
      },
    ],
  };

  const total = filteredCategories.reduce((sum, cat) => sum + (cat.combinedTotalHbd || 0), 0);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${formatCurrency(value, 2)} HBD (${percentage}%)`;
          },
        },
      },
    },
  };

  return <Pie data={chartData} options={options} />;
}


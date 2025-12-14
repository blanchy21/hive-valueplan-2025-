'use client';

import { Pie } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/utils/format';
import { chartOptions } from '@/lib/chart-config';
import '@/lib/chart-config'; // Initialize Chart.js

interface CategoryPieChartProps {
  data: Array<{ name: string; value: number }>;
}

const COLORS = [
  'rgba(239, 68, 68, 0.9)',    // Vibrant Red
  'rgba(59, 130, 246, 0.9)',   // Bright Blue
  'rgba(16, 185, 129, 0.9)',   // Emerald Green
  'rgba(245, 158, 11, 0.9)',   // Amber/Yellow
  'rgba(139, 92, 246, 0.9)',   // Purple
  'rgba(236, 72, 153, 0.9)',   // Pink
  'rgba(6, 182, 212, 0.9)',    // Cyan
  'rgba(132, 204, 22, 0.9)',   // Lime Green
  'rgba(249, 115, 22, 0.9)',   // Orange
  'rgba(168, 85, 247, 0.9)',   // Violet
];

const BORDER_COLORS = [
  'rgba(239, 68, 68, 1)',
  'rgba(59, 130, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(6, 182, 212, 1)',
  'rgba(132, 204, 22, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(168, 85, 247, 1)',
];

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  const chartData = {
    labels: data.slice(0, 8).map(item => item.name),
    datasets: [
      {
        label: 'Spending',
        data: data.slice(0, 8).map(item => item.value),
        backgroundColor: COLORS,
        borderColor: BORDER_COLORS,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        labels: {
          color: '#94a3b8',
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  return <Pie data={chartData} options={options} />;
}

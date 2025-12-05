'use client';

import { Pie } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/utils/format';
import { chartOptions } from '@/lib/chart-config';
import '@/lib/chart-config'; // Initialize Chart.js

interface CategoryPieChartProps {
  data: Array<{ name: string; value: number }>;
}

const COLORS = [
  'rgba(59, 130, 246, 0.8)',   // blue
  'rgba(16, 185, 129, 0.8)',   // green
  'rgba(245, 158, 11, 0.8)',   // yellow
  'rgba(239, 68, 68, 0.8)',    // red
  'rgba(139, 92, 246, 0.8)',   // purple
  'rgba(236, 72, 153, 0.8)',   // pink
  'rgba(6, 182, 212, 0.8)',    // cyan
  'rgba(132, 204, 22, 0.8)',   // lime
];

const BORDER_COLORS = [
  'rgba(59, 130, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(6, 182, 212, 1)',
  'rgba(132, 204, 22, 1)',
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

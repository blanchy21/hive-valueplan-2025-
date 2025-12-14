'use client';

import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/utils/format';
import { chartOptions } from '@/lib/chart-config';
import '@/lib/chart-config'; // Initialize Chart.js

interface SpendingChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
}

// Vibrant color palette for bars
const BAR_COLORS = [
  { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgba(239, 68, 68, 1)' },    // Red
  { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },  // Blue
  { bg: 'rgba(16, 185, 129, 0.8)', border: 'rgba(16, 185, 129, 1)' },  // Green
  { bg: 'rgba(245, 158, 11, 0.8)', border: 'rgba(245, 158, 11, 1)' },  // Amber
  { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgba(139, 92, 246, 1)' },  // Purple
  { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgba(236, 72, 153, 1)' },  // Pink
  { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgba(6, 182, 212, 1)' },    // Cyan
  { bg: 'rgba(132, 204, 22, 0.8)', border: 'rgba(132, 204, 22, 1)' },  // Lime
  { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgba(249, 115, 22, 1)' },  // Orange
  { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgba(168, 85, 247, 1)' },  // Violet
];

export default function SpendingChart({ data, title }: SpendingChartProps) {
  const chartData = {
    labels: data.map(item => 
      item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name
    ),
    datasets: [
      {
        label: 'Spending',
        data: data.map(item => item.value),
        backgroundColor: data.map((_, index) => 
          BAR_COLORS[index % BAR_COLORS.length].bg
        ),
        borderColor: data.map((_, index) => 
          BAR_COLORS[index % BAR_COLORS.length].border
        ),
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: false,
      },
      legend: {
        ...chartOptions.plugins.legend,
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          color: '#334155',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          callback: function(value: string | number) {
            return formatCurrency(Number(value), 0);
          },
        },
        grid: {
          color: '#334155',
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

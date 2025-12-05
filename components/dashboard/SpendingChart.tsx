'use client';

import { Bar } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/utils/format';
import { chartOptions } from '@/lib/chart-config';
import '@/lib/chart-config'; // Initialize Chart.js

interface SpendingChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
}

export default function SpendingChart({ data, title }: SpendingChartProps) {
  const chartData = {
    labels: data.map(item => 
      item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name
    ),
    datasets: [
      {
        label: 'Spending',
        data: data.map(item => item.value),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
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
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: string | number) {
            return formatCurrency(Number(value), 0);
          },
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

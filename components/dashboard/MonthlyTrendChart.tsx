'use client';

import { Line } from 'react-chartjs-2';
import { formatCurrency } from '@/lib/utils/format';
import { format, parseISO } from 'date-fns';
import { chartOptions } from '@/lib/chart-config';
import '@/lib/chart-config'; // Initialize Chart.js

interface MonthlyTrendChartProps {
  data: Array<{ month: string; hbd: number; hive: number; total: number }>;
}

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const chartData = {
    labels: data.map(item => format(parseISO(item.month + '-01'), 'MMM yyyy')),
    datasets: [
      {
        label: 'HBD',
        data: data.map(item => item.hbd),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'Hive',
        data: data.map(item => item.hive),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'Total',
        data: data.map(item => item.total),
        borderColor: 'rgba(245, 158, 11, 1)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        tension: 0.4,
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
    },
  };

  return <Line data={chartData} options={options} />;
}

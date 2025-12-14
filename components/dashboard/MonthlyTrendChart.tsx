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
        borderColor: 'rgba(239, 68, 68, 1)',        // Vibrant Red
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
      {
        label: 'Hive',
        data: data.map(item => item.hive),
        borderColor: 'rgba(16, 185, 129, 1)',       // Emerald Green
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
      {
        label: 'Total',
        data: data.map(item => item.total),
        borderColor: 'rgba(59, 130, 246, 1)',       // Bright Blue
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
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
        labels: {
          color: '#94a3b8',
          padding: 15,
          font: {
            size: 12,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatCurrency(value, 2)} HBD`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
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

  return <Line data={chartData} options={options} />;
}

'use client';

import { formatCurrency } from '@/lib/utils/format';

interface WalletRankingListProps {
  data: Array<{ name: string; value: number }>;
  title?: string;
}

export default function WalletRankingList({ data, title = 'Top Funded Accounts' }: WalletRankingListProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total (HBD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((item, index) => (
              <tr key={item.name} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  #{index + 1}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {item.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatCurrency(item.value, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


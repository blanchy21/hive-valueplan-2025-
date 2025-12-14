'use client';

import { formatCurrency } from '@/lib/utils/format';

interface WalletRankingListProps {
  data: Array<{ name: string; value: number }>;
  title?: string;
}

export default function WalletRankingList({ data, title = 'Top Funded Accounts' }: WalletRankingListProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
        <p className="text-[#94a3b8]">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#334155]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94a3b8]">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94a3b8]">Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94a3b8]">Total (HBD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {data.map((item, index) => (
              <tr key={item.name} className="hover:bg-[#0f172a]">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-white">
                  #{index + 1}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-white">
                  {item.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-[#ef4444]">
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


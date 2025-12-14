interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function MetricCard({ title, value, subtitle, trend }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#94a3b8]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-[#94a3b8]">{subtitle}</p>}
        </div>
        {trend && (
          <div className={`text-sm font-medium ${trend.isPositive ? 'text-green-400' : 'text-[#ef4444]'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>
    </div>
  );
}


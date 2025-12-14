interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function ChartCard({ title, children, className = '' }: ChartCardProps) {
  return (
    <div className={`rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <div className="h-64 w-full min-h-[256px] min-w-0">{children}</div>
    </div>
  );
}


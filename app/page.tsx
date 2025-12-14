import ExecutiveSummary from '@/components/content/ExecutiveSummary';

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Value Plan Executive Summary</h1>
        <p className="mt-2 text-lg text-[#94a3b8]">2025 Year Overview</p>
      </div>
      <ExecutiveSummary />
    </div>
  );
}

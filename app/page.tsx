import ExecutiveSummary from '@/components/content/ExecutiveSummary';

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Value Plan Executive Summary</h1>
        <p className="mt-2 text-lg text-gray-600">2025 Year Overview</p>
      </div>
      <ExecutiveSummary />
    </div>
  );
}

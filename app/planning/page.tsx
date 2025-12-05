'use client';

import { useEffect, useState } from 'react';
import MarkdownRenderer from '@/components/content/MarkdownRenderer';

interface GitLabContent {
  valuePlan: string;
  planning: string;
}

export default function PlanningPage() {
  const [content, setContent] = useState<GitLabContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'planning' | 'valuePlan'>('planning');

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    fetch('/api/gitlab-content')
      .then(res => res.json())
      .then(data => {
        setContent(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching GitLab content:', err);
        setLoading(false);
      });
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading content...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Unable to load content. Please try again later.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Planning & Strategy</h1>
        <p className="mt-2 text-lg text-gray-600">Value Plan strategy and planning documents</p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('planning')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'planning'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Planning
          </button>
          <button
            onClick={() => setActiveTab('valuePlan')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'valuePlan'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Value Plan Strategy
          </button>
        </nav>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === 'planning' ? (
          content.planning && content.planning.trim() ? (
            <MarkdownRenderer content={content.planning} />
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
              <h3 className="mb-2 font-semibold">No Planning Content Available</h3>
              <p>Unable to load planning content. Please check the GitLab repository configuration or try again later.</p>
            </div>
          )
        ) : (
          content.valuePlan && content.valuePlan.trim() ? (
            <MarkdownRenderer content={content.valuePlan} />
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
              <h3 className="mb-2 font-semibold">No Value Plan Content Available</h3>
              <p>Unable to load Value Plan strategy content. Please check the GitLab repository configuration or try again later.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}


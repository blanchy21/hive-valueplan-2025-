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
        <div className="text-[#94a3b8]">Loading content...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        Unable to load content. Please try again later.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Planning & Strategy</h1>
        <p className="mt-2 text-lg text-[#94a3b8]">Value Plan strategy and planning documents</p>
      </div>

      <div className="mb-6 border-b border-[#334155]">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('planning')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'planning'
                ? 'border-[#ef4444] text-[#ef4444]'
                : 'border-transparent text-[#94a3b8] hover:border-[#64748b] hover:text-white'
            }`}
          >
            Planning
          </button>
          <button
            onClick={() => setActiveTab('valuePlan')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'valuePlan'
                ? 'border-[#ef4444] text-[#ef4444]'
                : 'border-transparent text-[#94a3b8] hover:border-[#64748b] hover:text-white'
            }`}
          >
            Value Plan Strategy
          </button>
        </nav>
      </div>

      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
        {activeTab === 'planning' ? (
          content.planning && content.planning.trim() ? (
            <MarkdownRenderer content={content.planning} />
          ) : (
            <div className="rounded-lg border border-[#475569] bg-[#1e293b] p-4 text-[#94a3b8]">
              <h3 className="mb-2 font-semibold text-white">No Planning Content Available</h3>
              <p>Unable to load planning content. Please check the GitLab repository configuration or try again later.</p>
            </div>
          )
        ) : (
          content.valuePlan && content.valuePlan.trim() ? (
            <MarkdownRenderer content={content.valuePlan} />
          ) : (
            <div className="rounded-lg border border-[#475569] bg-[#1e293b] p-4 text-[#94a3b8]">
              <h3 className="mb-2 font-semibold text-white">No Value Plan Content Available</h3>
              <p>Unable to load Value Plan strategy content. Please check the GitLab repository configuration or try again later.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}


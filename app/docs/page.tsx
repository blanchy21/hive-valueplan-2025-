'use client';

import { useEffect, useState } from 'react';
import MarkdownRenderer from '@/components/content/MarkdownRenderer';

interface HackMDContent {
  content: string;
}

export default function DocsPage() {
  const [content, setContent] = useState<HackMDContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    fetch('/api/hackmd-content')
      .then(res => res.json())
      .then(data => {
        setContent(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching HackMD content:', err);
        setLoading(false);
      });
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#94a3b8]">Loading documentation...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        Unable to load documentation. Please try again later.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Documentation</h1>
        <p className="mt-2 text-lg text-[#94a3b8]">HackMD documentation and resources</p>
      </div>

      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
        <MarkdownRenderer content={content.content} />
      </div>
    </div>
  );
}


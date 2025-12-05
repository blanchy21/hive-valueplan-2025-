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
        <div className="text-gray-600">Loading documentation...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Unable to load documentation. Please try again later.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Documentation</h1>
        <p className="mt-2 text-lg text-gray-600">HackMD documentation and resources</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <MarkdownRenderer content={content.content} />
      </div>
    </div>
  );
}


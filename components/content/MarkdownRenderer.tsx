'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-lg max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mb-4 text-3xl font-bold text-gray-900">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-6 text-2xl font-semibold text-gray-800">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-xl font-semibold text-gray-700">{children}</h3>,
          p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2 text-gray-700">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2 text-gray-700">{children}</ol>,
          li: ({ children }) => <li className="text-gray-700">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-2 py-1 text-sm font-mono text-gray-800">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">{children}</pre>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


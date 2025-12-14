'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-lg max-w-none prose-invert">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mb-4 text-3xl font-bold text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-6 text-2xl font-semibold text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-xl font-semibold text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4 text-lg font-semibold text-white">{children}</h4>,
          h5: ({ children }) => <h5 className="mb-2 mt-4 text-base font-semibold text-white">{children}</h5>,
          h6: ({ children }) => <h6 className="mb-2 mt-4 text-sm font-semibold text-white">{children}</h6>,
          p: ({ children }) => <p className="mb-4 text-[#e2e8f0] leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2 text-[#e2e8f0]">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2 text-[#e2e8f0]">{children}</ol>,
          li: ({ children }) => <li className="text-[#e2e8f0]">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#e2e8f0]">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-[#0f172a] border border-[#334155] px-2 py-1 text-sm font-mono text-[#ef4444]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-[#0f172a] border border-[#334155] p-4 text-sm text-[#e2e8f0]">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-4 border-[#ef4444] pl-4 italic text-[#e2e8f0]">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-[#ef4444] hover:text-[#dc2626] underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-[#334155]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#0f172a]">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-[#334155]">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-[#0f172a]">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">{children}</th>,
          td: ({ children }) => <td className="px-4 py-3 text-sm text-[#e2e8f0]">{children}</td>,
          hr: () => <hr className="my-8 border-[#334155]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


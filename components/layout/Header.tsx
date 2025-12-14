'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Schedule state update for next tick to avoid synchronous setState warning
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const navLinks = [
    { href: '/', label: 'Executive Summary' },
    { href: '/verticals', label: 'Verticals' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/projects', label: 'Projects' },
    { href: '/planning', label: 'Planning' },
    { href: '/docs', label: 'Docs' },
  ];

  const isActive = (href: string) => mounted && pathname === href;

  if (!mounted) {
    // Return a static version during SSR to prevent hydration mismatch
    return (
      <header className="border-b border-[#334155] bg-[#1e293b] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link 
                href="/" 
                className="flex items-center gap-3"
                suppressHydrationWarning
              >
                <Image
                  src="/logo.png"
                  alt="Hive Logo"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <span className="text-xl font-bold text-white">Value Plan Dashboard</span>
              </Link>
            </div>
            <nav className="hidden md:flex md:space-x-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#94a3b8] hover:bg-[#334155] hover:text-white"
                  suppressHydrationWarning
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              className="md:hidden rounded-md p-2 text-[#94a3b8] hover:bg-[#334155]"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-[#334155] bg-[#1e293b] shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="flex items-center gap-3"
              suppressHydrationWarning
            >
              <Image
                src="/logo.png"
                alt="Hive Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-white">Value Plan Dashboard</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:space-x-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-[#e11d48] text-white'
                    : 'text-[#94a3b8] hover:bg-[#334155] hover:text-white'
                }`}
                suppressHydrationWarning
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-md p-2 text-[#94a3b8] hover:bg-[#334155]"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="border-t border-[#334155] py-4 md:hidden">
            <div className="flex flex-col space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    isActive(link.href)
                      ? 'bg-[#e11d48] text-white'
                      : 'text-[#94a3b8] hover:bg-[#334155] hover:text-white'
                  }`}
                  suppressHydrationWarning
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}


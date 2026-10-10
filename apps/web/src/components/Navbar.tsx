'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/?type=movie', label: 'Movies' },
  { href: '/?type=series', label: 'Series' },
  { href: '/browse', label: 'Browse' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20'
          : 'bg-gradient-to-b from-background/80 via-background/40 to-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-4 md:px-16">
        <div className="flex justify-between items-center h-16 md:h-[72px]">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-headline-md text-2xl font-bold tracking-tighter text-primary hover:text-primary/90 transition-colors"
            >
              Veyra
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                    isActive(link.href)
                      ? 'text-white'
                      : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  {link.label}
                  {/* Active indicator dot */}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </Link>
              ))}
              <Link
                href="/search"
                className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                  pathname === '/search'
                    ? 'text-white'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Search
                {pathname === '/search' && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </Link>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Search icon (mobile) */}
            <Link
              href="/search"
              className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              aria-label="Search"
            >
              <Search size={18} />
            </Link>

            {/* Mobile menu toggle */}
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-t border-white/5 animate-slide-up">
          <div className="flex flex-col py-4 px-6 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-white bg-white/5'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/search"
              className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/search'
                  ? 'text-white bg-white/5'
                  : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Search
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

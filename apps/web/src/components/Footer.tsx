'use client';

import Link from 'next/link';

const footerLinks = [
  {
    title: 'Browse',
    links: [
      { label: 'Movies', href: '/?type=movie' },
      { label: 'Series', href: '/?type=series' },
      { label: 'Browse All', href: '/browse' },
      { label: 'Search', href: '/search' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Help Center', href: '/help' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface/50">
      <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12">
        {/* Logo + tagline */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-primary font-black text-3xl italic tracking-[-0.04em]"
          >
            Veyra
          </Link>
          <p className="text-on-surface-variant text-sm mt-2 max-w-xs leading-relaxed">
            Free streaming and downloads — no account needed.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-8 mb-10">
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-white text-xs font-bold uppercase tracking-widest mb-4">
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-on-surface-variant text-sm hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-6 border-t border-white/5">
          <p className="text-on-surface-variant/60 text-xs">
            © {new Date().getFullYear()} Veyra. All rights reserved.
          </p>
          <p className="text-on-surface-variant/40 text-xs">
            Veyra is free to use. Content sourced from publicly available metadata.
          </p>
        </div>
      </div>
    </footer>
  );
}

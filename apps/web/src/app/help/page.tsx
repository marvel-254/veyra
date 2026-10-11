import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center — Veyra',
  description: 'Frequently asked questions and support for Veyra.',
};

const faqs = [
  {
    q: 'Is Veyra really free?',
    a: 'Yes. Veyra is completely free to use. There is no paid tier, no subscription, and no account required.',
  },
  {
    q: 'How does Veyra work?',
    a: 'Veyra fetches movie and series metadata from TMDB (The Movie Database). When you choose to stream or download, content is accessed from publicly available sources on YouTube using the open-source yt-dlp tool.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Veyra works completely anonymously. No sign-up, no login, no email required.',
  },
  {
    q: 'Is Veyra available on the Play Store?',
    a: 'No. Veyra is distributed as an APK for sideloading. This allows us to keep it free without Play Store fees or restrictions. To install: download the APK, enable "Install from unknown sources" in Android Settings.',
  },
  {
    q: 'Why is content not loading?',
    a: 'Veyra relies on publicly available streaming sources. If a title is unavailable, it may have been removed from the source platform. Try a different quality option or check back later.',
  },
  {
    q: 'How do I clear my watch history?',
    a: 'Open the app, go to any movie page, and look for a "Clear Progress" option in the settings. You can also clear it from your browser or app settings.',
  },
  {
    q: 'Is my data being tracked?',
    a: 'No. Veyra does not collect any personal data. Watch progress is stored only on your device and is never sent to any server.',
  },
  {
    q: 'How do I report a bug or request a feature?',
    a: 'Visit our GitHub repository to open an issue. We welcome contributions and feedback.',
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-surface/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-xs text-primary uppercase tracking-widest font-bold mb-2">Support</p>
          <h1 className="text-3xl font-bold text-white">Help Center</h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Frequently asked questions and support information.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="grid gap-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-surface border border-white/5 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-2">{faq.q}</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-surface border border-primary/20 rounded-xl text-center">
          <p className="text-on-surface-variant text-sm mb-4">
            Still need help? Open an issue on GitHub and we&apos;ll get back to you.
          </p>
          <a
            href="https://github.com/marvel-254/veyra/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-on-primary font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all min-h-[48px]"
          >
            Open an Issue
          </a>
        </div>
      </div>
    </div>
  );
}

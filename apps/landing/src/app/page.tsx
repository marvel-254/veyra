export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <nav className="fixed w-full p-6 flex justify-between items-center z-50">
        <h1 className="text-2xl font-bold text-primary">Veyra</h1>
        <a href="/releases" className="text-sm font-semibold text-on-surface-variant hover:text-white transition-colors">
          Changelog
        </a>
      </nav>

      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Veyra — Movies & Series, <span className="text-primary">Free Forever.</span>
          </h1>
          <p className="text-lg text-on-surface-variant mb-10 leading-relaxed">
            A premium cinematic experience. Stream trailers or download movies directly to your device. No login, no accounts, no subscriptions.
          </p>
          <a
            href="https://github.com/marvel-254/veyra/releases/latest/download/veyra-app-debug.apk"
            className="inline-block bg-primary text-on-primary px-10 py-4 rounded-xl font-bold text-lg hover:opacity-90 shadow-2xl shadow-primary/30 transition-all transform hover:scale-105"
          >
            Download Veyra APK
          </a>
          <p className="mt-4 text-xs text-on-surface-variant uppercase tracking-widest font-semibold">
            v0.1.0-alpha · Android 7.0+
          </p>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* NAV */}
      <header className="w-full border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            EnergyFlow ⚡
          </h1>

          <Link
            href="/dashboard/devices"
            className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 transition text-sm font-medium"
          >
            Open Dashboard
          </Link>
        </div>
      </header>

      {/* HERO */}
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Smart Inverter
              <br />
              Monitoring System
            </h2>

            <p className="mt-6 text-zinc-400 text-lg leading-relaxed">
              Real-time telemetry, battery analytics, fault detection and
              instant alerts — built with NestJS, PostgreSQL, Prisma, WebSockets
              and Next.js.
            </p>

            <div className="mt-8 flex gap-4">
              <Link
                href="/dashboard/devices"
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 transition font-medium"
              >
                View Fleet
              </Link>

              <a
                href="https://github.com/eclemz/energyflow-api"
                target="_blank"
                className="px-6 py-3 rounded-xl border border-zinc-700 hover:bg-zinc-800 transition font-medium"
              >
                View Backend Code
              </a>
            </div>
          </div>

          {/* Feature Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
            <h3 className="text-xl font-semibold mb-6">Core Features</h3>

            <ul className="space-y-4 text-zinc-300 text-sm">
              <li>• Real-time telemetry streaming</li>
              <li>• Fleet monitoring dashboard</li>
              <li>• Battery & temperature alerts</li>
              <li>• WebSocket live updates</li>
              <li>• Device authentication</li>
              <li>• PostgreSQL cloud deployment</li>
            </ul>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-zinc-500 flex justify-between">
          <p>© {new Date().getFullYear()} EnergyFlow</p>
          <p>Built by Clement Eneh</p>
        </div>
      </footer>
    </div>
  );
}

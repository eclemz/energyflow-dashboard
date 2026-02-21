import Footer from "@/components/Footer";
import Link from "next/link";

export default function Home() {
  return (
    <div className="px-10 min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* NAV */}
      <header className="w-full border-b border-zinc-800">
        <div className=" px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            EnergyFlow ⚡
          </h1>

          <Link
            href="/login"
            className="text-sm px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white transition"
          >
            Login
          </Link>
        </div>
      </header>

      {/* HERO */}
      <main className="flex-1 flex items-center">
        <div className="px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Smart Inverter
              <br />
              Monitoring System
            </h2>

            <p className="mt-6 text-zinc-400 text-lg leading-relaxed">
              Real-time telemetry, battery analytics, fault detection and
              instant alerts. Built with NestJS, PostgreSQL, Prisma, WebSockets
              Next.js and Tailwind.
            </p>

            <div className="mt-8 flex gap-4">
              {/* GO STRAIGHT TO FLEET PAGE */}
              <Link
                href="/demo"
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 transition font-medium"
              >
                View Live Demo
              </Link>

              {/* SIGN IN CTA OPENS LOGIN PAGE */}
              <Link
                href="/login"
                className="px-6 py-3 rounded-xl border border-zinc-700 hover:bg-zinc-900 transition font-medium"
              >
                Admin Login
              </Link>
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
      <Footer />
    </div>
  );
}

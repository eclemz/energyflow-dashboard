"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-10">
      <div className="max-w-xl rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-red-600">
          Something went wrong on this device page
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          {error.message || "Unknown error"}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => reset()}
            className="rounded-xl border px-3 py-2 text-sm font-medium "
          >
            Try again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border px-3 py-2 text-sm font-medium border-gray-500 text-gray-500 active:scale-95 transition"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

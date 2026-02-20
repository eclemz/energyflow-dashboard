"use client";

export function ErrorBanner({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-red-900">{title}</p>
          <p className="text-sm text-red-800 mt-1">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="p-10 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-44 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-56 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white shadow rounded-2xl p-6">
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="mt-3 h-8 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="space-y-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white shadow rounded-2xl p-6 h-[340]">
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="mt-5 h-[260] w-full bg-gray-200 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// LOADING: Mantenimiento - Skeleton
// =============================================================================
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-40 bg-blue-100 rounded-lg animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4">
            <div className="h-6 w-12 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-gray-50 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b px-6 py-3 grid grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="px-6 py-4 border-b grid grid-cols-4 gap-4">
            <div className="h-5 w-full bg-gray-50 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-50 rounded animate-pulse" />
            <div className="h-6 w-20 bg-gray-50 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
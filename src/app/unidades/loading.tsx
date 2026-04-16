// =============================================================================
// LOADING: Unidades - Skeleton
// =============================================================================
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded animate-pulse" />
            <div>
              <div className="h-6 w-8 bg-gray-100 rounded animate-pulse mb-1" />
              <div className="h-3 w-16 bg-gray-50 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(9).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-6 w-8 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-gray-50 rounded animate-pulse mb-2" />
            <div className="h-3 w-12 bg-gray-50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
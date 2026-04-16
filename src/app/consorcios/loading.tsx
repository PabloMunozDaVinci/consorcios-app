// =============================================================================
// LOADING: Consorcios - Skeleton mientras carga
// =============================================================================
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-40 bg-blue-100 rounded-lg animate-pulse" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-6 w-3/4 bg-gray-100 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-50 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-50 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// =============================================================================
// LOADING: Detalle Consortium - Skeleton
// =============================================================================
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Info card skeleton */}
      <div className="bg-white rounded-xl border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div>
                <div className="h-3 w-16 bg-gray-50 rounded animate-pulse mb-2" />
                <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edificios skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-4 w-16 bg-gray-50 rounded animate-pulse" />
              </div>
              <div className="h-5 w-32 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 w-full bg-gray-50 rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
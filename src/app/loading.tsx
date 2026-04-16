// =============================================================================
// LOADING: Home - Skeleton
// =============================================================================
export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="text-center py-12">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mx-auto mb-3" />
        <div className="h-6 w-96 bg-gray-100 rounded animate-pulse mx-auto" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-6">
            <div className="w-12 h-12 bg-gray-100 rounded-lg animate-pulse mb-4" />
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-gray-50 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div className="bg-white rounded-xl border p-6">
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="h-5 w-32 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-4 w-40 bg-gray-50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
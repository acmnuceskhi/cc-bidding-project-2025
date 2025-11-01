export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-white mx-auto mb-4"></div>
        <h2 className="text-3xl font-bold mb-2">Loading Results</h2>
        <p className="text-xl text-gray-300">Calculating winners...</p>
      </div>
    </div>
  );
}
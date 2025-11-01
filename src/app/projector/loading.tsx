export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
        <h1 className="text-4xl font-bold mb-2">Loading Projector</h1>
        <p className="text-xl text-gray-300">Preparing display...</p>
      </div>
    </div>
  );
}
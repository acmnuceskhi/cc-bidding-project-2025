export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 to-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.15),transparent)]" />
      <div className="relative z-10 backdrop-blur-sm">{children}</div>
    </div>
  );
}

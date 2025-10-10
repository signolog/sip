/**
 * Admin Layout Komponenti
 * Admin paneli için layout wrapper
 */

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">{children}</div>
    </div>
  );
}

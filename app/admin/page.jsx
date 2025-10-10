/**
 * Admin Panel Ana Sayfası
 * Basit admin paneli tasarımı
 */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminDashboard from "../../components/admin/AdminDashboard";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Auth kontrolü
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("admin_token");

      if (!token) {
        router.push("/admin/login");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setUser(data.user);
        } else {
          // Token geçersiz, login'e yönlendir
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_user");
          router.push("/admin/login");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // User yoksa (auth başarısız)
  if (!user) {
    return null; // Router zaten yönlendirdi
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />

        {/* Main Content */}
        <div className="flex-1 ml-64">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600">Sistema yönetim paneli</p>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {activeTab === "dashboard" && <AdminDashboard />}
              {activeTab === "users" && <div>Kullanıcı Yönetimi</div>}
              {activeTab === "locations" && <div>Lokasyon Yönetimi</div>}
              {activeTab === "analytics" && <div>Analitik</div>}
              {activeTab === "settings" && <div>Ayarlar</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

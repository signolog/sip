/**
 * Admin Sidebar Komponenti
 * Admin paneli için sidebar menü
 */

import Link from "next/link";
import { useState } from "react";

export default function AdminSidebar({ activeTab, setActiveTab, user }) {
  const [expandedMenus, setExpandedMenus] = useState({});

  const allMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊", type: "single" },
    {
      id: "management",
      label: "Yönetim",
      icon: "⚙️",
      type: "dropdown",
      children: [
        { id: "rooms", label: "Birim Yönetimi", icon: "🏠" },
        { id: "places", label: "Mekan Yönetimi", icon: "🏢" },
      ],
    },
    { id: "locations", label: "Kat Planları", icon: "📋", type: "single" },
    { id: "settings", label: "Ayarlar", icon: "⚙️", type: "single" },
  ];

  // Role-based menü filtreleme
  console.log(`🔍 AdminSidebar - User:`, user); // Debug
  console.log(`🔍 AdminSidebar - User role:`, user?.role); // Debug

  const toggleDropdown = (menuId) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  let menuItems;
  if (user?.role === "admin") {
    // Admin: Tüm menüler
    menuItems = allMenuItems;
  } else if (user?.role === "place_owner") {
    // Place Owner: Dashboard, Yönetim dropdown (sadece places), Haritalar
    menuItems = allMenuItems.filter((item) => {
      if (item.id === "dashboard" || item.id === "locations" || item.id === "settings") return true;
      if (item.id === "management") return true; // Yönetim dropdown'ını dahil et
      return false;
    });
  } else if (user?.role === "store_owner") {
    // Store Owner: Sadece Yönetim dropdown'ından rooms
    menuItems = allMenuItems.filter((item) => {
      if (item.id === "management") return true; // Yönetim dropdown'ını dahil et
      return false;
    });
  } else {
    // Default: Tüm menüler (loading state için)
    menuItems = allMenuItems;
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-gray-800 text-white shadow-lg">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-bold">Signolog Assist</h2>
        <p className="text-sm text-gray-400">Admin Panel</p>
        {user && (
          <div className="mt-3 p-2 bg-gray-700 rounded">
            <p className="text-xs text-gray-300">Giriş Yapan:</p>
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-gray-400">{user.role}</p>
          </div>
        )}
      </div>

      {/* Menu Items */}
      <nav className="mt-6">
        {menuItems.map((item) => {
          // Sayfa yollarını belirle
          const getHref = (id) => {
            switch (id) {
              case "dashboard":
                return "/admin";
              case "rooms":
                return "/admin/rooms";
              case "places":
                return "/admin/places";
              case "locations":
                return "/admin/locations";
              case "analytics":
                return "/admin/analytics";
              case "settings":
                return "/admin/settings";
              default:
                return "#";
            }
          };

          // Dropdown menü ise
          if (item.type === "dropdown") {
            const isExpanded = expandedMenus[item.id];
            const hasActiveChild = item.children?.some((child) => activeTab === child.id);

            return (
              <div key={item.id} className="mb-1">
                {/* Ana dropdown butonu */}
                <button
                  onClick={() => toggleDropdown(item.id)}
                  className={`w-full flex items-center justify-between px-6 py-3 text-left hover:bg-gray-700 transition-colors ${
                    hasActiveChild ? "bg-gray-700 border-r-4 border-blue-500" : ""
                  }`}
                >
                  <div className="flex items-center">
                    <span className="mr-3 text-lg">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                </button>

                {/* Alt menüler */}
                {isExpanded && (
                  <div className="bg-gray-900">
                    {item.children?.map((child) => {
                      // Store owner için sadece rooms göster
                      if (user?.role === "store_owner" && child.id !== "rooms") {
                        return null;
                      }
                      // Place owner için sadece places göster
                      if (user?.role === "place_owner" && child.id !== "places") {
                        return null;
                      }

                      return (
                        <Link
                          key={child.id}
                          href={getHref(child.id)}
                          onClick={() => setActiveTab(child.id)}
                          className={`w-full flex items-center px-8 py-2 text-left hover:bg-gray-700 transition-colors text-sm ${
                            activeTab === child.id ? "bg-gray-700 border-r-4 border-blue-500" : ""
                          }`}
                        >
                          <span className="mr-3 text-sm">{child.icon}</span>
                          <span className="font-medium">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Normal menü öğesi
          return (
            <Link
              key={item.id}
              href={getHref(item.id)}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-700 transition-colors ${
                activeTab === item.id ? "bg-gray-700 border-r-4 border-blue-500" : ""
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">{user?.username?.charAt(0)?.toUpperCase() || "A"}</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.username || "admin"}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("admin_token");
              localStorage.removeItem("admin_user");
              window.location.href = "/admin/login";
            }}
            className="text-gray-400 hover:text-white transition-colors"
            title="Çıkış Yap"
          >
            <span className="text-lg">🚪</span>
          </button>
        </div>
      </div>
    </div>
  );
}

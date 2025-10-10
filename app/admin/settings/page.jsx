"use client";

import { useState } from "react";
import AdminSidebar from "../../../components/admin/AdminSidebar.jsx";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState("settings");

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <div className="flex-1 ml-64">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Sistem Ayarları</h1>
              <p className="text-gray-600 mt-1">Sistem konfigürasyonunu yönetin</p>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⚙️</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Sistem Ayarları</h2>
                <p className="text-gray-500">Bu sayfa henüz geliştirilme aşamasında</p>
                <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Planlanan Özellikler:</strong>
                  </p>
                  <ul className="text-sm text-orange-700 mt-2 space-y-1">
                    <li>• Sistem genel ayarları</li>
                    <li>• API konfigürasyonu</li>
                    <li>• Veritabanı yedekleme</li>
                    <li>• Log yönetimi</li>
                    <li>• Güvenlik ayarları</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

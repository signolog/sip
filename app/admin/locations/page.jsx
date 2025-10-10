// haritalarını yuklendiği sayfa, işlenmesi beklenen

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "../../../components/admin/AdminSidebar.jsx";

export default function AdminLocationsPage() {
  const [activeTab, setActiveTab] = useState("locations");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState({});
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
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

  // Places yükle
  useEffect(() => {
    if (!user) return;

    const loadPlaces = async () => {
      try {
        const response = await fetch("/api/places");
        const data = await response.json();

        // Place owner ise sadece kendi place'ini göster
        if (user.role === "place_owner") {
          const filteredPlaces = { [user.place_id]: data[user.place_id] };
          setPlaces(filteredPlaces);
          setSelectedPlace(data[user.place_id]);
        } else {
          setPlaces(data);
        }
      } catch (error) {
        console.error("❌ Places yüklenemedi:", error);
      }
    };

    loadPlaces();
  }, [user]);

  // Dosya yükleme
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedPlace) return;

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("placeId", selectedPlace.id);
      formData.append("floor", event.target.dataset.floor);

      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/places/upload-floor", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage("✅ Kat planı başarıyla yüklendi!");
        setTimeout(() => setMessage(""), 3000);
        // Sayfayı yenile
        window.location.reload();
      } else {
        setMessage(`❌ Hata: ${data.error}`);
      }
    } catch (error) {
      console.error("Dosya yükleme hatası:", error);
      setMessage("❌ Dosya yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  // Kat dosyası silme
  const handleDeleteFloor = async (floor) => {
    if (!selectedPlace) return;

    const confirmDelete = window.confirm(
      `${floor < 0 ? `B${Math.abs(floor)}` : `K${floor}`} kat dosyasını silmek istediğinizden emin misiniz?`
    );

    if (!confirmDelete) return;

    setDeleting(true);
    setMessage("");

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/places/delete-floor?placeId=${selectedPlace.id}&floor=${floor}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setMessage("✅ Kat planı başarıyla silindi!");
        setTimeout(() => setMessage(""), 3000);
        // Sayfayı yenile
        window.location.reload();
      } else {
        setMessage(`❌ Hata: ${data.error}`);
      }
    } catch (error) {
      console.error("Dosya silme hatası:", error);
      setMessage("❌ Dosya silinemedi");
    } finally {
      setDeleting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // User yoksa null döndür
  if (!user) {
    return null;
  }

  // Store owner ise erişim reddet
  if (user.role === "store_owner") {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex">
          <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
          <div className="flex-1 ml-64 p-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Erişim Reddedildi!</strong>
              <span className="block sm:inline"> Birim sahipleri bu sayfaya erişemez.</span>
            </div>
          </div>
        </div>
      </div>
    );
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
              <h1 className="text-2xl font-bold text-gray-900">Kat Planları</h1>
              <p className="text-gray-600">
                {user.role === "admin"
                  ? "Mekan kat planlarını ve bilgi dosyalarını yönetin"
                  : `${user.placeName} kat plan yönetimi`}
              </p>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Place Selection (Admin için) */}
              {user.role === "admin" && (
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Mekan Seçin</h2>

                    <div className="space-y-3">
                      {Object.entries(places)
                        .filter(([, place]) => !!place)
                        .map(([id, place]) => (
                          <div
                            key={id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedPlace?.id === id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => setSelectedPlace(places[id])}
                          >
                            <h3 className="font-medium text-gray-900">{place?.name || "(İsimsiz)"}</h3>
                            <p className="text-sm text-gray-500">ID: {place?.id || id}</p>
                            <p className="text-sm text-gray-500">Katlar: {Object.keys(place?.floors || {}).length}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload Section */}
              <div className={user.role === "admin" ? "lg:col-span-3" : "lg:col-span-4"}>
                {selectedPlace ? (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{selectedPlace.name} - Kat Planları</h2>

                    {/* Mesaj */}
                    {message && (
                      <div
                        className={`p-3 rounded-md mb-4 ${
                          message.includes("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {message}
                      </div>
                    )}

                    {/* Mevcut Katlar */}
                    <div className="mb-6">
                      <h3 className="text-md font-medium text-gray-700 mb-3">Mevcut Kat Planları</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Bu dosyalar arkaplanda işlenip JSON'lara entegre edilecektir. Harita entegrasyonu değil, mekan
                        yönetimi için kat planları ve bilgi dosyalarıdır.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.keys(selectedPlace.floor_photos || {}).length === 0 ? (
                          <div className="col-span-full text-center py-8">
                            <div className="text-gray-400 text-4xl mb-2">📋</div>
                            <p className="text-gray-500">Henüz kat planı yüklenmemiş</p>
                            <p className="text-sm text-gray-400">Aşağıdan yeni kat planı yükleyebilirsiniz</p>
                          </div>
                        ) : (
                          Object.entries(selectedPlace.floor_photos || {}).map(([floor, filePath]) => (
                            <div key={floor} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900">
                                  {floor < 0 ? `B${Math.abs(floor)}` : `K${floor}`}
                                </h4>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Mevcut</span>
                                  <button
                                    onClick={() => handleDeleteFloor(floor)}
                                    disabled={deleting}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                                  >
                                    {deleting ? "Siliniyor..." : "Sil"}
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-500 mb-3">
                                {filePath}
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  Kat Planı
                                </span>
                              </p>
                              <input
                                type="file"
                                accept=".geojson,.json,.svg,.png,.jpg,.jpeg,.gif,.webp"
                                onChange={handleFileUpload}
                                data-floor={floor}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                disabled={uploading}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Yeni Kat Ekleme */}
                    <div className="border-t pt-6">
                      <h3 className="text-md font-medium text-gray-700 mb-3">Yeni Kat Planı Yükle</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Desteklenen formatlar: Fotoğraflar (PNG, JPG, JPEG, GIF, WEBP), Vektör dosyaları (SVG), JSON
                        dosyaları
                      </p>
                      <div className="flex items-center space-x-4">
                        <select
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          id="newFloorSelect"
                        >
                          <option value="">Kat Seçin</option>
                          {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((floor) => (
                            <option key={floor} value={floor}>
                              {floor < 0 ? `B${Math.abs(floor)}` : `K${floor}`}
                            </option>
                          ))}
                        </select>
                        <input
                          type="file"
                          accept=".geojson,.json,.svg,.png,.jpg,.jpeg,.gif,.webp"
                          onChange={(e) => {
                            const floor = document.getElementById("newFloorSelect").value;
                            if (floor) {
                              e.target.dataset.floor = floor;
                              handleFileUpload(e);
                            } else {
                              setMessage("❌ Lütfen önce kat seçin");
                            }
                          }}
                          className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          disabled={uploading}
                        />
                      </div>
                    </div>

                    {/* Yükleme Durumu */}
                    {uploading && (
                      <div className="mt-4 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        <span className="ml-2 text-gray-600">Dosya yükleniyor...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-6xl mb-4">📍</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {user.role === "admin" ? "Mekan Seçin" : "Mekan Bulunamadı"}
                      </h3>
                      <p className="text-gray-500">
                        {user.role === "admin"
                          ? "Kat plan yönetimi için sol taraftan bir mekan seçin"
                          : "Bu mekan için bilgi bulunamadı"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

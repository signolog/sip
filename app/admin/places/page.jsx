// master admin tum mekanlara erişiyor. 
// place_owner kendi mekanina erişiyor. 
// mekan yonetimi sayfası


"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "../../../components/admin/AdminSidebar";
import PlaceContentManager from "../../../components/admin/PlaceContentManager";

export default function AdminPlacesPage() {
  const [activeTab, setActiveTab] = useState("places");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState({});
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [editingPlace, setEditingPlace] = useState(null);
  const [activeSection, setActiveSection] = useState(user?.role === "admin" ? "basic" : "content"); // "basic" veya "content"
  const [saving, setSaving] = useState(false);
  const [updatingSlug, setUpdatingSlug] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const router = useRouter();

  // Slug otomatik güncelleme fonksiyonu
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  };

  // İsim değiştiğinde slug'ı otomatik güncelle
  const handleNameChange = (newName) => {
    const newSlug = generateSlug(newName);
    setEditingPlace({
      ...editingPlace,
      name: newName,
      slug: newSlug,
    });
  };

  // Slug güncelleme API çağrısı
  const updateSlug = async () => {
    if (!editingPlace || !selectedPlace) return;

    // Eğer isim ve slug değişmemişse işlem yapma
    if (editingPlace.name === selectedPlace.name && editingPlace.slug === selectedPlace.slug) {
      return;
    }

    setUpdatingSlug(true);
    setSaveMessage("");

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/places/update-slug", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          newName: editingPlace.name,
          newSlug: editingPlace.slug,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveMessage("✅ Kaydedildi!");
        // Sayfayı üst tarafa yönlendir
        window.scrollTo(0, 0);
        setTimeout(() => {
          setSaveMessage("");
          // Sayfayı yenile
          window.location.reload();
        }, 2000);
      } else {
        setSaveMessage("❌ Kaydedilmedi");
        // Sayfayı üst tarafa yönlendir
        window.scrollTo(0, 0);
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } catch (error) {
      console.error("Slug güncelleme hatası:", error);
      setSaveMessage("❌ Kaydedilmedi");
      // Sayfayı üst tarafa yönlendir
      window.scrollTo(0, 0);
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setUpdatingSlug(false);
    }
  };

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
        console.log("🔄 Places yükleniyor...");
        const response = await fetch("/api/places");
        const data = await response.json();
        console.log("📡 Places API response:", data);

        // Place owner ise sadece kendi place'ini göster
        if (user.role === "place_owner") {
          console.log("👤 Place owner, filtering places for:", user.place_id);
          const filteredPlaces = { [user.place_id]: data[user.place_id] };
          console.log("🏢 Filtered places:", filteredPlaces);
          setPlaces(filteredPlaces);
          setSelectedPlace(data[user.place_id]);
        } else {
          console.log("👑 Admin, showing all places");
          setPlaces(data);
        }
      } catch (error) {
        console.error("❌ Places yüklenemedi:", error);
      }
    };

    loadPlaces();
  }, [user]);

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
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-6 py-8 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Mekan Yönetimi</h3>
                  <p className="text-blue-700 mb-4">
                    Birim sahipleri mekan yönetimi sayfasına erişemez. Bu sayfa sadece mekan sahipleri ve adminler
                    içindir.
                  </p>
                  <div className="bg-blue-100 rounded-md p-4 mb-4">
                    <h4 className="font-medium text-blue-800 mb-2">Birim sahipleri için:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>
                        • <strong>Birim Yönetimi</strong> sayfasından kendi birimlerini yönetebilirsiniz
                      </li>
                      <li>• Birim bilgilerini güncelleyebilirsiniz</li>
                      <li>• Logo ve header görsellerini yükleyebilirsiniz</li>
                      <li>• İletişim bilgilerini düzenleyebilirsiniz</li>
                    </ul>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => (window.location.href = "/admin/rooms")}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Birim Yönetimine Git
                    </button>
                    <button
                      onClick={() => (window.location.href = "/admin")}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Ana Sayfaya Dön
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handlePlaceSelect = (placeId) => {
    const place = places[placeId];
    console.log("🏢 Place seçildi:", place);
    setSelectedPlace(place);
    setEditingPlace(null);
    setActiveSection("basic");
  };

  const handleEditPlace = (place) => {
    setEditingPlace({ ...place });
    setActiveSection("basic");
  };

  const handleSavePlace = async () => {
    // TODO: API endpoint'i ile place güncelleme
    console.log("💾 Place kaydediliyor:", editingPlace);
    // Şimdilik sadece state güncelle
    setPlaces((prev) => ({
      ...prev,
      [editingPlace.id]: editingPlace,
    }));
    setEditingPlace(null);
    setSelectedPlace(editingPlace);
  };

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
              <h1 className="text-2xl font-bold text-gray-900">Mekan Yönetimi</h1>
              <p className="text-gray-600">
                {user.role === "admin" ? "Tüm mekanları yönetin" : `${user.placeName} yönetimi`}
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
                            onClick={() => handlePlaceSelect(id)}
                          >
                            <h3 className="font-medium text-gray-900">{place?.name || "(İsimsiz)"}</h3>
                            <p className="text-sm text-gray-500">ID: {place?.id || id}</p>
                            {user.role === "admin" && (
                              <p className="text-sm text-gray-500">
                                Durum:{" "}
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    place?.status === "published"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {place?.status === "published" ? "Yayında" : "Taslak"}
                                </span>
                              </p>
                            )}
                            <p className="text-sm text-gray-500">Katlar: {Object.keys(place?.floors || {}).length}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Place Management */}
              <div className={user.role === "admin" ? "lg:col-span-3" : "lg:col-span-4"}>
                {selectedPlace ? (
                  <div className="bg-white rounded-lg shadow-sm">
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200">
                      <nav className="flex space-x-8 px-6">
                        {user.role === "admin" && (
                          <button
                            onClick={() => setActiveSection("basic")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                              activeSection === "basic"
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                          >
                            Temel Bilgiler
                          </button>
                        )}
                        <button
                          onClick={() => setActiveSection("content")}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeSection === "content"
                              ? "border-blue-500 text-blue-600"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          İçerik Yönetimi
                        </button>
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      {activeSection === "basic" && user.role === "admin" ? (
                        /* Basic Info Tab - Sadece Admin */
                        editingPlace ? (
                          /* Edit Form */
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mekan Düzenle</h2>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mekan Adı</label>
                                <input
                                  type="text"
                                  value={editingPlace.name}
                                  onChange={(e) => handleNameChange(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                                <input
                                  type="text"
                                  value={editingPlace.slug}
                                  readOnly
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 text-blue-700 cursor-not-allowed"
                                  title="Slug otomatik oluşturulur - isim değiştiğinde güncellenir"
                                />
                              </div>

                              {/* Durum - Admin düzenleyebilir, Place Owner sadece görür */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                                {user.role === "admin" ? (
                                  <select
                                    value={editingPlace.status}
                                    onChange={(e) =>
                                      setEditingPlace({
                                        ...editingPlace,
                                        status: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="draft">Taslak</option>
                                    <option value="published">Yayında</option>
                                  </select>
                                ) : (
                                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${
                                        editingPlace.status === "published"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-yellow-100 text-yellow-800"
                                      }`}
                                    >
                                      {editingPlace.status === "published" ? "Yayında" : "Taslak"}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500">(Sadece admin değiştirebilir)</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex space-x-3">
                                <button
                                  onClick={updateSlug}
                                  disabled={updatingSlug}
                                  className={`px-6 py-3 text-white rounded-lg font-medium disabled:opacity-50 transition-all duration-300 ${
                                    saveMessage === "✅ Kaydedildi!"
                                      ? "bg-green-600 scale-105"
                                      : saveMessage === "❌ Kaydedilmedi"
                                      ? "bg-red-500 scale-105"
                                      : "bg-green-500 hover:bg-green-600"
                                  }`}
                                >
                                  {saveMessage || (updatingSlug ? "Güncelleniyor..." : "Kaydet")}
                                </button>
                                <button
                                  onClick={() => setEditingPlace(null)}
                                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                  İptal
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Place Details */
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <h2 className="text-lg font-semibold text-gray-900">Mekan Detayları</h2>
                              <button
                                onClick={() => handleEditPlace(selectedPlace)}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                Düzenle
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <span className="font-medium text-gray-700">Adı:</span>
                                <span className="ml-2 text-gray-900">{selectedPlace.name}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">ID:</span>
                                <span className="ml-2 text-gray-900">{selectedPlace.id}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Slug:</span>
                                <span className="ml-2 text-gray-900">{selectedPlace.slug}</span>
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Otomatik
                                </span>
                              </div>
                              {user.role === "admin" && (
                                <div>
                                  <span className="font-medium text-gray-700">Durum:</span>
                                  <span
                                    className={`ml-2 px-2 py-1 rounded text-xs ${
                                      selectedPlace.status === "published"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}
                                  >
                                    {selectedPlace.status === "published" ? "Yayında" : "Taslak"}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-700">Koordinatlar:</span>
                                <span className="ml-2 text-gray-900">[{selectedPlace.center?.join(", ")}]</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Zoom:</span>
                                <span className="ml-2 text-gray-900">{selectedPlace.zoom}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Katlar:</span>
                                <span className="ml-2 text-gray-900">
                                  {Object.keys(selectedPlace.floors || {}).length} kat
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        /* Content Management Tab */
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            {selectedPlace.name} İçerik Yönetimi
                          </h2>
                          <PlaceContentManager placeId={selectedPlace.id} user={user} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-6xl mb-4">🏢</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {user.role === "admin" ? "Mekan Seçin" : "Mekan Bulunamadı"}
                      </h3>
                      <p className="text-gray-500">
                        {user.role === "admin"
                          ? "Yönetim için sol taraftan bir mekan seçin"
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

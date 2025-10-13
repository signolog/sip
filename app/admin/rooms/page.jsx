//admin tüm birimleri görüyor.
//store_owner kendi birimini görüyor.
//birim yonetimi sayfası

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminProvider, useAdmin } from "../../../contexts/AdminContext";
import AdminLayout from "../../../components/admin/AdminLayout";
import RoomUpdateForm from "../../../components/admin/RoomUpdateForm.jsx";

function RoomsPageContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]);

  // Arama state'leri
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { selectedPlace, selectedFloor } = useAdmin();

  // ============ AUTH ============
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
          headers: { "Content-Type": "application/json" },
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
        console.error("Auth error:", error);
        router.push("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // ============ ADMIN/PLACE OWNER: Tüm Roomları Yükle (Arama için) ============
  useEffect(() => {
    if (!user || user.role === "store_owner") return;
    if (!selectedPlace) return;

    const loadAllRooms = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch(`/api/admin/rooms?placeId=${selectedPlace.id}&floor=all`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        const roomsData = Array.isArray(data) ? data : data.rooms || [];
        setAllRooms(roomsData);
      } catch (error) {
        console.error("All rooms yüklenemedi:", error);
        setAllRooms([]);
      }
    };

    loadAllRooms();
  }, [user, selectedPlace]);

  // ============ STORE OWNER: Kendi Birimini Yükle ============
  useEffect(() => {
    if (!user || user.role !== "store_owner") return;

    const loadStoreOwnerRoom = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch(`/api/admin/rooms?placeId=${user.place_id}&floor=all`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        const allRooms = Array.isArray(data) ? data : data.rooms || [];

        // Store owner'a ait room'u filtrele
        const storeRoom = allRooms.find((room) => room.room_id === user.store_id);

        if (storeRoom) {
          setRooms([storeRoom]);
        } else {
          console.error("Store room bulunamadı");
          setRooms([]);
        }
      } catch (error) {
        console.error("Store room yüklenemedi:", error);
        setRooms([]);
      }
    };

    loadStoreOwnerRoom();
  }, [user]);

  // ============ ADMIN/PLACE OWNER: Seçilen Kata Göre Roomları Yükle ============
  useEffect(() => {
    if (!user || user.role === "store_owner") return;
    if (!selectedPlace || selectedFloor === null) {
      setRooms([]);
      return;
    }

    const loadRooms = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch(`/api/admin/rooms?placeId=${selectedPlace.id}&floor=${selectedFloor}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        const roomsData = Array.isArray(data) ? data : data.rooms || [];
        setRooms(roomsData);
      } catch (error) {
        console.error("Rooms yüklenemedi:", error);
        setRooms([]);
      }
    };

    loadRooms();
  }, [user, selectedPlace, selectedFloor]);

  // ============ ARAMA FONKSİYONLARI ============
  const handleSearch = (query) => {
    setSearchQuery(query);
    setShowSearchResults(query.length > 0);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const filtered = allRooms.filter((room) => room.name?.toLowerCase().includes(query.toLowerCase()));
    setSearchResults(filtered.slice(0, 8));
  };

  const handleSearchResultSelect = (room) => {
    setRooms([room]);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Click outside handler for search results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchResults) {
        // Hem header'daki input hem de page'deki search-container'ı kontrol et
        const isClickInsideSearch =
          event.target.closest(".search-container") || event.target.closest("input[placeholder='Birim ara...']");

        if (!isClickInsideSearch) {
          setShowSearchResults(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearchResults]);

  // ============ ROOM GÜNCELLEME ============
  const handleRoomUpdate = async (roomData) => {
    try {
      const token = localStorage.getItem("admin_token");
      const payload = {
        room_id: roomData.id,
        place_id: user.role === "store_owner" ? user.place_id : selectedPlace?.id,
        floor: roomData.floor ?? selectedFloor,
        ...roomData,
      };

      const response = await fetch("/api/admin/rooms/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        // Başarılı güncelleme sonrası reload
        if (user.role === "store_owner") {
          // Store owner için kendi birimini yeniden yükle
          const storeRoom = rooms[0];
          if (storeRoom) {
            const updatedRooms = rooms.map((r) => (r.room_id === roomData.id ? { ...r, ...roomData } : r));
            setRooms(updatedRooms);
          }
        } else {
          // Admin/place owner için seçili katı yeniden yükle
          const token = localStorage.getItem("admin_token");
          const response = await fetch(`/api/admin/rooms?placeId=${selectedPlace.id}&floor=${selectedFloor}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          const data = await response.json();
          setRooms(Array.isArray(data) ? data : data.rooms || []);
        }
      }
    } catch (error) {
      console.error("Güncelleme hatası:", error);
    }
  };

  // ============ LOADING ============
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

  if (!user) return null;

  // ============ STORE OWNER GÖRÜNÜMÜ (Tam Ekran Form) ============
  if (user.role === "store_owner") {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex">
          <div className="flex-1">
            <div className="p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Birim Yönetimi</h1>
                <p className="text-gray-600">Birim bilgilerinizi güncelleyin</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                {rooms.length > 0 ? (
                  <RoomUpdateForm
                    rooms={rooms}
                    placeId={user.place_id}
                    floor={rooms[0]?.floor}
                    onRoomUpdate={handleRoomUpdate}
                    singleRoomMode={true}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">Birim bilgileri yükleniyor...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ ADMIN/PLACE OWNER GÖRÜNÜMÜ (Layout ile) ============
  return (
    <AdminLayout title="Birim Yönetimi" description="Birim bilgilerini güncelleyin">
      <div className="space-y-6">
        {/* Birim Arama ve Listesi - Sadece Kat Seçili veya "Tüm Katlarda Ara" Aktif */}
        {selectedPlace && selectedFloor !== null && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Kat {selectedFloor} - Birimler</h2>
              <div className="text-sm text-gray-600">
                {allRooms.filter((r) => r.floor == selectedFloor).length} birim
              </div>
            </div>

            {/* Arama Kutusu - Sadece Bu Kat */}
            <div className="relative mb-4 search-container">
              <input
                type="text"
                placeholder="Bu katta ara..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowSearchResults(true)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Autocomplete Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => handleSearchResultSelect(room)}
                      className="px-4 py-2 cursor-pointer hover:bg-blue-50 border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{room.name}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Kat {room.floor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Birim Listesi - Kat bazında veya tüm katlar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
              {(searchQuery
                ? searchResults
                : selectedFloor !== null
                ? allRooms.filter((r) => r.floor == selectedFloor)
                : allRooms
              ).map((room) => (
                <div
                  key={room.id}
                  onClick={() => setRooms([room])}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    rooms.length === 1 && rooms[0].room_id === room.room_id
                      ? "bg-blue-50 border-blue-500"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm">{room.name}</div>
                    <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">Kat {room.floor}</span>
                  </div>
                  <div className="text-xs text-gray-500">ID: {room.room_id}</div>
                  {room.content?.category && (
                    <div className="text-xs text-blue-600 mt-1">
                      {room.content.category === "store" && "Mağaza"}
                      {room.content.category === "restaurant" && "Restoran"}
                      {room.content.category === "cafe" && "Kafe"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {searchQuery && searchResults.length === 0 && (
              <div className="text-center py-4 text-gray-500">Birim bulunamadı</div>
            )}
          </div>
        )}

        {/* Form Paneli - TAM GENİŞLİK */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {rooms.length > 0 ? (
            <RoomUpdateForm
              rooms={rooms}
              placeId={selectedPlace?.id}
              floor={selectedFloor}
              onRoomUpdate={handleRoomUpdate}
              singleRoomMode={true}
            />
          ) : (
            <div className="text-center py-20">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Birim Seçin</h3>
              <p className="mt-2 text-sm text-gray-500">
                {selectedPlace && selectedFloor !== null
                  ? "Yukarıdaki listeden bir birim seçin"
                  : "Başlamak için üst kısımdan bir mekan ve kat seçin"}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default function AdminRoomsPage() {
  return (
    <AdminProvider>
      <RoomsPageContent />
    </AdminProvider>
  );
}

//admin tüm birimleri görüyor.
//store_owner kendi birimini görüyor.
//birim yonetimi sayfası
//place_owner yetkili değil

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "../../../components/admin/AdminSidebar.jsx";
import RoomUpdateForm from "../../../components/admin/RoomUpdateForm.jsx";

export default function AdminRoomsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Seçim state'leri
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [places, setPlaces] = useState({});

  // Oda state'leri
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]);

  // Arama state'leri
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

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

  // ============ PLACES YÜKLEME ============
  useEffect(() => {
    if (!user) return;

    const loadPlaces = async () => {
      try {
        const response = await fetch("/api/places");
        if (response.ok) {
          const data = await response.json();
          setPlaces(data);

          // Store Owner için otomatik place seçimi
          if (user.role === "store_owner" && user.place_id) {
            const placeInfo = data[user.place_id];
            if (placeInfo) {
              setSelectedPlace({ ...placeInfo, id: user.place_id });
              // Store owner için room'ları yükle
              await loadStoreOwnerRooms(user.place_id);
            }
          }
        }
      } catch (error) {
        console.error("Places yüklenemedi:", error);
      }
    };

    loadPlaces();
  }, [user]);

  // ============ STORE OWNER ROOM YÜKLEME ============
  const loadStoreOwnerRooms = async (placeId) => {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/rooms?placeId=${placeId}&floor=all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      if (response.ok && data.length > 0) {
        // Store owner'ın room'unu bul
        const userRoom = data.find((room) => room.room_id === user.store_id);
        if (userRoom) {
          setSelectedFloor(userRoom.floor);
          setRooms([userRoom]);
        }
      }
    } catch (error) {
      console.error("Store owner room yükleme hatası:", error);
    }
  };

  // ============ TÜM ODALARI YÜKLEME ============
  useEffect(() => {
    if (selectedPlace && selectedPlace.floors && user.role !== "store_owner") {
      loadAllRooms();
    }
  }, [selectedPlace]);

  const loadAllRooms = async () => {
    if (!selectedPlace?.id || !selectedPlace?.floors) return;

    try {
      const allRoomsData = [];
      const token = localStorage.getItem("admin_token");

      for (const floorKey of Object.keys(selectedPlace.floors)) {
        const response = await fetch(`/api/admin/rooms?placeId=${selectedPlace.id}&floor=${floorKey}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        const floorRooms = Array.isArray(data) ? data : data.rooms || [];

        allRoomsData.push(
          ...floorRooms.map((room) => ({
            ...room,
            floor: parseInt(floorKey),
          }))
        );
      }

      setAllRooms(allRoomsData);
    } catch (error) {
      console.error("Tüm odalar yüklenemedi:", error);
    }
  };

  // ============ PLACE SEÇİMİ ============
  const handlePlaceSelect = async (placeId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/places?id=${placeId}`);
      const data = await response.json();

      setSelectedPlace({ ...data, id: placeId });
      setSelectedFloor(null);
      setRooms([]);
      setSearchQuery("");
    } catch (error) {
      console.error("Place yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  // ============ KAT SEÇİMİ ============
  const handleFloorSelect = async (floor) => {
    if (!selectedPlace) return;

    setLoading(true);
    setSearchQuery(""); // Aramayı temizle

    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch(`/api/admin/rooms?placeId=${selectedPlace.id}&floor=${floor}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      const rooms = Array.isArray(data) ? data : data.rooms || [];

      setSelectedFloor(floor);
      setRooms(rooms);
    } catch (error) {
      console.error("Katlar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  // ============ ARAMA ============
  const handleSearch = (query) => {
    setSearchQuery(query);
    setShowSearchResults(query.length > 0);

    if (!query.trim()) {
      setSearchResults([]);
      setRooms([]);
      return;
    }

    const filtered = allRooms.filter((room) => room.name?.toLowerCase().includes(query.toLowerCase()));

    setSearchResults(filtered.slice(0, 8));
    setRooms(filtered);
  };

  const handleSearchResultSelect = (room) => {
    setSelectedFloor(room.floor);
    setRooms([room]);
    setSearchQuery(room.name);
    setShowSearchResults(false);
  };

  // ============ ODA GÜNCELLEME ============
  const handleRoomUpdate = async (roomData) => {
    try {
      const token = localStorage.getItem("admin_token");
      const payload = {
        room_id: roomData.id,
        place_id: selectedPlace?.id,
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
        // KRITIK: State'i hemen güncelle
        if (user.role === "store_owner") {
          // Store owner için birim bilgilerini yeniden yükle
          await refreshStoreInfo();
        } else {
          // Admin/Place owner için mevcut görünümü yenile
          if (searchQuery.trim()) {
            await loadAllRooms();
          } else if (selectedFloor !== null) {
            await handleFloorSelect(selectedFloor);
          }
        }
      }
    } catch (error) {
      console.error("Güncelleme hatası:", error);
    }
  };

  // Store owner için bilgileri yenile
  const refreshStoreInfo = async () => {
    if (user.role !== "store_owner") return;

    try {
      await loadStoreOwnerRooms(user.place_id);
    } catch (error) {
      console.error("Birim refresh hatası:", error);
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchResults && !event.target.closest(".search-container")) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearchResults]);

  // ============ RENDER ============
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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        <AdminSidebar activeTab="rooms" setActiveTab={() => {}} user={user} />

        <div className="flex-1 ml-64">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Birim Yönetimi</h1>
              <p className="text-gray-600">Birim bilgilerini güncelleyin</p>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {user.role === "store_owner" ? (
                // ========== STORE OWNER GÖRÜNÜMÜ ==========
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-800 mb-2">Birim Bilgileri</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                      <div>
                        <strong>Mekan:</strong> {selectedPlace?.name || "-"}
                      </div>
                      <div>
                        <strong>Mekan ID:</strong> {selectedPlace?.id || "-"}
                      </div>
                      <div>
                        <strong>Kat:</strong> {selectedFloor !== null ? `Kat ${selectedFloor}` : "-"}
                      </div>
                      <div>
                        <strong>Birim:</strong> {rooms[0]?.name || "-"}
                      </div>
                      <div>
                        <strong>Birim ID:</strong> {rooms[0]?.originalId || rooms[0]?.room_id || "-"}
                      </div>
                    </div>
                  </div>

                  {rooms.length > 0 ? (
                    <RoomUpdateForm
                      rooms={rooms}
                      placeId={selectedPlace?.id}
                      floor={selectedFloor}
                      onRoomUpdate={handleRoomUpdate}
                      singleRoomMode={true}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">Birim bilgileri yükleniyor...</div>
                  )}
                </div>
              ) : (
                // ========== ADMIN/PLACE OWNER GÖRÜNÜMÜ ==========
                <>
                  {/* Seçim Paneli */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Mekan ve Kat Seçimi</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Mekan Seçimi */}
                      {user.role === "admin" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Mekan</label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedPlace?.id || ""}
                            onChange={(e) => handlePlaceSelect(e.target.value)}
                          >
                            <option value="">Mekan seçin...</option>
                            {Object.entries(places).map(([id, place]) => (
                              <option key={id} value={id}>
                                {place.name || place.place || id}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Arama ve Kat Seçimi */}
                      {selectedPlace && (
                        <div className="lg:col-span-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Global Arama */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Birim Ara</label>
                              <div className="relative search-container">
                                <input
                                  type="text"
                                  placeholder="Birim adı yazın..."
                                  value={searchQuery}
                                  onChange={(e) => handleSearch(e.target.value)}
                                  onFocus={() => setShowSearchResults(searchQuery.length > 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                                {/* Autocomplete */}
                                {showSearchResults && searchResults.length > 0 && (
                                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {searchResults.map((room) => (
                                      <div
                                        key={room.id}
                                        onClick={() => handleSearchResultSelect(room)}
                                        className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b last:border-b-0"
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="font-medium">{room.name}</span>
                                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                            Kat {room.floor}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {searchQuery && (
                                <p className="text-xs text-gray-500 mt-1">{rooms.length} birim bulundu</p>
                              )}
                            </div>

                            {/* Kat Seçimi */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Kat</label>
                              <div className="grid grid-cols-3 gap-2">
                                {Object.keys(selectedPlace.floors || {}).map((floor) => (
                                  <button
                                    key={floor}
                                    onClick={() => handleFloorSelect(floor)}
                                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                                      selectedFloor === floor
                                        ? "bg-blue-500 text-white border-blue-500"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                    }`}
                                  >
                                    Kat {floor}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bilgi */}
                    {selectedPlace && rooms.length > 0 && (
                      <div className="mt-4 bg-gray-50 rounded-md p-3">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">{rooms.length}</span> birim
                          {searchQuery && " (Arama sonucu)"}
                          {selectedFloor !== null && !searchQuery && ` (Kat ${selectedFloor})`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Form Paneli */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    {rooms.length > 0 ? (
                      <RoomUpdateForm
                        rooms={rooms}
                        placeId={selectedPlace?.id}
                        floor={selectedFloor}
                        onRoomUpdate={handleRoomUpdate}
                        singleRoomMode={false}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Kat Seçin veya Birim Arayın</h3>
                        <p className="mt-1 text-sm text-gray-500">Başlamak için bir kat seçin veya birim arayın</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

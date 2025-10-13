"use client";
import { createContext, useContext, useState, useEffect } from "react";

const AdminContext = createContext();

export function AdminProvider({ children }) {
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [places, setPlaces] = useState({});
  const [user, setUser] = useState(null);

  // User bilgisini al
  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) return;

      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        if (response.ok) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("User check error:", error);
      }
    };

    checkUser();
  }, []);

  // Places'leri yükle ve place_owner için otomatik seçim
  useEffect(() => {
    if (!user) return;

    const loadPlaces = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const response = await fetch("/api/places", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        console.log("🔍 AdminContext - Places API response:", data);

        if (response.ok) {
          // API'den gelen data zaten object formatında
          // { "place_id": { id, name, floors, ... } }
          setPlaces(data);
          console.log("🔍 AdminContext - Places count:", Object.keys(data).length);

          // Place owner için otomatik mekan seçimi
          if (user.role === "place_owner" && user.place_id) {
            const placeInfo = data[user.place_id];
            if (placeInfo) {
              setSelectedPlace({ ...placeInfo, id: user.place_id });
              console.log("🔍 AdminContext - Place owner auto-selected:", placeInfo.name);
            }
          }
        }
      } catch (error) {
        console.error("Places yüklenemedi:", error);
      }
    };

    loadPlaces();
  }, [user]);

  const selectPlace = (placeId) => {
    const place = places[placeId];
    if (place) {
      setSelectedPlace({ ...place, id: placeId });
      setSelectedFloor(null); // Mekan değişince kat seçimini sıfırla
    }
  };

  const selectFloor = (floor) => {
    setSelectedFloor(floor);
  };

  return (
    <AdminContext.Provider
      value={{
        selectedPlace,
        selectedFloor,
        places,
        selectPlace,
        selectFloor,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
}

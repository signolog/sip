"use client";
import { useAdmin } from "../../contexts/AdminContext";

export default function AdminSelectionPanel({ user }) {
  const { selectedPlace, selectedFloor, places, selectPlace, selectFloor } = useAdmin();

  // Place owner ise sadece kendi mekanını göster
  const availablePlaces =
    user.role === "place_owner"
      ? Object.entries(places).filter(([id]) => id === user.place_id)
      : Object.entries(places);

  return (
    <div className="flex items-center gap-4">
      {/* Mekan Seçimi - Sadece admin için */}
      {user.role === "admin" && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Mekan:</label>
          <select
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
            value={selectedPlace?.id || ""}
            onChange={(e) => selectPlace(e.target.value)}
          >
            <option value="">Mekan seçin...</option>
            {availablePlaces.map(([id, place]) => (
              <option key={id} value={id}>
                {place.name || place.place || id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Place Owner - Mekan Bilgisi (Read-only) */}
      {user.role === "place_owner" && selectedPlace && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Mekan:</label>
          <div className="text-sm text-gray-800 font-medium bg-gray-50 px-3 py-1.5 rounded-md border border-gray-300">
            {selectedPlace.name}
          </div>
        </div>
      )}

      {/* Kat Seçimi */}
      {selectedPlace && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Kat:</label>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {Object.keys(selectedPlace.floors || {}).map((floor) => (
                <button
                  key={floor}
                  onClick={() => selectFloor(floor)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
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
      )}
    </div>
  );
}

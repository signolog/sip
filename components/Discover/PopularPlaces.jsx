// components/Discover/PopularPlaces.jsx
'use client';

import { useState } from 'react';

export default function PopularPlaces({ rooms, onRoomSelect }) {
  const [popularPlacesIndex, setPopularPlacesIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Popüler yerleri filtrele (logo'su olanlar)
  const popularRooms = rooms.filter(r => r.logo);

  const handleTouchStart = e => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = e => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && popularPlacesIndex < popularRooms.length - 1) {
      setPopularPlacesIndex(popularPlacesIndex + 1);
    }
    if (isRightSwipe && popularPlacesIndex > 0) {
      setPopularPlacesIndex(popularPlacesIndex - 1);
    }
  };

  if (popularRooms.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">
        Popüler yer bulunamadı
      </div>
    );
  }

  const prevIndex = popularPlacesIndex > 0 ? popularPlacesIndex - 1 : null;
  const currentIndex = popularPlacesIndex;
  const nextIndex =
    popularPlacesIndex < popularRooms.length - 1
      ? popularPlacesIndex + 1
      : null;

  const renderCard = (room, isCenter, index) => (
    <div
      key={room.id}
      onClick={() => {
        if (!isCenter) {
          setPopularPlacesIndex(index);
        }
      }}
      className={`bg-white rounded-lg border border-gray-200 flex-shrink-0 transition-all duration-500 ease-out ${
        isCenter
          ? 'w-[55%] h-full p-3 shadow-md'
          : 'w-[22%] h-[85%] p-2 shadow-sm cursor-pointer hover:opacity-80'
      }`}
    >
      <div
        className={`h-full flex flex-col overflow-hidden transition-opacity duration-500 ${
          isCenter ? 'opacity-100' : 'opacity-40'
        }`}
      >
        {/* Üst Kısım: Logo ve Bilgiler */}
        <div className={`flex gap-2 ${isCenter ? 'mb-2' : 'mb-1'}`}>
          {/* Logo */}
          <img
            src={room.logo}
            alt={room.name}
            className={`flex-shrink-0 object-contain rounded-lg border border-gray-200 bg-white transition-all duration-500 ${
              isCenter ? 'h-12 w-12 p-1.5' : 'h-8 w-8 p-1'
            }`}
          />

          {/* Bilgiler */}
          <div className="flex-1 min-w-0">
            <h4
              className={`font-bold text-gray-800 mb-0.5 truncate transition-all duration-500 ${
                isCenter ? 'text-xs' : 'text-[9px]'
              }`}
            >
              {room.name}
            </h4>
            <p
              className={`text-gray-600 whitespace-nowrap transition-all duration-500 ${
                isCenter ? 'text-[10px]' : 'text-[8px]'
              }`}
            >
              {room.openingHours || '10:00 - 22:00'}
            </p>
          </div>
        </div>

        {/* Kategori ve Etiketler */}
        <div
          className={`flex items-center gap-1.5 mb-2 flex-wrap transition-all duration-500 ${
            isCenter ? 'opacity-100' : 'opacity-60'
          }`}
        >
          <span
            className={`bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium transition-all duration-500 ${
              isCenter ? 'text-[10px]' : 'text-[7px]'
            }`}
          >
            {room.category || 'Mağaza'}
          </span>
          {room.tags &&
          (Array.isArray(room.tags)
            ? room.tags.length > 0
            : room.tags.trim() !== '') ? (
            (Array.isArray(room.tags)
              ? room.tags
              : room.tags.split(',').map(t => t.trim())
            )
              .slice(0, 1)
              .map((tag, idx) => (
                <span
                  key={idx}
                  className={`bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full transition-all duration-500 ${
                    isCenter ? 'text-[10px]' : 'text-[7px]'
                  }`}
                >
                  {tag}
                </span>
              ))
          ) : (
            <span
              className={`bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full transition-all duration-500 ${
                isCenter ? 'text-[10px]' : 'text-[7px]'
              }`}
            >
              Kat {room.floor}
            </span>
          )}
        </div>

        {/* Yol Tarif Butonu - Sadece ortadaki kartta */}
        {isCenter && (
          <button
            onClick={() => onRoomSelect(room)}
            className="mt-auto w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-xs py-1.5 px-3"
          >
            Yol Tarifi Al
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Popüler Yerler
      </h3>
      <div className="relative flex items-center gap-1">
        {/* Sol Ok */}
        <button
          className="flex-shrink-0 bg-white hover:bg-gray-50 rounded-full p-1.5 shadow-sm transition-all border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed z-10"
          onClick={() => {
            if (popularPlacesIndex > 0) {
              setPopularPlacesIndex(popularPlacesIndex - 1);
            }
          }}
          disabled={popularPlacesIndex === 0}
        >
          <svg
            className="w-3 h-3 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Carousel Container */}
        <div
          className="flex-1 relative h-40 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0 flex items-center justify-center gap-2 px-1 transition-transform duration-500 ease-out">
            {prevIndex !== null &&
              renderCard(popularRooms[prevIndex], false, prevIndex)}
            {renderCard(popularRooms[currentIndex], true, currentIndex)}
            {nextIndex !== null &&
              renderCard(popularRooms[nextIndex], false, nextIndex)}
          </div>
        </div>

        {/* Sağ Ok */}
        <button
          className="flex-shrink-0 bg-white hover:bg-gray-50 rounded-full p-1.5 shadow-sm transition-all border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed z-10"
          onClick={() => {
            if (popularPlacesIndex < popularRooms.length - 1) {
              setPopularPlacesIndex(popularPlacesIndex + 1);
            }
          }}
          disabled={popularPlacesIndex >= popularRooms.length - 1}
        >
          <svg
            className="w-3 h-3 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

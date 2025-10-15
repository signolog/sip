// components/Discover/PopularPlaces.jsx
'use client';

import { useState, useRef } from 'react';

export default function PopularPlaces({ rooms, onRoomSelect }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef(null);

  // Popüler yerleri filtrele (logo'su olanlar)
  const popularRooms = rooms.filter(r => r.logo);

  const handleTouchStart = e => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = e => {
    if (!isDragging) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    const offset = touchStart - currentTouch;
    setDragOffset(offset);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!touchStart || !touchEnd) {
      setDragOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < popularRooms.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }

    setDragOffset(0);
  };

  const handleMouseDown = e => {
    setTouchStart(e.clientX);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleMouseMove = e => {
    if (!isDragging) return;
    const currentX = e.clientX;
    setTouchEnd(currentX);
    const offset = touchStart - currentX;
    setDragOffset(offset);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!touchStart || !touchEnd) {
      setDragOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < popularRooms.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }

    setDragOffset(0);
  };

  if (popularRooms.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">
        Popüler yer bulunamadı
      </div>
    );
  }

  const renderCard = (room, index) => (
    <div
      key={room.id}
      className="w-48 h-32 bg-white rounded-lg border border-gray-200 flex-shrink-0 p-3 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onRoomSelect(room)}
    >
      <div className="h-full flex flex-col">
        {/* Üst Kısım: Logo ve Bilgiler */}
        <div className="flex gap-2 mb-2">
          {/* Logo */}
          <img
            src={room.logo}
            alt={room.name}
            className="h-8 w-8 flex-shrink-0 object-contain rounded border border-gray-200 bg-white p-1"
          />

          {/* Bilgiler */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-800 text-xs mb-0.5 truncate">
              {room.name}
            </h4>
            <p className="text-gray-600 text-[10px] whitespace-nowrap">
              {room.openingHours || '10:00 - 22:00'}
            </p>
          </div>
        </div>

        {/* Kategori ve Etiketler */}
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium text-[9px]">
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
                  className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[8px]"
                >
                  {tag}
                </span>
              ))
          ) : (
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[8px]">
              Kat {room.floor}
            </span>
          )}
        </div>

        {/* Yol Tarif Butonu */}
        <button
          onClick={() => onRoomSelect(room)}
          className="mt-auto w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded text-xs py-1 px-2 transition-colors"
        >
          Yol Tarifi Al
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Popüler Yerler
      </h3>
      <div className="relative flex items-center gap-2">
        {/* Sol Ok */}
        <button
          className="flex-shrink-0 bg-white hover:bg-gray-50 rounded-full p-2 shadow-sm transition-all border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed z-10"
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex(currentIndex - 1);
            }
          }}
          disabled={currentIndex === 0}
        >
          <svg
            className="w-4 h-4 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Carousel Container */}
        <div
          ref={containerRef}
          className="flex-1 relative h-32 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="flex gap-2 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${currentIndex * 200}px)`,
              width: `${popularRooms.length * 200}px`,
            }}
          >
            {popularRooms.map((room, index) => renderCard(room, index))}
          </div>

          {/* Sağ taraf fade-out efekti */}
          <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-white to-transparent pointer-events-none z-10"></div>
        </div>

        {/* Sağ Ok */}
        <button
          className="flex-shrink-0 bg-white hover:bg-gray-50 rounded-full p-2 shadow-sm transition-all border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed z-10"
          onClick={() => {
            if (currentIndex < popularRooms.length - 1) {
              setCurrentIndex(currentIndex + 1);
            }
          }}
          disabled={currentIndex >= popularRooms.length - 1}
        >
          <svg
            className="w-4 h-4 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

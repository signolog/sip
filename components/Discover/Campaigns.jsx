// components/Discover/Campaigns.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';

export default function Campaigns({ placeId, onRoomSelect }) {
  const [campaignRooms, setCampaignRooms] = useState([]);

  // Kampanya verilerini yükle
  const loadCampaignRooms = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms?place_id=${placeId}`);
      if (!response.ok) {
        console.error('❌ Kampanya verileri yüklenemedi');
        return;
      }

      const roomsData = await response.json();
      console.log('🎁 Kampanya verileri yüklendi:', roomsData);

      // Tüm katlardaki room'ları birleştir
      const allRooms = [];
      Object.values(roomsData).forEach(floorData => {
        if (floorData.features) {
          floorData.features.forEach(feature => {
            if (feature.properties.type === 'room') {
              allRooms.push(feature.properties);
            }
          });
        }
      });

      setCampaignRooms(allRooms);
      console.log('🎁 Kampanya için roomlar hazırlandı:', allRooms.length);
      if (allRooms.length > 0) {
        console.log('🎁 İlk room objesi:', allRooms[0]);
        console.log('🎁 İlk room ID:', allRooms[0].id);
      }
    } catch (error) {
      console.error('❌ Kampanya verileri yükleme hatası:', error);
    }
  }, [placeId]);

  // PlaceId değiştiğinde kampanya verilerini yükle
  useEffect(() => {
    if (placeId) {
      loadCampaignRooms();
    }
  }, [placeId, loadCampaignRooms]);

  // Aktif kampanyaları olan mağazaları filtrele
  const activeCampaignRooms = campaignRooms.filter(room => {
    // Sadece yeni kampanya sistemi kontrolü
    if (
      room.campaigns &&
      Array.isArray(room.campaigns) &&
      room.campaigns.length > 0
    ) {
      const hasActiveCampaign = room.campaigns.some(campaign => {
        // Sadece is_active kontrolü yap
        return campaign.is_active === true;
      });
      return hasActiveCampaign;
    }

    return false;
  });

  console.log(
    '🎁 Kampanyalı mağazalar:',
    activeCampaignRooms.length,
    activeCampaignRooms
  );

  // Debug: Tüm rooms'ları kontrol et
  console.log('🔍 Tüm campaignRooms:', campaignRooms.length);
  const roomsWithCampaigns = campaignRooms.filter(
    room => room.campaigns && room.campaigns.length > 0
  );
  console.log('🔍 Kampanyası olan rooms:', roomsWithCampaigns.length);
  if (roomsWithCampaigns.length > 0) {
    console.log('🔍 İlk kampanyalı room:', roomsWithCampaigns[0]);
    console.log('🔍 İlk room kampanyaları:', roomsWithCampaigns[0].campaigns);
  }

  if (activeCampaignRooms.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Kampanyalar
        </h3>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="h-36 flex items-center justify-center text-gray-400 text-sm">
            Henüz kampanya bulunmuyor
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Kampanyalar</h3>
      <div className="bg-gray-50 rounded-lg p-2">
        <div className="space-y-2">
          {activeCampaignRooms.slice(0, 3).map((room, idx) => {
            // Aktif kampanyaları al
            const activeCampaigns =
              room.campaigns && Array.isArray(room.campaigns)
                ? room.campaigns.filter(campaign => {
                    // Sadece is_active kontrolü yap
                    return campaign.is_active === true;
                  })
                : [];

            // İlk aktif kampanyayı al
            const displayCampaign =
              activeCampaigns.length > 0 ? activeCampaigns[0] : null;

            return (
              <div
                key={idx}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                onClick={() => {
                  console.log('🎁 Kampanya tıklandı, room objesi:', room);
                  console.log('🎁 Room ID:', room.id);
                  onRoomSelect(room);
                }}
              >
                {/* Kampanya Görseli - Üstte */}
                {displayCampaign?.image && (
                  <div className="relative">
                    <img
                      src={`/${displayCampaign.image}?t=${Date.now()}`}
                      alt={displayCampaign.title}
                      className="w-full h-20 object-cover"
                    />
                    {/* İndirim Badge'i - Görselin üzerinde */}
                    {(displayCampaign.discount_percentage ||
                      displayCampaign.discount_amount) && (
                      <div className="absolute top-2 right-2">
                        {displayCampaign.discount_percentage && (
                          <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                            %{displayCampaign.discount_percentage} İndirim
                          </span>
                        )}
                        {displayCampaign.discount_amount && (
                          <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                            {displayCampaign.discount_amount} TL İndirim
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* İçerik */}
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Mağaza Logo */}
                    {room.logo && (
                      <img
                        src={`/${room.logo}?t=${Date.now()}`}
                        alt={room.name}
                        className="w-10 h-10 object-contain rounded-lg border border-gray-200 bg-white flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Mağaza İsmi */}
                      <h4 className="text-sm font-bold text-gray-800 mb-1 truncate">
                        {room.name}
                      </h4>

                      {/* Kampanya Bilgileri */}
                      {displayCampaign && (
                        <div className="space-y-1">
                          {/* Kampanya Başlığı */}
                          <p className="text-xs font-medium text-blue-600">
                            {displayCampaign.title}
                          </p>

                          {/* Kampanya Açıklaması */}
                          {displayCampaign.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {displayCampaign.description}
                            </p>
                          )}

                          {/* İndirim Bilgisi - Sadece görsel yoksa göster */}
                          {!displayCampaign.image && (
                            <div className="flex items-center gap-2">
                              {displayCampaign.discount_percentage && (
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                  %{displayCampaign.discount_percentage} İndirim
                                </span>
                              )}
                              {displayCampaign.discount_amount && (
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                  {displayCampaign.discount_amount} TL İndirim
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

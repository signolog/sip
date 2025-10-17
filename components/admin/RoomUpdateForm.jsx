'use client';

import { useState, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import ConfirmDialog from './ConfirmDialog';
import SuccessNotification from './SuccessNotification';
import ErrorNotification from './ErrorNotification';

export default function RoomUpdateForm({
  rooms,
  placeId,
  floor,
  onRoomUpdate,
  onRoomUpdated,
  singleRoomMode = false,
}) {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [formData, setFormData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState('basic'); // "basic" veya "content"
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  // Oda seçildiğinde form verilerini hazırla
  const handleRoomSelect = room => {
    setSelectedRoom(room);
    setFormData({
      id: room.originalId || room.room_id,
      name: room.name || '',
      category: room.category || 'general',
      subtype: room.subtype || '',
      icon: room.icon || '',
      gender: room.gender || '',
      priority: room.priority || '',
      status: room.status || 'open', // Room'dan gelen status'u kullan
      phone: room.phone || '',
      hours: room.hours || '',
      promotion: room.promotion || '',
      // İçerik alanları
      description: room.description || '',
      website: room.website || '',
      email: room.email || '',
      instagram: room.instagram || '',
      twitter: room.twitter || '',
      services: Array.isArray(room.services)
        ? room.services.join(', ')
        : room.services || '',
      // Görseller ve Etiketler
      header_image: room.header_image || '',
      logo: room.logo || '',
      tags: Array.isArray(room.tags) ? room.tags.join(', ') : room.tags || '',
    });
    setIsEditing(false);
    setActiveTab('basic'); // Yeni oda seçildiğinde basic tab'a dön
  };

  // Single room mode için otomatik seçim
  useEffect(() => {
    if (singleRoomMode && rooms.length === 1 && !selectedRoom) {
      handleRoomSelect(rooms[0]);
    }
  }, [singleRoomMode, rooms, selectedRoom]);

  // rooms prop'u değiştiğinde seçili odayı güncelle
  useEffect(() => {
    if (rooms.length === 1 && singleRoomMode) {
      // Single room mode'da tek bir oda varsa, onu otomatik seç
      const room = rooms[0];
      if (
        !selectedRoom ||
        selectedRoom.id !== room.id ||
        selectedRoom.room_id !== room.room_id
      ) {
        handleRoomSelect(room);
      }
    } else if (selectedRoom && rooms.length > 0) {
      // Multi room mode'da seçili odanın güncel halini bul
      const updatedRoom = rooms.find(
        r =>
          r.id === selectedRoom.id ||
          r.originalId === selectedRoom.originalId ||
          r.room_id === selectedRoom.room_id
      );
      if (
        updatedRoom &&
        JSON.stringify(updatedRoom) !== JSON.stringify(selectedRoom)
      ) {
        // Seçili odayı güncelle
        setSelectedRoom(updatedRoom);
        // Form verilerini de güncelle
        setFormData({
          id: updatedRoom.originalId || updatedRoom.room_id,
          name: updatedRoom.name || '',
          category: updatedRoom.category || 'general',
          subtype: updatedRoom.subtype || '',
          icon: updatedRoom.icon || '',
          gender: updatedRoom.gender || '',
          priority: updatedRoom.priority || '',
          status: updatedRoom.status || 'open',
          phone: updatedRoom.phone || '',
          hours: updatedRoom.hours || '',
          promotion: updatedRoom.promotion || '',
          description: updatedRoom.description || '',
          website: updatedRoom.website || '',
          email: updatedRoom.email || '',
          instagram: updatedRoom.instagram || '',
          twitter: updatedRoom.twitter || '',
          services: Array.isArray(updatedRoom.services)
            ? updatedRoom.services.join(', ')
            : updatedRoom.services || '',
          header_image: updatedRoom.header_image || '',
          logo: updatedRoom.logo || '',
          tags: Array.isArray(updatedRoom.tags)
            ? updatedRoom.tags.join(', ')
            : updatedRoom.tags || '',
        });
      }
    }
  }, [rooms, singleRoomMode]);

  // Room'ları filtrele ve paginate et
  const filteredRooms = rooms.filter(
    room =>
      room.name && room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedRooms = showAll ? filteredRooms : filteredRooms.slice(0, 5);
  const hasMoreRooms = filteredRooms.length > 5;

  // Form verilerini güncelle
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Düzenleme modunu aç/kapat
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Yardımcı: Base64 resmi odaya yükle ve dosya yolunu döndür
  const uploadRoomImage = async (type, dataUrl) => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('admin_token')
          : null;
      const endpoint =
        type === 'header'
          ? '/api/admin/rooms/upload-header'
          : '/api/admin/rooms/upload-logo';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          placeId,
          roomId: formData.id,
          imageData: dataUrl,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        console.error(
          '❌ Görsel yüklenemedi:',
          result.error || response.statusText
        );
        return null;
      }
      return result.path; // Kaydedilen dosya yolu
    } catch (e) {
      console.error('❌ Görsel yükleme hatası:', e);
      return null;
    }
  };

  // Kaydetme onayı iste
  const handleSaveClick = () => {
    setShowConfirmDialog(true);
  };

  // Gerçek güncelleme kaydet
  const handleSave = async () => {
    setShowConfirmDialog(false);
    try {
      const updatedPayload = { ...formData };

      // Header image Base64 ise önce sunucuya yükle
      if (
        updatedPayload.header_image &&
        typeof updatedPayload.header_image === 'string' &&
        updatedPayload.header_image.startsWith('data:image/')
      ) {
        const savedPath = await uploadRoomImage(
          'header',
          updatedPayload.header_image
        );
        if (savedPath) {
          updatedPayload.header_image = savedPath;
        }
      }

      // Logo Base64 ise önce sunucuya yükle
      if (
        updatedPayload.logo &&
        typeof updatedPayload.logo === 'string' &&
        updatedPayload.logo.startsWith('data:image/')
      ) {
        const savedPath = await uploadRoomImage('logo', updatedPayload.logo);
        if (savedPath) {
          updatedPayload.logo = savedPath;
        }
      }

      await onRoomUpdate({ action: 'update', floor, ...updatedPayload });

      // CLIENT-SIDE CACHE TEMİZLEME
      // Browser cache'ini temizle (GeoJSON dosyaları için)
      if (typeof window !== 'undefined' && window.caches) {
        try {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.map(name => window.caches.delete(name)));
          console.log('✅ Browser cache temizlendi');
        } catch (cacheError) {
          console.warn('⚠️ Cache temizleme hatası:', cacheError);
        }
      }

      // Kaydet sonrası: üst sayfadaki liste ve arama verilerini tazele
      if (onRoomUpdated) {
        await onRoomUpdated();
      }
      setIsEditing(false);
      
      // Başarı mesajı göster
      setSuccessMessage('Değişiklikler başarıyla kaydedildi!');
      setShowSuccess(true);
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      setErrorMessage('Güncelleme sırasında hata oluştu!');
      setShowError(true);
    }
  };

  // İptal
  const handleCancel = () => {
    setFormData({
      id: selectedRoom.originalId,
      name: selectedRoom.name || '',
      category: selectedRoom.category || 'general',
      subtype: selectedRoom.subtype || '',
      icon: selectedRoom.icon || '',
      gender: selectedRoom.gender || '',
      priority: selectedRoom.priority || '',
      status: selectedRoom.status || 'open',
      phone: selectedRoom.phone || '',
      hours: selectedRoom.hours || '',
      promotion: selectedRoom.promotion || '',
      // İçerik alanları
      description: selectedRoom.description || '',
      website: selectedRoom.website || '',
      email: selectedRoom.email || '',
      instagram: selectedRoom.instagram || '',
      twitter: selectedRoom.twitter || '',
      services: Array.isArray(selectedRoom.services)
        ? selectedRoom.services.join(', ')
        : selectedRoom.services || '',
      // Görseller ve Etiketler
      header_image: selectedRoom.header_image || '',
      logo: selectedRoom.logo || '',
      tags: Array.isArray(selectedRoom.tags)
        ? selectedRoom.tags.join(', ')
        : selectedRoom.tags || '',
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`flex gap-6 h-full ${singleRoomMode ? 'justify-center' : ''}`}
    >
      {/* Sol Panel - Oda Listesi (sadece multi-room mode'da) */}
      {!singleRoomMode && (
        <div className="w-1/2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Kat {floor} - Birimler ({rooms.length})
            </h3>

            {/* Arama Kutusu */}
            <div className="relative">
              <input
                type="text"
                placeholder="Birim ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>

          <div className="p-4 flex-1">
            <div className="space-y-2 h-full overflow-y-auto">
              {displayedRooms.map(room => (
                <div
                  key={room.id}
                  onClick={() => handleRoomSelect(room)}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    selectedRoom?.id === room.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{room.name}</h4>
                      <p className="text-sm text-gray-500">
                        ID: {room.originalId}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {room.category || 'Genel'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Hepsini Göster Butonu */}
              {hasMoreRooms && !showAll && (
                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-2 px-4 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium"
                  >
                    Hepsini Göster ({filteredRooms.length - 5} daha)
                  </button>
                </div>
              )}

              {/* Daha Az Göster Butonu */}
              {showAll && hasMoreRooms && (
                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setShowAll(false)}
                    className="w-full py-2 px-4 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors font-medium"
                  >
                    Daha Az Göster
                  </button>
                </div>
              )}

              {/* Arama Sonucu Yok */}
              {filteredRooms.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <p>Arama kriterlerine uygun birim bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sağ Panel - Oda Düzenleme */}
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col ${
          singleRoomMode ? 'w-full ' : 'w-1/2'
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedRoom
                ? `Birim Düzenleme - ${selectedRoom.name}`
                : 'Birim Seçin'}
            </h3>
            {selectedRoom && (
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={toggleEdit}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Düzenle
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveClick}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
                    >
                      İptal
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        {selectedRoom && (
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-4">
              <button
                onClick={() => setActiveTab('basic')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'basic'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Temel Bilgiler
              </button>
              <button
                onClick={() => setActiveTab('content')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'content'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                İçerik Yönetimi
              </button>
              <button
                onClick={() => setActiveTab('campaigns')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'campaigns'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Kampanyalar
              </button>
            </nav>
          </div>
        )}

        <div className="p-4 flex-1 overflow-y-auto">
          {selectedRoom ? (
            <div className="space-y-4">
              {activeTab === 'basic' && (
                /* Temel Bilgiler Tab */
                <>
                  {/* Temel Bilgiler */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Temel Bilgiler
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Birim Adı
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={e =>
                            handleInputChange('name', e.target.value)
                          }
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kategori
                        </label>
                        <select
                          value={formData.category}
                          onChange={e =>
                            handleInputChange('category', e.target.value)
                          }
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                          <option value="general">Genel</option>
                          <option value="food">Yemek</option>
                          <option value="shopping">Alışveriş</option>
                          <option value="entertainment">Eğlence</option>
                          <option value="services">Hizmetler</option>
                          <option value="electronics">Elektronik</option>
                          <option value="fashion">Moda</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Özel Bilgiler */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Özel Bilgiler
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Alt Tip
                        </label>
                        <input
                          type="text"
                          value={formData.subtype}
                          onChange={e =>
                            handleInputChange('subtype', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="Örn: Kahve, Restoran, Mağaza"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          İkon
                        </label>
                        <input
                          type="text"
                          value={formData.icon}
                          onChange={e =>
                            handleInputChange('icon', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="Örn: coffee, restaurant, shop"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ek Bilgiler */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Ek Bilgiler
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Telefon
                        </label>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={e =>
                            handleInputChange('phone', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="+90 312 123 4567"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Çalışma Saatleri
                        </label>
                        <input
                          type="text"
                          value={formData.hours}
                          onChange={e =>
                            handleInputChange('hours', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="08:00-22:00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Promosyon
                        </label>
                        <input
                          type="text"
                          value={formData.promotion}
                          onChange={e =>
                            handleInputChange('promotion', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="İndirim %30"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'content' && (
                /* İçerik Yönetimi Tab */
                <>
                  {/* Görseller */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Görseller
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Header Görseli
                        </label>
                        {/* Anlık önizleme */}
                        {formData.header_image && (
                          <div
                            className={`mb-2 ${
                              typeof formData.header_image === 'string' &&
                              formData.header_image.startsWith('data:image/')
                                ? 'border-2 border-blue-400'
                                : ''
                            }`}
                          >
                            <img
                              src={
                                typeof formData.header_image === 'string' &&
                                formData.header_image.startsWith('data:image/')
                                  ? formData.header_image
                                  : `${
                                      formData.header_image.split('?')[0]
                                    }?t=${Date.now()}`
                              }
                              alt="Header Preview"
                              className="w-full h-32 object-cover rounded"
                              key={formData.header_image}
                            />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          disabled={!isEditing}
                          onChange={e => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              handleInputChange('header_image', reader.result);
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Logo
                        </label>
                        {/* Anlık önizleme */}
                        {formData.logo && (
                          <div
                            className={`mb-2 ${
                              typeof formData.logo === 'string' &&
                              formData.logo.startsWith('data:image/')
                                ? 'border-2 border-blue-400'
                                : ''
                            }`}
                          >
                            <img
                              src={
                                typeof formData.logo === 'string' &&
                                formData.logo.startsWith('data:image/')
                                  ? formData.logo
                                  : `${
                                      formData.logo.split('?')[0]
                                    }?t=${Date.now()}`
                              }
                              alt="Logo Preview"
                              className="h-16 object-contain rounded"
                              key={formData.logo}
                            />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          disabled={!isEditing}
                          onChange={e => {
                            const file = e.target.files && e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              handleInputChange('logo', reader.result);
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Açıklama */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Açıklama
                    </h4>
                    <textarea
                      value={formData.description}
                      onChange={e =>
                        handleInputChange('description', e.target.value)
                      }
                      disabled={!isEditing}
                      rows={3}
                      placeholder="Mağaza açıklaması..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  {/* İletişim Bilgileri */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      İletişim Bilgileri
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Website
                        </label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={e =>
                            handleInputChange('website', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="https://example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          E-posta
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e =>
                            handleInputChange('email', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="info@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Instagram Kullanıcı Adı
                        </label>
                        <input
                          type="text"
                          value={formData.instagram}
                          onChange={e =>
                            handleInputChange('instagram', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="ornekhesap"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Twitter Kullanıcı Adı
                        </label>
                        <input
                          type="text"
                          value={formData.twitter}
                          onChange={e =>
                            handleInputChange('twitter', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="ornekhesap"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hizmetler */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Hizmetler
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hizmetler
                        </label>
                        <input
                          type="text"
                          value={formData.services}
                          onChange={e =>
                            handleInputChange('services', e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="Örn: tamir, kurulum, iade kabul"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Virgülle ayırarak birden fazla hizmet ekleyin
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Etiketler */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Etiketler
                    </h4>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={e => handleInputChange('tags', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Örn: teknoloji, elektronik, kampanya"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Virgülle ayırarak birden fazla etiket ekleyin
                    </p>
                  </div>
                </>
              )}

              {activeTab === 'campaigns' && (
                /* Kampanyalar Tab */
                <CampaignManager
                  room={selectedRoom}
                  placeId={placeId}
                  onCampaignUpdate={onRoomUpdated}
                />
              )}
            </div>
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Birim Seçin
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Düzenlemek için sol panelden bir birim seçin
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Onay Dialog'u */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onConfirm={handleSave}
        onCancel={() => setShowConfirmDialog(false)}
        title="Değişiklikleri Kaydet"
        message="Yaptığınız değişiklikleri kaydetmek istediğinizden emin misiniz?"
        confirmText="Kaydet"
        cancelText="İptal"
        type="success"
      />

      {/* Başarı Notification */}
      <SuccessNotification
        message={successMessage}
        isVisible={showSuccess}
        onClose={() => setShowSuccess(false)}
      />

      {/* Hata Notification */}
      <ErrorNotification
        message={errorMessage}
        isVisible={showError}
        onClose={() => setShowError(false)}
      />
    </div>
  );
}

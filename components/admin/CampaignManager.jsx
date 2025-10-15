// components/admin/CampaignManager.jsx
'use client';

import { useState, useEffect } from 'react';

export default function CampaignManager({ room, placeId, onCampaignUpdate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discountPercentage: '',
    discountAmount: '',
    startDate: '',
    endDate: '',
    image: null,
    is_active: true, // Varsayılan olarak aktif
  });

  // Room'dan kampanyaları yükle
  useEffect(() => {
    if (room?.content?.campaigns) {
      setCampaigns(room.content.campaigns);
    } else {
      setCampaigns([]);
    }
  }, [room]);

  // Form temizleme
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discountPercentage: '',
      discountAmount: '',
      startDate: '',
      endDate: '',
      image: null,
      is_active: true,
    });
    setShowAddForm(false);
    setEditingCampaign(null);
  };

  // Kampanya ekleme/güncelleme
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const formDataToSend = new FormData();

      formDataToSend.append('roomId', room.room_id);
      formDataToSend.append('placeId', placeId);
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);

      if (formData.discountPercentage) {
        formDataToSend.append(
          'discountPercentage',
          formData.discountPercentage
        );
      }
      if (formData.discountAmount) {
        formDataToSend.append('discountAmount', formData.discountAmount);
      }
      if (formData.startDate) {
        formDataToSend.append('startDate', formData.startDate);
      }
      if (formData.endDate) {
        formDataToSend.append('endDate', formData.endDate);
      }
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      // is_active alanını ekle
      formDataToSend.append('is_active', formData.is_active.toString());

      // Düzenleme modunda campaignIndex ekle
      if (editingCampaign !== null) {
        formDataToSend.append('campaignIndex', editingCampaign.toString());
      }

      const method = editingCampaign !== null ? 'PUT' : 'POST';
      console.log('🔍 API Request:', {
        url: '/api/admin/rooms/add-campaign',
        method: method,
        editingCampaign: editingCampaign,
        roomId: room.room_id,
        placeId: placeId,
      });

      const response = await fetch('/api/admin/rooms/add-campaign', {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      console.log('🔍 API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      const result = await response.json();

      if (result.success) {
        // Kampanyaları yeniden yükle
        if (onCampaignUpdate) {
          await onCampaignUpdate();
        }
        resetForm();
        alert(
          editingCampaign !== null
            ? '✅ Kampanya başarıyla güncellendi!'
            : '✅ Kampanya başarıyla eklendi!'
        );
      } else {
        alert(`❌ Hata: ${result.error}`);
      }
    } catch (error) {
      console.error('Kampanya ekleme hatası:', error);
      alert('❌ Kampanya eklenirken hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  // Kampanya silme
  const handleDeleteCampaign = async campaignIndex => {
    if (!confirm('Bu kampanyayı silmek istediğinizden emin misiniz?')) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/rooms/add-campaign', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: room.room_id,
          placeId: placeId,
          campaignIndex: campaignIndex,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Kampanyaları yeniden yükle
        if (onCampaignUpdate) {
          await onCampaignUpdate();
        }
        alert('✅ Kampanya başarıyla silindi!');
      } else {
        alert(`❌ Hata: ${result.error}`);
      }
    } catch (error) {
      console.error('Kampanya silme hatası:', error);
      alert('❌ Kampanya silinirken hata oluştu!');
    } finally {
      setLoading(false);
    }
  };

  // Kampanya düzenleme
  const handleEditCampaign = (campaign, index) => {
    setEditingCampaign(index);
    setFormData({
      title: campaign.title || '',
      description: campaign.description || '',
      discountPercentage: campaign.discount_percentage?.toString() || '',
      discountAmount: campaign.discount_amount?.toString() || '',
      startDate: campaign.start_date
        ? new Date(campaign.start_date).toISOString().split('T')[0]
        : '',
      endDate: campaign.end_date
        ? new Date(campaign.end_date).toISOString().split('T')[0]
        : '',
      image: null,
      is_active: campaign.is_active !== false, // Default true, sadece false ise false
    });
    setShowAddForm(true);
  };

  // Kampanya durumu kontrolü - Sadece is_active kontrolü
  const isCampaignActive = campaign => {
    // Sadece is_active kontrolü yap
    return campaign.is_active === true;
  };

  return (
    <div className="space-y-4">
      {/* Kampanya Listesi */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-md font-medium text-gray-900">
            Kampanyalar ({campaigns.length})
          </h4>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
          >
            + Kampanya Ekle
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <div className="text-4xl mb-2">🎯</div>
            <p>Henüz kampanya eklenmemiş</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  isCampaignActive(campaign)
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-medium text-gray-900">
                        {campaign.title}
                      </h5>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          isCampaignActive(campaign)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isCampaignActive(campaign) ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>

                    {campaign.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {campaign.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {campaign.discount_percentage && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          %{campaign.discount_percentage} İndirim
                        </span>
                      )}
                      {campaign.discount_amount && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {campaign.discount_amount} TL İndirim
                        </span>
                      )}
                      {campaign.start_date && (
                        <span>
                          Başlangıç:{' '}
                          {new Date(campaign.start_date).toLocaleDateString(
                            'tr-TR'
                          )}
                        </span>
                      )}
                      {campaign.end_date && (
                        <span>
                          Bitiş:{' '}
                          {new Date(campaign.end_date).toLocaleDateString(
                            'tr-TR'
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEditCampaign(campaign, index)}
                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDeleteCampaign(index)}
                      className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                {/* Kampanya Görseli */}
                {campaign.image && (
                  <div className="mt-3">
                    <img
                      src={`/${campaign.image}?t=${Date.now()}`}
                      alt={campaign.title}
                      className="w-32 h-20 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kampanya Ekleme Formu */}
      {showAddForm && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-medium text-gray-900">
              {editingCampaign !== null
                ? 'Kampanya Düzenle'
                : 'Yeni Kampanya Ekle'}
            </h5>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kampanya Başlığı *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Örn: Yaz İndirimi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Kampanya detayları"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İndirim Yüzdesi (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discountPercentage}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      discountPercentage: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sabit İndirim (TL)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.discountAmount}
                  onChange={e =>
                    setFormData({ ...formData, discountAmount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={e =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kampanya Görseli
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                onChange={e =>
                  setFormData({ ...formData, image: e.target.files[0] })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Desteklenen formatlar: PNG, JPG, JPEG, GIF, WEBP
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Kampanya Aktif
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Aktif kampanyalar ana sayfada görünür
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={
                  loading ||
                  !formData.title ||
                  (!formData.discountPercentage && !formData.discountAmount)
                }
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? 'Kaydediliyor...'
                  : editingCampaign !== null
                  ? 'Güncelle'
                  : 'Kampanya Ekle'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

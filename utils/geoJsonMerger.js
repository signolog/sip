// GeoJSON Merge Utility
// Base GeoJSON ile DB'den gelen updates'leri birleştirir

/**
 * Base GeoJSON ile updates'i merge eder
 * @param {Object} baseGeoJSON - Temel GeoJSON dosyası
 * @param {Object} updatesGeoJSON - DB'den gelen güncellemeler
 * @returns {Object} - Merge edilmiş GeoJSON
 */
export function mergeGeoJSON(baseGeoJSON, updatesGeoJSON) {
  console.log("🔄 GeoJSON merge işlemi başlıyor...");
  console.log("📁 Base features:", baseGeoJSON.features?.length || 0);
  console.log("🔄 Updates features:", updatesGeoJSON.features?.length || 0);

  if (!baseGeoJSON || !baseGeoJSON.features) {
    console.warn("⚠️ Base GeoJSON geçersiz");
    return updatesGeoJSON || { type: "FeatureCollection", features: [] };
  }

  if (!updatesGeoJSON || !updatesGeoJSON.features) {
    console.log("ℹ️ Updates GeoJSON yok, base döndürülüyor");
    return baseGeoJSON;
  }

  // Base features'ları kopyala
  const mergedFeatures = [...baseGeoJSON.features];
  const processedIds = new Set();

  // Updates'leri işle
  updatesGeoJSON.features.forEach((updateFeature) => {
    const updateId = updateFeature.properties?.id;
    const action = updateFeature.properties?.action || "update";

    if (!updateId) {
      console.warn("⚠️ Update feature'da id yok:", updateFeature);
      return;
    }

    processedIds.add(updateId);

    switch (action) {
      case "add":
        // Yeni feature ekle
        console.log("➕ Yeni feature ekleniyor:", updateId);
        mergedFeatures.push(updateFeature);
        break;

      case "delete":
        // Feature'ı sil
        console.log("🗑️ Feature siliniyor:", updateId);
        const deleteIndex = mergedFeatures.findIndex((f) => f.properties?.id === updateId);
        if (deleteIndex !== -1) {
          mergedFeatures.splice(deleteIndex, 1);
        }
        break;

      case "update":
      default:
        // Feature'ı güncelle
        console.log("🔄 Feature güncelleniyor:", updateId);
        const updateIndex = mergedFeatures.findIndex((f) => f.properties?.id === updateId);

        if (updateIndex !== -1) {
          // Mevcut feature'ı güncelle
          mergedFeatures[updateIndex] = {
            ...mergedFeatures[updateIndex],
            ...updateFeature,
            properties: {
              ...mergedFeatures[updateIndex].properties,
              ...updateFeature.properties,
            },
          };
        } else {
          // Feature bulunamadı, yeni olarak ekle
          console.log("➕ Feature bulunamadı, yeni olarak ekleniyor:", updateId);
          mergedFeatures.push(updateFeature);
        }
        break;
    }
  });

  const result = {
    ...baseGeoJSON,
    features: mergedFeatures,
  };

  console.log("✅ Merge tamamlandı. Toplam features:", result.features.length);
  return result;
}

/**
 * Birden fazla kat için GeoJSON merge işlemi
 * @param {Object} floorsData - Kat bazlı base GeoJSON'lar
 * @param {Object} updatesData - Kat bazlı updates GeoJSON'lar
 * @returns {Object} - Merge edilmiş kat bazlı GeoJSON'lar
 */
export function mergeAllFloors(floorsData, updatesData) {
  console.log("🏢 Tüm katlar için merge işlemi başlıyor...");

  const mergedFloors = {};

  Object.keys(floorsData).forEach((floor) => {
    console.log(`🔄 Kat ${floor} merge ediliyor...`);
    const baseFloor = floorsData[floor];
    const updatesFloor = updatesData[floor];

    mergedFloors[floor] = mergeGeoJSON(baseFloor, updatesFloor);
  });

  console.log("✅ Tüm katlar merge edildi");
  return mergedFloors;
}

/**
 * URL'den GeoJSON yükler
 * @param {string} url - GeoJSON dosya URL'i
 * @returns {Promise<Object>} - Yüklenen GeoJSON
 */
export async function loadGeoJSONFromURL(url) {
  try {
    // CACHE-BUSTING: Her istekte timestamp ekle
    const cacheBuster = `?t=${Date.now()}`;
    const urlWithCache = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}${cacheBuster}`;
    
    console.log("📥 GeoJSON yükleniyor:", urlWithCache);
    const response = await fetch(urlWithCache, {
      cache: 'no-store', // Cache'i devre dışı bırak
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const geoJSON = await response.json();
    console.log("✅ GeoJSON yüklendi:", url, "Features:", geoJSON.features?.length || 0);
    return geoJSON;
  } catch (error) {
    console.error("❌ GeoJSON yükleme hatası:", url, error);
    return { type: "FeatureCollection", features: [] };
  }
}

/**
 * Base ve updates URL'lerinden merge edilmiş GeoJSON yükler
 * @param {string} baseURL - Base GeoJSON URL'i
 * @param {string} updatesURL - Updates GeoJSON URL'i
 * @returns {Promise<Object>} - Merge edilmiş GeoJSON
 */
export async function loadAndMergeGeoJSON(baseURL, updatesURL) {
  console.log("🔄 Base ve updates GeoJSON'ları yükleniyor...");

  const [baseGeoJSON, updatesGeoJSON] = await Promise.all([
    loadGeoJSONFromURL(baseURL),
    loadGeoJSONFromURL(updatesURL),
  ]);

  return mergeGeoJSON(baseGeoJSON, updatesGeoJSON);
}

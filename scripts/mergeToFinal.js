// Final klasörü için merge script
// Base GeoJSON'ları updates ile merge edip final klasörüne kaydeder

const fs = require("fs");
const path = require("path");

// Basit merge fonksiyonu (CommonJS için)
function mergeGeoJSON(baseGeoJSON, updatesGeoJSON) {
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

  // Updates'leri işle
  updatesGeoJSON.features.forEach((updateFeature) => {
    const updateId = updateFeature.properties?.id;
    const action = updateFeature.properties?.action || "update";

    if (!updateId) {
      console.warn("⚠️ Update feature'da id yok:", updateFeature);
      return;
    }

    switch (action) {
      case "add":
        console.log("➕ Yeni feature ekleniyor:", updateId);
        mergedFeatures.push(updateFeature);
        break;

      case "delete":
        console.log("🗑️ Feature siliniyor:", updateId);
        const deleteIndex = mergedFeatures.findIndex((f) => f.properties?.id === updateId);
        if (deleteIndex !== -1) {
          mergedFeatures.splice(deleteIndex, 1);
        }
        break;

      case "update":
      default:
        console.log("🔄 Feature güncelleniyor:", updateId);
        const updateIndex = mergedFeatures.findIndex((f) => f.properties?.id === updateId);

        if (updateIndex !== -1) {
          mergedFeatures[updateIndex] = {
            ...mergedFeatures[updateIndex],
            ...updateFeature,
            properties: {
              ...mergedFeatures[updateIndex].properties,
              ...updateFeature.properties,
            },
          };
        } else {
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

const publicDir = path.join(process.cwd(), "public");

console.log("🔄 Final klasörü için tüm mekanlar üzerinde merge işlemi başlıyor...");

// places.json'dan tüm mekan ve katları oku
const placesPath = path.join(publicDir, "places", "places.json");
const places = JSON.parse(fs.readFileSync(placesPath, "utf8"));

for (const [placeId, place] of Object.entries(places)) {
  const slug = place.slug;
  const baseDir = path.join(publicDir, "places", slug, "base");
  const updatesDir = path.join(publicDir, "places", slug, "updates");
  const finalDir = path.join(publicDir, "places", slug, "final");
  const floors = Object.keys(place.floors || {});

  console.log(`\n🏢 ${place.name} (${slug}) için merge başlıyor. Katlar: [${floors.join(", ")} ]`);

  floors.forEach((floor) => {
    try {
      // Base GeoJSON'ı yükle (yoksa final'den fallback)
      // Önce slug ile dene, sonra slug'ı underscore'a çevirerek dene
      let basePath = path.join(baseDir, `${slug}-floor_${floor}.geojson`);
      let baseGeoJSON;

      if (fs.existsSync(basePath)) {
        baseGeoJSON = JSON.parse(fs.readFileSync(basePath, "utf8"));
      } else {
        // Slug'ı underscore'a çevirerek tekrar dene (mall-of-ankara -> mall_of_ankara)
        const underscoreSlug = slug.replace(/-/g, "_");
        const altBasePath = path.join(baseDir, `${underscoreSlug}-floor_${floor}.geojson`);

        if (fs.existsSync(altBasePath)) {
          console.log(`📁 Alternatif base dosyası bulundu: ${altBasePath}`);
          baseGeoJSON = JSON.parse(fs.readFileSync(altBasePath, "utf8"));
        } else {
          const fallbackFinal = path.join(finalDir, `${slug}-floor_${floor}.geojson`);
          if (fs.existsSync(fallbackFinal)) {
            console.warn(`⚠️ Base yok, final'den okunuyor: ${fallbackFinal}`);
            baseGeoJSON = JSON.parse(fs.readFileSync(fallbackFinal, "utf8"));
          } else {
            throw new Error(`Base/Final bulunamadı: ${basePath} | ${altBasePath} | ${fallbackFinal}`);
          }
        }
      }

      console.log(`📁 Base Floor ${floor} yüklendi:`, baseGeoJSON.features?.length || 0, "feature");

      // Updates GeoJSON'ı yükle
      const updatesPath = path.join(updatesDir, `${slug}-floor_${floor}-updates.geojson`);
      let updatesGeoJSON = { type: "FeatureCollection", features: [] };

      try {
        const updatesContent = fs.readFileSync(updatesPath, "utf8");
        updatesGeoJSON = JSON.parse(updatesContent);
        console.log(`🔄 Updates Floor ${floor} yüklendi:`, updatesGeoJSON.features?.length || 0, "update");
      } catch (err) {
        console.log(`ℹ️ Updates Floor ${floor} bulunamadı, sadece base kullanılacak`);
      }

      // Merge işlemi
      const mergedGeoJSON = mergeGeoJSON(baseGeoJSON, updatesGeoJSON);

      // Final klasörüne kaydet
      const finalPath = path.join(finalDir, `${slug}-floor_${floor}.geojson`);
      fs.writeFileSync(finalPath, JSON.stringify(mergedGeoJSON, null, 2));

      console.log(`✅ Final Floor ${floor} kaydedildi:`, mergedGeoJSON.features?.length || 0, "feature");
    } catch (error) {
      console.error(`❌ ${slug} Floor ${floor} merge hatası:`, error);
    }
  });
}

console.log("\n✅ Tüm mekanlar için final klasörleri güncellendi!");

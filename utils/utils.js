const specialLocations = {
  pharmacy: { name: "Eczane", icon: "💊" },
  "wc": { name: "Tuvalet", icon: "🚹" },
  // "wc-female": { name: "En Yakın Kadın Tuvaleti", icon: "🚺" },
  // "wc-disabled": { name: "En Yakın Engelli Tuvaleti", icon: "♿" },
  "baby-care": { name: "Bebek  Odası", icon: "👶" },
  "exit": { name: "Çıkış", icon: "🚪" },
  "entrance": { name: "Giriş", icon: "🚪" },
  "fire-exit": { name: "Yangın Merdiveni", icon: "🔥" },
  "emergency-exit": { name: "Acil Çıkış", icon: "🚪" },
  // "first-aid": { name: "En Yakın İlk Yardım", icon: "🏥" },
  // "info-desk": { name: "En Yakın Bilgi Danışma", icon: "ℹ️" },
};

// GeoJSON dosyalarının yollarını tanımlar - API'den dinamik olarak yüklenecek
const geojsonURLS = {
  // Base klasöründen yüklenecek
  0: "floor_0.geojson",
  //  1: "base/ankamall-floor-1.geojson",
  //  2: "base/ankamall-floor-2.geojson",
};

export { specialLocations, geojsonURLS };

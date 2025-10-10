// Simple script to update places via API
const placesData = [
  {
    slug: "ankamall",
    center: [32.8315, 39.9503],
    zoom: 18,
    floors: {
      0: "places/ankamall/final/floor_0.geojson",
      1: "places/ankamall/final/floor_1.geojson",
      2: "places/ankamall/final/floor_2.geojson",
    },
    floor_photos: {
      0: "images/places/acity/floors/ankamall-floor-K0.svg",
    },
    content: {
      description:
        "Ankara'nın en büyük alışveriş merkezlerinden biri olan Ankamall, 200+ mağaza ve restoran ile ziyaretçilerine unutulmaz bir deneyim sunuyor.",
      header_image: "/images/places/ankamall-header.png",
      logo: "/images/places/ankamall-logo.png",
      gallery: ["/images/places/ankamall-1.jpg", "/images/places/ankamall-2.jpg", "/images/places/ankamall-3.jpg"],
      working_hours: {
        monday: {},
        tuesday: {},
        wednesday: {},
        thursday: {},
        friday: {},
        saturday: {},
        sunday: {},
      },
      contact: {
        phone: "+90 312 123 45 67",
        email: "info@ankamall.com",
        website: "https://www.ankamall.com",
        address: "Bilkent, Ankara",
      },
      amenities: ["Ücretsiz WiFi", "Çocuk Oyun Alanı", "Eczane", "Kütüphane"],
    },
  },
  {
    slug: "mall-of-ankara",
    center: [32.8597, 39.9334],
    zoom: 18,
    floors: {
      0: "places/mall-of-ankara/final/floor_0.geojson",
      1: "places/mall-of-ankara/final/floor_1.geojson",
      2: "places/mall-of-ankara/final/floor_2.geojson",
    },
    floor_photos: {
      0: "images/places/mall-of-ankara/floors/floor-0.svg",
    },
    content: {
      description:
        "Mall of Ankara, modern mimarisi ve geniş mağaza seçenekleriyle Ankara'nın önemli alışveriş merkezlerinden biridir.",
      header_image: "/images/places/mall-of-ankara-header.png",
      logo: "/images/places/mall-of-ankara-logo.png",
      gallery: [],
      working_hours: {
        monday: {},
        tuesday: {},
        wednesday: {},
        thursday: {},
        friday: {},
        saturday: {},
        sunday: {},
      },
      contact: {
        phone: "+90 312 987 65 43",
        email: "info@mallofankara.com",
        website: "https://www.mallofankara.com",
        address: "Çankaya, Ankara",
      },
      amenities: ["Ücretsiz WiFi", "Çocuk Oyun Alanı", "Sinema"],
    },
  },
];

console.log("Mekan bilgileri hazırlandı.");
console.log("\nAdmin panel'e giriş yap ve şu URL'lere POST isteği at:");
console.log("\nAnkamall için:");
console.log("URL: http://localhost:3000/api/admin/places/content");
console.log("Body:", JSON.stringify({ placeId: "ANKAMALL_PLACE_ID", ...placesData[0].content }, null, 2));
console.log("\n\nMall of Ankara için:");
console.log("URL: http://localhost:3000/api/admin/places/content");
console.log("Body:", JSON.stringify({ placeId: "MALL_OF_ANKARA_PLACE_ID", ...placesData[1].content }, null, 2));

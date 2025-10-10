/**
 * Rename floor files to the new floor_±N format and update places.json paths.
 * Affects base, updates, and final under public/places/{slug}/.
 */
const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function renameIfExists(fromPath, toPath) {
  if (fs.existsSync(fromPath)) {
    console.log(`➡️  Rename: ${fromPath} -> ${toPath}`);
    ensureDir(path.dirname(toPath));
    fs.renameSync(fromPath, toPath);
    return true;
  }
  return false;
}

function migratePlace(slug) {
  const placeDir = path.join(process.cwd(), "public", "places", slug);
  const baseDir = path.join(placeDir, "base");
  const updatesDir = path.join(placeDir, "updates");
  const finalDir = path.join(placeDir, "final");

  const candidateFloors = Array.from({ length: 11 }, (_, i) => i - 5); // -5..+5

  candidateFloors.forEach((f) => {
    const signed = `${f}`; // e.g., -1, 0, 1

    // Old names (dash) and older final suffix (with -final)
    const oldBase = path.join(baseDir, `ankamall-floor-${signed}.geojson`);
    const oldUpdates = path.join(updatesDir, `ankamall-floor-${signed}-updates.geojson`);
    const oldFinal = path.join(finalDir, `ankamall-floor-${signed}.geojson`);
    const oldFinalWithSuffix = path.join(finalDir, `ankamall-floor-${signed}-final.geojson`);

    // New names (underscore)
    const newBase = path.join(baseDir, `ankamall-floor_${signed}.geojson`);
    const newUpdates = path.join(updatesDir, `ankamall-floor_${signed}-updates.geojson`);
    const newFinal = path.join(finalDir, `ankamall-floor_${signed}.geojson`);

    // Rename if old exists
    // Final: prefer -final -> underscore, else plain dash -> underscore
    if (!fs.existsSync(newFinal)) {
      if (!renameIfExists(oldFinalWithSuffix, newFinal)) {
        renameIfExists(oldFinal, newFinal);
      }
    }
    if (!fs.existsSync(newBase)) renameIfExists(oldBase, newBase);
    if (!fs.existsSync(newUpdates)) renameIfExists(oldUpdates, newUpdates);
  });
}

function updatePlacesJson() {
  const placesPath = path.join(process.cwd(), "public", "places", "places.json");
  if (!fs.existsSync(placesPath)) {
    console.log("places.json bulunamadı, atlanıyor");
    return;
  }
  const json = JSON.parse(fs.readFileSync(placesPath, "utf8"));
  for (const [id, place] of Object.entries(json)) {
    const slug = place.slug;
    if (!place.floors) continue;
    for (const [floorKey, relPath] of Object.entries(place.floors)) {
      // Replace any ...floor-<n>... with ...floor_<n>...
      const updated = relPath.replace(/(floor)-(\-?\d+)/, "floor_$2").replace(/-final\.geojson$/, ".geojson");
      if (updated !== relPath) {
        console.log(`📝 places.json: ${relPath} -> ${updated}`);
        place.floors[floorKey] = updated;
      }
    }
  }
  fs.writeFileSync(placesPath, JSON.stringify(json, null, 2));
}

function main() {
  console.log("🔄 Kat dosyaları isimlendirme migrasyonu başlıyor...");
  const placesRoot = path.join(process.cwd(), "public", "places");
  const entries = fs.readdirSync(placesRoot, { withFileTypes: true });
  const slugs = entries.filter((e) => e.isDirectory() && e.name !== "images").map((e) => e.name);
  slugs.forEach(migratePlace);
  updatePlacesJson();
  console.log("✅ İsimlendirme migrasyonu tamamlandı.");
}

main();

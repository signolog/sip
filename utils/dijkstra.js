/**
 * Dijkstra algoritmaları ve path finding fonksiyonları
 * Multi-floor ve single-floor routing için optimize edilmiş algoritmalar
 */

/**
 * Tek kat içinde Dijkstra algoritması ile en kısa yol bulma
 * @param {string} startId - Başlangıç node ID'si
 * @param {string} endId - Hedef node ID'si
 * @param {Object} graph - Graph objesi
 * @returns {Array} En kısa yol node ID'leri dizisi
 */
export function singleFloorDijkstra(startId, endId, graph) {
  const dist = {};
  const prev = {};
  const visited = new Set();

  Object.keys(graph).forEach((id) => {
    dist[id] = Infinity;
    prev[id] = null;
  });
  dist[startId] = 0;

  while (true) {
    let u = null;
    let min = Infinity;

    for (const id in graph) {
      if (!visited.has(id) && dist[id] < min) {
        min = dist[id];
        u = id;
      }
    }

    if (u === null || u === endId) break;
    visited.add(u);

    for (const { to, weight, type } of graph[u].neighbors) {
      // Door atlama kuralı - sadece hedef door'a girebilir
      const isDoor = graph[to]?.type === "door-node";
      if (isDoor && to !== endId) continue;

      const alt = dist[u] + weight;
      if (alt < dist[to]) {
        dist[to] = alt;
        prev[to] = u;
      }
    }
  }

  const path = [];
  for (let u = endId; u; u = prev[u]) path.push(u);
  return dist[endId] === Infinity ? [] : path.reverse();
}

/**
 * Çok katlı Dijkstra algoritması - Entry/Exit mantığı ile
 * @param {string} startId - Başlangıç node ID'si
 * @param {string} endId - Hedef node ID'si
 * @param {Object} graph - Graph objesi
 * @param {string} preferredTransport - Tercih edilen transport tipi ("escalator" veya "elevator")
 * @param {Object} allGeoData - GeoJSON verileri (floor range kontrolü için)
 * @returns {Array} En kısa yol node ID'leri dizisi
 */
export function multiFloorDijkstra(startId, endId, graph, preferredTransport, allGeoData) {
  const startFloor = graph[startId]?.floor;
  const endFloor = graph[endId]?.floor;

  if (startFloor === endFloor) {
    return singleFloorDijkstra(startId, endId, graph);
  }

  console.log(`🔄 Cross-floor routing with ENTRY/EXIT LOGIC: Floor ${startFloor} → Floor ${endFloor}`);

  // YÖN KONTROLÜ: Yukarı mı aşağı mı gidiyoruz?
  const isGoingUp = endFloor > startFloor;
  const requiredDirection = isGoingUp ? "up" : "down";

  console.log(`📈 Direction: ${isGoingUp ? "UP ⬆️" : "DOWN ⬇️"}`);

  // ✅ YENİ: Başlangıç katında ENTRY node'larını bul
  const startFloorConnectors = Object.keys(graph).filter((id) => {
    const node = graph[id];
    if (node.type !== "floor-connector-node" || node.floor !== startFloor) {
      return false;
    }

    const props = getConnectorProperties(id, graph);

    // 🆕 ENTRY NODE ŞARTI EKLENDI
    const isEntryNode = props.nodeType === "entry";
    if (!isEntryNode) {
      console.log(`❌ ${id}: Not entry node (nodeType: ${props.nodeType})`);
      return false;
    }

    // 1. Transport tipi kontrolü
    const isPreferredType = props.connectorType === preferredTransport;

    // 2. Direction kontrolü
    const canUseDirection = canUseConnectorDirection(props, requiredDirection);

    // 3. Floor range kontrolü
    const canUseFloors = canUseConnectorFloors(id, startFloor, endFloor, graph, allGeoData);

    console.log(`   🔍 ENTRY connector ${id}:`);
    console.log(`      Type: ${props.connectorType}, preferred: ${isPreferredType}`);
    console.log(`      Direction: ${canUseDirection}, floors: ${canUseFloors}`);
    console.log(`      NodeType: ${props.nodeType} ✅`);

    return isPreferredType && canUseDirection && canUseFloors;
  });

  // Tercih edilen tip bulunamazsa fallback yap
  if (startFloorConnectors.length === 0) {
    console.log(`❌ ${preferredTransport} ENTRY nodes bulunamadı, diğer transport tipine bakıyor...`);

    // Fallback: Diğer transport tipindeki ENTRY connector'ları dene
    const fallbackTransport = preferredTransport === "escalator" ? "elevator" : "escalator";

    const fallbackConnectors = Object.keys(graph).filter((id) => {
      const node = graph[id];
      if (node.type !== "floor-connector-node" || node.floor !== startFloor) {
        return false;
      }

      const props = getConnectorProperties(id, graph);

      // 🆕 ENTRY NODE ŞARTI
      const isEntryNode = props.nodeType === "entry";
      if (!isEntryNode) return false;

      const isTargetType = props.connectorType === fallbackTransport;
      const canUseDirection = canUseConnectorDirection(props, requiredDirection);
      const canUseFloors = canUseConnectorFloors(id, startFloor, endFloor, graph, allGeoData);

      console.log(
        `   🔄 Fallback ENTRY ${id}: type=${isTargetType}, direction=${canUseDirection}, floors=${canUseFloors}`
      );

      return isTargetType && canUseDirection && canUseFloors;
    });

    if (fallbackConnectors.length > 0) {
      console.log(`✅ Fallback olarak ${fallbackTransport} ENTRY ile ${fallbackConnectors.length} connector bulundu`);
      startFloorConnectors.push(...fallbackConnectors);
    } else {
      console.error(`❌ No ${requiredDirection} ENTRY connectors available on start floor ${startFloor}`);
      return [];
    }
  }

  console.log(`📍 Available ENTRY connectors on start floor:`, startFloorConnectors);

  // EN YAKIN ENTRY CONNECTOR'U BUL
  let closestConnector = null;
  let shortestDistanceToConnector = Infinity;

  for (const connectorId of startFloorConnectors) {
    // Başlangıç noktasından bu ENTRY connector'a olan mesafeyi hesapla
    const pathToConnector = singleFloorDijkstra(startId, connectorId, graph);

    if (pathToConnector.length === 0) {
      console.log(`❌ Cannot reach ENTRY connector ${connectorId} from start`);
      continue;
    }

    const distanceToConnector = calculatePathDistance(pathToConnector, graph);
    console.log(`📏 Distance to ENTRY ${connectorId}: ${distanceToConnector.toFixed(1)}m`);

    if (distanceToConnector < shortestDistanceToConnector) {
      shortestDistanceToConnector = distanceToConnector;
      closestConnector = connectorId;
    }
  }

  if (!closestConnector) {
    console.error(`❌ No reachable ENTRY connectors found on start floor ${startFloor}`);
    return [];
  }

  const closestProps = getConnectorProperties(closestConnector, graph);
  console.log(`✅ Selected CLOSEST ENTRY connector: ${closestConnector}`);
  console.log(`   BaseName: ${closestProps.baseName}, Distance: ${shortestDistanceToConnector.toFixed(1)}m`);

  // En yakın ENTRY connector ile hedefe kadar olan rotayı hesapla
  const fullPath = findPathThroughConnectorEntryExit(startId, endId, closestConnector, graph, allGeoData);

  if (fullPath.length === 0) {
    console.error(`❌ Could not find complete path through closest ENTRY connector ${closestConnector}`);

    // Fallback: Eğer en yakın connector ile rota bulunamazsa, diğerlerini de dene
    console.log(`🔄 Trying fallback with other ENTRY connectors...`);

    let bestPath = [];
    let minTotalDistance = Infinity;

    for (const startConnector of startFloorConnectors) {
      if (startConnector === closestConnector) continue; // Zaten denedik

      console.log(`🔍 Fallback testing ENTRY connector: ${startConnector}`);
      const fallbackPath = findPathThroughConnectorEntryExit(startId, endId, startConnector, graph, allGeoData);

      if (fallbackPath.length === 0) continue;

      const totalDist = calculatePathDistance(fallbackPath, graph);
      if (totalDist < minTotalDistance) {
        minTotalDistance = totalDist;
        bestPath = fallbackPath;
        const props = getConnectorProperties(startConnector, graph);
        console.log(`✅ Fallback best path found via ENTRY ${props.baseName}! Total: ${totalDist.toFixed(1)}m`);
      }
    }

    return bestPath;
  }

  const totalDistance = calculatePathDistance(fullPath, graph);
  console.log(`🎯 Path found through CLOSEST ENTRY connector, total distance: ${totalDistance.toFixed(1)}m`);

  return fullPath;
}

/**
 * Path'in toplam mesafesini hesaplar
 * @param {Array} path - Node ID'leri dizisi
 * @param {Object} graph - Graph objesi
 * @returns {number} Toplam mesafe
 */
export function calculatePathDistance(path, graph) {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];

    // Graph'taki edge'i bul
    const edge = graph[u]?.neighbors.find((e) => e.to === v);
    if (edge) {
      totalDistance += edge.weight;
    } else {
      // Virtual edge (floor connector geçişi)
      const uFloor = graph[u]?.floor;
      const vFloor = graph[v]?.floor;
      if (uFloor !== vFloor) {
        totalDistance += 10; // Floor değişimi maliyeti
      }
    }
  }
  return totalDistance;
}

/**
 * Connector'ın özelliklerini parse eder
 * @param {string} connectorId - Connector ID'si
 * @param {Object} graph - Graph objesi
 * @returns {Object} Connector özellikleri
 */
export function getConnectorProperties(connectorId, graph) {
  const node = graph[connectorId];
  if (!node) return null;

  // GeoJSON'dan gelen direction'ı direkt kullan
  const direction = node.direction;

  // ID'den sadece gerekli bilgileri parse et
  const parts = connectorId.split("-");
  const connectorType = node.connector_type; // default
  const baseName = node.baseName;
  let nodeType = null;

  // entry/exit kontrolü
  if (parts.includes("entry")) {
    nodeType = "entry";
  } else if (parts.includes("exit")) {
    nodeType = "exit";
  }

  return {
    direction: direction, // GeoJSON'dan gelen değer
    baseName: baseName,
    connectorType: connectorType,
    nodeType: nodeType,
    originalId: node.originalId,
    floor: node.floor,
  };
}

/**
 * Connector'ın direction açısından kullanılabilir olup olmadığını kontrol eder
 * @param {Object} connectorProps - Connector özellikleri
 * @param {string} requiredDirection - Gerekli yön ("up", "down", "bidirectional")
 * @returns {boolean} Kullanılabilir mi?
 */
export function canUseConnectorDirection(connectorProps, requiredDirection) {
  // Bidirectional connector her yöne gidebilir
  if (connectorProps.direction === "bidirectional") {
    return true;
  }

  // Diğerleri sadece kendi yönüne
  return connectorProps.direction === requiredDirection;
}

/**
 * Connector'ın floor range kontrolü
 * @param {string} connectorId - Connector ID'si
 * @param {number} currentFloor - Mevcut kat
 * @param {number} targetFloor - Hedef kat
 * @param {Object} graph - Graph objesi
 * @param {Object} allGeoData - GeoJSON verileri
 * @returns {boolean} Kullanılabilir mi?
 */
export function canUseConnectorFloors(connectorId, currentFloor, targetFloor, graph, allGeoData) {
  const node = graph[connectorId];
  if (!node) return false;

  // Mevcut kodunuzdaki mantığı kullanarak feature'ı bulalım
  const connectorFeature = Object.values(allGeoData).find((floorData) =>
    floorData.features.some((f) => f.properties.id === node.originalId)
  );

  if (!connectorFeature) return true;

  const feature = connectorFeature.features.find((f) => f.properties.id === node.originalId);
  if (!feature) return true;

  const fromFloor = parseInt(feature.properties.from || currentFloor);
  const toFloor = parseInt(feature.properties.to || currentFloor);

  // Sadece şunları kontrol et:
  // 1. Bu escalator mevcut katımdan başlıyor mu?
  // 2. Bu escalator hedefe doğru bir adım atıyor mu?

  const startsFromCurrentFloor = currentFloor === fromFloor || currentFloor === toFloor;

  // Doğru yön kontrolü: Bir sonraki kat hedef yönünde mi?
  const nextFloor = currentFloor === fromFloor ? toFloor : fromFloor;
  const isCorrectDirection =
    (targetFloor > currentFloor && nextFloor > currentFloor) || // Yukarı gidiyoruz
    (targetFloor < currentFloor && nextFloor < currentFloor); // Aşağı gidiyoruz

  console.log(
    `   Floor check: ${connectorId} | from=${fromFloor}, to=${toFloor} | current=${currentFloor}, target=${targetFloor} | starts=${startsFromCurrentFloor}, direction=${isCorrectDirection}`
  );

  return startsFromCurrentFloor && isCorrectDirection;
}

/**
 * Entry/Exit mantığı ile path finding
 * @param {string} startId - Başlangıç ID'si
 * @param {string} endId - Hedef ID'si
 * @param {string} startEntryConnector - Başlangıç ENTRY connector'ı
 * @param {Object} graph - Graph objesi
 * @param {Object} allGeoData - GeoJSON verileri
 * @returns {Array} Tam path
 */
export function findPathThroughConnectorEntryExit(startId, endId, startEntryConnector, graph, allGeoData) {
  console.log(`🚀 Finding path through ENTRY connector: ${startEntryConnector}`);

  // 1. Başlangıçtan ENTRY connector'a yürü
  let path = singleFloorDijkstra(startId, startEntryConnector, graph);
  if (path.length === 0) {
    console.log(`❌ Cannot reach ENTRY connector ${startEntryConnector} from start`);
    return [];
  }

  let currentConnector = startEntryConnector;
  let currentFloor = graph[startEntryConnector].floor;
  const endFloor = graph[endId].floor;

  // İlk connector'ın transport tipini al ve koru
  const initialProps = getConnectorProperties(startEntryConnector, graph);
  let selectedTransportType = initialProps.connectorType;
  const direction = endFloor > currentFloor ? "up" : "down";

  console.log(`🚀 Using transport: ${selectedTransportType}, direction: ${direction}`);
  console.log(`🚀 Initial ENTRY baseName: ${initialProps.baseName}`);

  while (currentFloor !== endFloor) {
    const nextFloor = currentFloor < endFloor ? currentFloor + 1 : currentFloor - 1;

    // Mevcut ENTRY connector'ın baseName'ini al
    const currentProps = getConnectorProperties(currentConnector, graph);
    const currentBaseName = currentProps.baseName;

    console.log(`\n=== KAT DEĞİŞİMİ: ${currentFloor} → ${nextFloor} ===`);
    console.log(`📍 Current ENTRY: ${currentConnector}`);
    console.log(`📍 Current baseName: ${currentBaseName}`);

    // Aynı escalator'ın sonraki kattaki EXIT'ini ara
    const baseNameParts = currentBaseName.replace(/-(up|down)$/, ""); // Son -up veya -down'ı çıkar
    const targetExitConnectorId = `f${nextFloor}-${baseNameParts}-${direction}-exit-node`;
    console.log(`🎯 Looking for matching EXIT: ${targetExitConnectorId}`);

    let exitConnector = null;
    if (graph[targetExitConnectorId]) {
      exitConnector = targetExitConnectorId;
      console.log(`✅ Found expected EXIT: ${exitConnector}`);
    } else {
      console.log(`❌ Expected EXIT not found, searching alternatives...`);

      // Alternatif: Aynı baseName'li herhangi bir EXIT ara
      const alternativeExits = Object.keys(graph).filter((id) => {
        const node = graph[id];
        if (node.type !== "floor-connector-node" || node.floor !== nextFloor) {
          return false;
        }

        const props = getConnectorProperties(id, graph);
        return (
          props.baseName === currentBaseName &&
          props.nodeType === "exit" &&
          props.connectorType === selectedTransportType &&
          canUseConnectorDirection(props, direction)
        );
      });

      console.log(`🔍 Found ${alternativeExits.length} alternative EXIT connectors:`);
      alternativeExits.forEach((id) => {
        const props = getConnectorProperties(id, graph);
        console.log(`   - ${id}: baseName=${props.baseName}, direction=${props.direction}`);
      });

      if (alternativeExits.length === 0) {
        console.log(`❌ No EXIT connector found for baseName: ${currentBaseName}`);
        return [];
      }

      exitConnector = alternativeExits[0];
      console.log(`✅ Selected alternative EXIT: ${exitConnector}`);
    }

    // Kat değişimi - path'e EXIT connector'ı ekle
    path.push(exitConnector);
    currentConnector = exitConnector;
    currentFloor = nextFloor;
    console.log(`🏢 Moved to floor ${currentFloor}, now at EXIT: ${currentConnector}`);

    // Hedef kata ulaştık mı?
    if (currentFloor === endFloor) {
      console.log(`🎯 Reached target floor ${endFloor}`);
      break;
    }

    // ÇOK KATLI GEÇIŞ: Exit'ten sonraki en yakın ENTRY'yi bul
    console.log(`\n--- SONRAKI ESCALATOR ARAMA (Kat ${currentFloor}) ---`);
    console.log(`📍 Current EXIT position: ${currentConnector}`);

    const nextEntryConnectors = Object.keys(graph).filter((id) => {
      const node = graph[id];
      if (node.type !== "floor-connector-node" || node.floor !== currentFloor || id === currentConnector) {
        return false;
      }

      const props = getConnectorProperties(id, graph);
      const isValidEntry =
        props.nodeType === "entry" &&
        props.connectorType === selectedTransportType &&
        canUseConnectorDirection(props, direction) &&
        canUseConnectorFloors(id, currentFloor, endFloor, graph, allGeoData);

      if (isValidEntry) {
        console.log(`   ✓ Valid ENTRY found: ${id} (baseName: ${props.baseName})`);
      }

      return isValidEntry;
    });

    console.log(`\n🔍 TOPLAM ${nextEntryConnectors.length} GEÇERLI ENTRY CONNECTOR BULUNDU:`);
    if (nextEntryConnectors.length === 0) {
      console.log(`❌ No ENTRY connectors found on floor ${currentFloor} for next leg`);
      return [];
    }

    // Tüm ENTRY'lere olan mesafeleri hesapla
    console.log(`\n📏 MESAFE HESAPLAMALARI:`);
    const entryDistances = [];

    for (const entryId of nextEntryConnectors) {
      const entryProps = getConnectorProperties(entryId, graph);
      console.log(`\n   Checking ENTRY: ${entryId}`);
      console.log(`   BaseName: ${entryProps.baseName}`);

      const walkPath = singleFloorDijkstra(currentConnector, entryId, graph);
      if (walkPath.length > 0) {
        const distance = calculatePathDistance(walkPath, graph);
        entryDistances.push({
          id: entryId,
          baseName: entryProps.baseName,
          distance: distance,
          pathLength: walkPath.length,
        });
        console.log(`   ✅ Reachable - Distance: ${distance.toFixed(1)}m, Path nodes: ${walkPath.length}`);
      } else {
        console.log(`   ❌ Not reachable - No path found`);
      }
    }

    if (entryDistances.length === 0) {
      console.log(`❌ No reachable ENTRY connectors found on floor ${currentFloor}`);
      return [];
    }

    // En yakın ENTRY'yi seç
    entryDistances.sort((a, b) => a.distance - b.distance);

    console.log(`\n🏆 MESAFE SIRALAMASI:`);
    entryDistances.forEach((entry, index) => {
      const marker = index === 0 ? "👑 SELECTED" : "   ";
      console.log(`   ${marker} ${entry.id}`);
      console.log(`       BaseName: ${entry.baseName}`);
      console.log(`       Distance: ${entry.distance.toFixed(1)}m`);
      console.log(`       Path nodes: ${entry.pathLength}`);
    });

    const closestEntry = entryDistances[0];
    console.log(`\n✅ SELECTED CLOSEST ENTRY: ${closestEntry.id}`);
    console.log(`   Distance: ${closestEntry.distance.toFixed(1)}m`);
    console.log(`   BaseName: ${closestEntry.baseName}`);

    // EXIT'ten en yakın ENTRY'ye koridordan yürü
    console.log(`\n🚶 Walking from EXIT to ENTRY: ${currentConnector} → ${closestEntry.id}`);
    const corridorWalk = singleFloorDijkstra(currentConnector, closestEntry.id, graph);
    if (corridorWalk.length === 0) {
      console.log(`❌ Cannot walk from EXIT to ENTRY: ${currentConnector} → ${closestEntry.id}`);
      return [];
    }

    console.log(`✅ Corridor walk successful: ${corridorWalk.length} nodes`);
    path = [...path, ...corridorWalk.slice(1)];
    currentConnector = closestEntry.id; // Yeni ENTRY artık mevcut connector

    console.log(`📍 Now positioned at new ENTRY: ${currentConnector}`);
  }

  // Son adım: EXIT connector'dan hedefe yürü
  console.log(`\n🎯 FINAL DESTINATION WALK`);
  console.log(`From: ${currentConnector}`);
  console.log(`To: ${endId}`);

  const finishWalk = singleFloorDijkstra(currentConnector, endId, graph);
  if (finishWalk.length === 0) {
    console.log(`❌ Cannot reach destination from EXIT connector: ${currentConnector} → ${endId}`);
    return [];
  }

  console.log(`✅ Final walk successful: ${finishWalk.length} nodes`);
  path = [...path, ...finishWalk.slice(1)];

  console.log(`\n🎉 COMPLETE PATH FOUND!`);
  console.log(`Total nodes: ${path.length}`);
  console.log(`Total distance: ${calculatePathDistance(path, graph).toFixed(1)}m`);

  return path;
}

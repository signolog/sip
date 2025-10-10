"use client";

import React, { useState, useEffect, useRef } from "react";

const GEOJSON_URLS = {
  0: "/floor-0.geojson",
  1: "/floor-1.geojson",
  2: "/floor-2.geojson",
};

function RouteTestPage() {
  const [allGeoData, setAllGeoData] = useState({});
  const [graph, setGraph] = useState({});
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [isTestingComplete, setIsTestingComplete] = useState(false);
  const [currentTest, setCurrentTest] = useState({ from: "", to: "", index: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [connectorTests, setConnectorTests] = useState([]);

  // YENİ: UI state'leri
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [showAllDoors, setShowAllDoors] = useState(false);
  const [roomDoorMismatch, setRoomDoorMismatch] = useState({ orphanRooms: [], orphanDoors: [] });

  // Senin kodundaki fonksiyonları aynen kopyalıyorum
  function getConnectorProperties(connectorId, graph) {
    const parts = connectorId.split("-");
    let direction = null;
    let baseName = "";

    let workingParts = [...parts];
    if (workingParts[workingParts.length - 1] === "node") {
      workingParts.pop();
    }

    const lastPart = workingParts[workingParts.length - 1];
    if (lastPart === "up") {
      direction = "up";
      baseName = workingParts.slice(1, -1).join("-");
    } else if (lastPart === "down") {
      direction = "down";
      baseName = workingParts.slice(1, -1).join("-");
    } else {
      baseName = workingParts.slice(1).join("-");
    }

    return {
      direction: direction,
      baseName: baseName,
      originalId: connectorId,
      floor: graph[connectorId]?.floor,
    };
  }

  function findMatchingConnector(sourceConnectorId, targetFloor, graph) {
    const sourceProps = getConnectorProperties(sourceConnectorId, graph);

    const matchingConnector = Object.keys(graph).find((connectorId) => {
      const node = graph[connectorId];
      if (node.type !== "floor-connector-node" || node.floor !== targetFloor) {
        return false;
      }

      const connectorProps = getConnectorProperties(connectorId, graph);
      return connectorProps.baseName === sourceProps.baseName && connectorProps.direction === sourceProps.direction;
    });

    return matchingConnector || null;
  }

  function buildMultiFloorGraph(floorData) {
    const graph = {};
    const rooms = [];
    const doors = [];

    // Her kat için ayrı namespace ile graph oluştur
    Object.entries(floorData).forEach(([floor, data]) => {
      const floorPrefix = `f${floor}`;

      data.features.forEach(({ geometry, properties }) => {
        const { type, id, room: roomId } = properties;

        if (geometry && geometry.type === "Point") {
          const [lon, lat] = geometry.coordinates;
          const namespacedId = `${floorPrefix}-${id}`;

          if (type === "door-node" || type === "corridor-node" || type === "floor-connector-node") {
            graph[namespacedId] = {
              coords: [lat, lon],
              neighbors: [],
              floor: parseInt(floor),
              originalId: id,
              type: type,
            };

            if (type === "door-node") {
              doors.push({
                id: namespacedId,
                coords: [lat, lon],
                roomId: `${floorPrefix}-${roomId}`,
                room: roomId, // YENİ: room propertysi
                floor: parseInt(floor),
                originalId: id,
              });
            }
          }
        }
      });

      // Edge'leri ekle (aynı kat içinde)
      data.features.forEach(({ properties }) => {
        const { type, from, to, weight, direction } = properties;
        const namespacedFrom = `${floorPrefix}-${from}`;
        const namespacedTo = `${floorPrefix}-${to}`;

        if ((type === "corridor-edge" || type === "door-connection") && graph[namespacedFrom] && graph[namespacedTo]) {
          graph[namespacedFrom].neighbors.push({ to: namespacedTo, weight, direction, type });
          graph[namespacedTo].neighbors.push({ to: namespacedFrom, weight, direction, type });
        }
      });

      // Room'ları ekle
      data.features.forEach(({ properties }) => {
        if (properties.type === "room") {
          const doorObj = doors.find((d) => d.roomId === `${floorPrefix}-${properties.id}`);
          rooms.push({
            id: `${floorPrefix}-${properties.id}`,
            name: properties.name,
            doorId: doorObj?.originalId || null,
            floor: parseInt(floor),
            originalId: properties.id,
          });
        }
      });
    });

    // Floor connector'ların corridor'lara bağlantısı
    Object.entries(floorData).forEach(([floor, data]) => {
      const floorConnectorsInThisFloor = Object.keys(graph).filter(
        (id) => graph[id].type === "floor-connector-node" && graph[id].floor === parseInt(floor)
      );

      const corridorNodesInThisFloor = Object.keys(graph).filter(
        (id) => graph[id].type === "corridor-node" && graph[id].floor === parseInt(floor)
      );

      floorConnectorsInThisFloor.forEach((connectorId) => {
        const connector = graph[connectorId];
        let closestNode = null;
        let minDistance = Infinity;

        corridorNodesInThisFloor.forEach((nodeId) => {
          const node = graph[nodeId];
          const distance = Math.sqrt(
            Math.pow(connector.coords[0] - node.coords[0], 2) + Math.pow(connector.coords[1] - node.coords[1], 2)
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestNode = nodeId;
          }
        });

        const MAX_CONNECTOR_DISTANCE = 0.01;

        if (closestNode && minDistance <= MAX_CONNECTOR_DISTANCE) {
          graph[connectorId].neighbors.push({
            to: closestNode,
            weight: minDistance * 100000,
            direction: null,
            type: "corridor-connection",
          });

          graph[closestNode].neighbors.push({
            to: connectorId,
            weight: minDistance * 100000,
            direction: null,
            type: "corridor-connection",
          });
        }
      });
    });

    return { graph, rooms, doors };
  }

  function singleFloorDijkstra(startId, endId, graph) {
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

  function findPathThroughConnector(startId, endId, startConnector, graph) {
    let path = singleFloorDijkstra(startId, startConnector, graph);
    if (path.length === 0) return [];

    let currentConnector = startConnector;
    let currentFloor = graph[startConnector].floor;
    const endFloor = graph[endId].floor;

    while (currentFloor !== endFloor) {
      const currentProps = getConnectorProperties(currentConnector, graph);
      const nextFloor = currentFloor < endFloor ? currentFloor + 1 : currentFloor - 1;
      const direction = endFloor > currentFloor ? "up" : "down";
      const upperConnectorId = `f${nextFloor}-${currentProps.baseName}-${direction}-node`;

      if (!graph[upperConnectorId]) {
        const possible = Object.keys(graph).find(
          (id) =>
            graph[id].type === "floor-connector-node" &&
            graph[id].floor === nextFloor &&
            getConnectorProperties(id, graph).direction === direction
        );
        if (!possible) return [];
        path.push(possible);
        currentConnector = possible;
        currentFloor = nextFloor;
      } else {
        path.push(upperConnectorId);
        currentConnector = upperConnectorId;
        currentFloor = nextFloor;
      }

      if (currentFloor === endFloor) break;

      const nextConnector = Object.keys(graph).find(
        (id) =>
          graph[id].type === "floor-connector-node" &&
          graph[id].floor === currentFloor &&
          id !== currentConnector &&
          getConnectorProperties(id, graph).direction === direction
      );
      if (!nextConnector) return [];

      const corridorWalk = singleFloorDijkstra(currentConnector, nextConnector, graph);
      if (corridorWalk.length === 0) return [];
      path = [...path, ...corridorWalk.slice(1)];
      currentConnector = nextConnector;
    }

    const finishWalk = singleFloorDijkstra(currentConnector, endId, graph);
    if (finishWalk.length === 0) return [];
    path = [...path, ...finishWalk.slice(1)];
    return path;
  }

  function calculatePathDistance(path, graph) {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];

      const edge = graph[u]?.neighbors.find((e) => e.to === v);
      if (edge) {
        totalDistance += edge.weight;
      } else {
        const uFloor = graph[u]?.floor;
        const vFloor = graph[v]?.floor;
        if (uFloor !== vFloor) {
          totalDistance += 10;
        }
      }
    }
    return totalDistance;
  }

  function multiFloorDijkstra(startId, endId, graph) {
    const startFloor = graph[startId]?.floor;
    const endFloor = graph[endId]?.floor;

    if (startFloor === endFloor) {
      return singleFloorDijkstra(startId, endId, graph);
    }

    const isGoingUp = endFloor > startFloor;
    const requiredDirection = isGoingUp ? "up" : "down";

    const startFloorConnectors = Object.keys(graph).filter((id) => {
      const node = graph[id];
      if (node.type !== "floor-connector-node" || node.floor !== startFloor) {
        return false;
      }
      const props = getConnectorProperties(id, graph);
      return props.direction === requiredDirection;
    });

    if (startFloorConnectors.length === 0) {
      return [];
    }

    let bestPath = [];
    let minTotalDistance = Infinity;

    for (const startConnector of startFloorConnectors) {
      const fullPath = findPathThroughConnector(startId, endId, startConnector, graph);

      if (fullPath.length === 0) {
        continue;
      }

      const totalDist = calculatePathDistance(fullPath, graph);

      if (totalDist < minTotalDistance) {
        minTotalDistance = totalDist;
        bestPath = fullPath;
      }
    }

    return bestPath;
  }

  function findRoomByName(roomName) {
    if (!roomName) return null;
    return rooms.find((r) => r.name && r.name.toLowerCase().trim() === roomName.toLowerCase().trim());
  }

  // YENİ: Room-Door uyumsuzluklarını kontrol et
  function checkRoomDoorMismatch() {
    const orphanRooms = []; // Kapısı olmayan odalar
    const orphanDoors = []; // Odası olmayan kapılar

    // Kapısı olmayan odalar
    rooms.forEach((room) => {
      const hasDoor = doors.some((door) => door.room === room.originalId && door.floor === room.floor);
      if (!hasDoor) {
        orphanRooms.push(room);
      }
    });

    // Odası olmayan kapılar
    doors.forEach((door) => {
      if (door.room) {
        const hasRoom = rooms.some((room) => room.originalId === door.room && room.floor === door.floor);
        if (!hasRoom) {
          orphanDoors.push(door);
        }
      } else {
        // Room propertysi olmayan kapı
        orphanDoors.push({ ...door, reason: "Room property yok" });
      }
    });

    return { orphanRooms, orphanDoors };
  }

  // GeoJSON dosyalarını yükle
  const loadAllFloors = async () => {
    const floorData = {};

    for (const [floor, url] of Object.entries(GEOJSON_URLS)) {
      try {
        const response = await fetch(url);
        const data = await response.json();
        floorData[floor] = data;
        console.log(`✅ Floor ${floor} yüklendi:`, data.features.length, "feature");
      } catch (err) {
        console.error(`❌ Floor ${floor} yüklenemedi:`, err);
      }
    }

    return floorData;
  };

  // İlk yükleme
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        const floorData = await loadAllFloors();
        setAllGeoData(floorData);

        if (Object.keys(floorData).length > 0) {
          const { graph: g, rooms: r, doors: d } = buildMultiFloorGraph(floorData);
          setGraph(g);
          setRooms(r);
          setDoors(d);

          // Room-Door uyumsuzluklarını kontrol et
          const mismatch = checkRoomDoorMismatch();
          setRoomDoorMismatch(mismatch);

          console.log("📊 Graph oluşturuldu:", {
            nodes: Object.keys(g).length,
            rooms: r.length,
            doors: d.length,
          });
        }
      } catch (error) {
        console.error("❌ Veri yükleme hatası:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Room-Door uyumsuzluklarını yeniden hesapla
  useEffect(() => {
    if (rooms.length > 0 && doors.length > 0) {
      const mismatch = checkRoomDoorMismatch();
      setRoomDoorMismatch(mismatch);
    }
  }, [rooms, doors]);

  function testRoute(fromRoom, toRoom) {
    if (!fromRoom || !toRoom) {
      return { success: false, error: "Room not found", distance: 0, path: [] };
    }

    const startDoorId = `f${fromRoom.floor}-${fromRoom.doorId}`;
    const endDoorId = `f${toRoom.floor}-${toRoom.doorId}`;

    if (!graph[startDoorId] || !graph[endDoorId]) {
      return { success: false, error: "Door node not found in graph", distance: 0, path: [] };
    }

    try {
      const path = multiFloorDijkstra(startDoorId, endDoorId, graph);

      if (path.length === 0) {
        return { success: false, error: "No route found", distance: 0, path: [] };
      }

      const distance = calculatePathDistance(path, graph);
      const floorChanges = path.filter((nodeId, i) => {
        if (i === 0) return false;
        return graph[nodeId]?.floor !== graph[path[i - 1]]?.floor;
      }).length;

      return {
        success: true,
        error: null,
        distance: distance,
        path: path,
        floorChanges: floorChanges,
      };
    } catch (error) {
      return {
        success: false,
        error: `Algorithm error: ${error.message}`,
        distance: 0,
        path: [],
      };
    }
  }

  const runAllTests = async () => {
    setTestResults([]);
    setConnectorTests([]);
    setIsTestingComplete(false);

    // 1. Önce connector testlerini yap
    console.log("🔗 Connector connectivity testleri başlıyor...");
    const connectorTestResults = await runConnectorTests();
    setConnectorTests(connectorTestResults);

    // 2. Sonra normal rota testlerini yap
    console.log("🚀 Normal rota testleri başlıyor...");
    const results = [];
    const total = rooms.length * rooms.length;
    let index = 0;

    for (let i = 0; i < rooms.length; i++) {
      for (let j = 0; j < rooms.length; j++) {
        const fromRoom = rooms[i];
        const toRoom = rooms[j];

        setCurrentTest({
          from: fromRoom.name,
          to: toRoom.name,
          index: index + 1,
          total: total,
        });

        const result = testRoute(fromRoom, toRoom);

        results.push({
          from: fromRoom.name,
          to: toRoom.name,
          fromFloor: fromRoom.floor,
          toFloor: toRoom.floor,
          fromDoorId: fromRoom.doorId,
          toDoorId: toRoom.doorId,
          ...result,
        });

        index++;

        // UI güncellenmesi için kısa bekleme
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    setTestResults(results);
    setIsTestingComplete(true);
    setCurrentTest({ from: "", to: "", index: 0, total: 0 });
  };

  // Connector connectivity testleri
  const runConnectorTests = async () => {
    const connectors = Object.keys(graph).filter((id) => graph[id].type === "floor-connector-node");
    const testResults = [];

    console.log(`🔗 ${connectors.length} connector test ediliyor...`);

    for (const connectorId of connectors) {
      const connector = graph[connectorId];
      const connectorProps = getConnectorProperties(connectorId, graph);

      // SADECE AYNI KATTAKI NODE'LARI AL
      const sameFloorNodes = Object.keys(graph).filter(
        (id) => graph[id].floor === connector.floor && id !== connectorId
      );

      // SADECE AYNI KATTAKI CONNECTOR'LARI AL
      const sameFloorConnectors = Object.keys(graph).filter(
        (id) => graph[id].type === "floor-connector-node" && graph[id].floor === connector.floor && id !== connectorId
      );

      // 1. Bu connector'dan aynı kattaki diğer node'lara gidebiliyor mu?
      const reachableFromConnector = [];
      const unreachableFromConnector = [];

      // 2. Bu connector'a aynı kattaki diğer node'lardan gidilebiliyor mu?
      const canReachConnector = [];
      const cannotReachConnector = [];

      // 3. Bu connector'dan aynı kattaki diğer connector'lara gidebiliyor mu?
      const reachableConnectors = [];
      const unreachableConnectors = [];

      // Aynı kattaki tüm node'ları test et
      for (const nodeId of sameFloorNodes) {
        // Connector'dan node'a gidiş testi
        try {
          const pathFromConnector = singleFloorDijkstra(connectorId, nodeId, graph);
          if (pathFromConnector.length > 0) {
            reachableFromConnector.push(nodeId);
          } else {
            unreachableFromConnector.push(nodeId);
          }
        } catch (e) {
          unreachableFromConnector.push(nodeId);
        }

        // Node'dan connector'a gidiş testi
        try {
          const pathToConnector = singleFloorDijkstra(nodeId, connectorId, graph);
          if (pathToConnector.length > 0) {
            canReachConnector.push(nodeId);
          } else {
            cannotReachConnector.push(nodeId);
          }
        } catch (e) {
          cannotReachConnector.push(nodeId);
        }
      }

      // Aynı kattaki connector'ları test et
      for (const otherConnectorId of sameFloorConnectors) {
        try {
          const pathBetweenConnectors = singleFloorDijkstra(connectorId, otherConnectorId, graph);
          if (pathBetweenConnectors.length > 0) {
            reachableConnectors.push(otherConnectorId);
          } else {
            unreachableConnectors.push(otherConnectorId);
          }
        } catch (e) {
          unreachableConnectors.push(otherConnectorId);
        }
      }

      testResults.push({
        connectorId,
        floor: connector.floor,
        baseName: connectorProps.baseName,
        direction: connectorProps.direction,
        reachableFromConnector: reachableFromConnector.length,
        unreachableFromConnector: unreachableFromConnector.length,
        canReachConnector: canReachConnector.length,
        cannotReachConnector: cannotReachConnector.length,
        reachableConnectors: reachableConnectors.length,
        unreachableConnectors: unreachableConnectors.length,
        totalNodes: sameFloorNodes.length, // aynı kattaki node'lar
        totalConnectors: sameFloorConnectors.length, // aynı kattaki connector'lar
        unreachableFromConnectorDetails: unreachableFromConnector,
        cannotReachConnectorDetails: cannotReachConnector,
        unreachableConnectorsDetails: unreachableConnectors,
      });

      // İlerleme için kısa bekleme
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return testResults;
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ fontSize: "24px" }}>🔄 GeoJSON dosyaları yükleniyor...</div>
        <div style={{ fontSize: "16px", color: "#666" }}>
          {Object.values(GEOJSON_URLS)
            .map((url) => url.split("/").pop())
            .join(", ")}
        </div>
      </div>
    );
  }

  const successfulRoutes = testResults.filter((r) => r.success);
  const failedRoutes = testResults.filter((r) => !r.success);
  const sameFloorRoutes = testResults.filter((r) => r.success && r.fromFloor === r.toFloor);
  const crossFloorRoutes = testResults.filter((r) => r.success && r.fromFloor !== r.toFloor);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>🧪 Rotalama Test Sistemi</h1>

      <div style={{ marginBottom: "20px" }}>
        <h2>📊 Sistem Durumu</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <div style={{ padding: "15px", background: "#e3f2fd", borderRadius: "8px", border: "2px solid #2196f3" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#1976d2" }}>🏢 Toplam Oda</h3>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{rooms.length}</div>
          </div>
          <div style={{ padding: "15px", background: "#e8f5e8", borderRadius: "8px", border: "2px solid #4caf50" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#388e3c" }}>🚪 Toplam Kapı</h3>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{doors.length}</div>
          </div>
          <div style={{ padding: "15px", background: "#fff3e0", borderRadius: "8px", border: "2px solid #ff9800" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#f57c00" }}>🔗 Graph Node</h3>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{Object.keys(graph).length}</div>
          </div>
          <div style={{ padding: "15px", background: "#fce4ec", borderRadius: "8px", border: "2px solid #e91e63" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#c2185b" }}>🧪 Toplam Test</h3>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{rooms.length * rooms.length}</div>
          </div>
        </div>
      </div>

      {/* YENİ: Room-Door Uyumsuzluk Bildirimleri */}
      {(roomDoorMismatch.orphanRooms.length > 0 || roomDoorMismatch.orphanDoors.length > 0) && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            background: "#fff3cd",
            borderRadius: "8px",
            border: "2px solid #ffc107",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#856404" }}>⚠️ Room-Door Uyumsuzlukları</h3>

          {roomDoorMismatch.orphanRooms.length > 0 && (
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#d63384" }}>
                🚪❌ Kapısı Olmayan Odalar ({roomDoorMismatch.orphanRooms.length} adet):
              </h4>
              <div
                style={{
                  fontSize: "14px",
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "5px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {roomDoorMismatch.orphanRooms.map((room, i) => (
                  <div key={i} style={{ marginBottom: "5px" }}>
                    <strong>{room.name}</strong> (ID: {room.originalId}, Kat: {room.floor})
                  </div>
                ))}
              </div>
            </div>
          )}

          {roomDoorMismatch.orphanDoors.length > 0 && (
            <div>
              <h4 style={{ margin: "0 0 10px 0", color: "#d63384" }}>
                🏢❌ Odası Olmayan/Tanımsız Kapılar ({roomDoorMismatch.orphanDoors.length} adet):
              </h4>
              <div
                style={{
                  fontSize: "14px",
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "5px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {roomDoorMismatch.orphanDoors.map((door, i) => (
                  <div key={i} style={{ marginBottom: "5px" }}>
                    <strong>{door.originalId}</strong>
                    {door.room ? ` → Room: ${door.room}` : " → Room property yok"}
                    (Kat: {door.floor}){door.reason && <span style={{ color: "#dc3545" }}> - {door.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h2>🏪 Mevcut Odalar</h2>
        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={() => setShowAllRooms(!showAllRooms)}
            style={{
              padding: "8px 16px",
              background: showAllRooms ? "#f44336" : "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showAllRooms ? `🔽 Sadece İlk 5'ini Göster` : `📋 Tümünü Göster (${rooms.length})`}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "10px" }}>
          {(showAllRooms ? rooms : rooms.slice(0, 5)).map((room) => (
            <div
              key={room.id}
              style={{
                padding: "10px",
                background: "#f5f5f5",
                borderRadius: "5px",
                border: "1px solid #ddd",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>{room.name}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                Kat: {room.floor} | Door ID: {room.doorId || "❌ N/A"}
              </div>
            </div>
          ))}
        </div>
        {!showAllRooms && rooms.length > 5 && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#f0f0f0",
              borderRadius: "5px",
              textAlign: "center",
              fontSize: "14px",
              color: "#666",
            }}
          >
            ... ve {rooms.length - 5} oda daha
          </div>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h2>🚪 Mevcut Kapılar</h2>
        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={() => setShowAllDoors(!showAllDoors)}
            style={{
              padding: "8px 16px",
              background: showAllDoors ? "#f44336" : "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showAllDoors ? `🔽 Sadece İlk 5'ini Göster` : `📋 Tümünü Göster (${doors.length})`}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
          {(showAllDoors ? doors : doors.slice(0, 5)).map((door) => (
            <div
              key={door.id}
              style={{
                padding: "10px",
                background: "#f8f9fa",
                borderRadius: "5px",
                border: "1px solid #dee2e6",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>🚪 {door.originalId}</div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "3px" }}>
                Kat: {door.floor} | Room: {door.room || "❌ Belirtilmemiş"}
              </div>
              <div style={{ fontSize: "11px", color: "#999" }}>
                Koordinat: [{door.coords[0].toFixed(6)}, {door.coords[1].toFixed(6)}]
              </div>
            </div>
          ))}
        </div>
        {!showAllDoors && doors.length > 5 && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#f0f0f0",
              borderRadius: "5px",
              textAlign: "center",
              fontSize: "14px",
              color: "#666",
            }}
          >
            ... ve {doors.length - 5} kapı daha
          </div>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={runAllTests}
          disabled={(!isTestingComplete && testResults.length > 0) || rooms.length === 0}
          style={{
            padding: "15px 30px",
            fontSize: "16px",
            background: rooms.length === 0 ? "#ccc" : "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: rooms.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {rooms.length === 0
            ? "Veri Yok - Test Edilemez"
            : !isTestingComplete && testResults.length > 0
            ? "Test Devam Ediyor..."
            : "🚀 Tüm Rotaları Test Et"}
        </button>
      </div>

      {!isTestingComplete && currentTest.total > 0 && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            background: "#fff3e0",
            borderRadius: "8px",
            border: "2px solid #ff9800",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", color: "#f57c00" }}>🔄 Test Devam Ediyor</h3>
          <div style={{ marginBottom: "10px" }}>
            <strong>{currentTest.from}</strong> → <strong>{currentTest.to}</strong>
          </div>
          <div style={{ background: "#e0e0e0", borderRadius: "10px", height: "20px", overflow: "hidden" }}>
            <div
              style={{
                background: "#ff9800",
                height: "100%",
                width: `${(currentTest.index / currentTest.total) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ marginTop: "5px", fontSize: "14px" }}>
            {currentTest.index} / {currentTest.total} ({Math.round((currentTest.index / currentTest.total) * 100)}%)
          </div>
        </div>
      )}

      {connectorTests.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2>🔗 Connector Connectivity Testleri</h2>
          <div
            style={{
              maxHeight: "600px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Connector</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Kat</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Tür</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Gidebilir</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Gelemez</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Gelir</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Gelemez</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>
                    Aynı Kat Connector
                  </th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {connectorTests.map((test, i) => {
                  const outgoingHealthy = test.unreachableFromConnector === 0;
                  const incomingHealthy = test.cannotReachConnector === 0;
                  const connectorHealthy = test.unreachableConnectors === 0;
                  const overallHealthy = outgoingHealthy && incomingHealthy && connectorHealthy;

                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #eee",
                        background: overallHealthy ? "#f8fff8" : "#fff8f8",
                      }}
                    >
                      <td style={{ padding: "10px", borderRight: "1px solid #eee", fontSize: "11px" }}>
                        {test.baseName || "Unknown"}-{test.direction || "None"}
                      </td>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{test.floor}</td>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee", fontSize: "10px" }}>
                        {test.direction ? `${test.direction.toUpperCase()}` : "NONE"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderRight: "1px solid #eee",
                          color: test.unreachableFromConnector === 0 ? "#4caf50" : "#f44336",
                          fontWeight: "bold",
                        }}
                      >
                        {test.reachableFromConnector}/{test.totalNodes}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderRight: "1px solid #eee",
                          color: test.unreachableFromConnector === 0 ? "#4caf50" : "#f44336",
                        }}
                      >
                        {test.unreachableFromConnector}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderRight: "1px solid #eee",
                          color: test.cannotReachConnector === 0 ? "#4caf50" : "#f44336",
                          fontWeight: "bold",
                        }}
                      >
                        {test.canReachConnector}/{test.totalNodes}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderRight: "1px solid #eee",
                          color: test.cannotReachConnector === 0 ? "#4caf50" : "#f44336",
                        }}
                      >
                        {test.cannotReachConnector}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          borderRight: "1px solid #eee",
                          color: test.unreachableConnectors === 0 ? "#4caf50" : "#f44336",
                          fontWeight: "bold",
                        }}
                      >
                        {test.reachableConnectors}/{test.totalConnectors}
                      </td>
                      <td style={{ padding: "10px" }}>
                        {overallHealthy ? (
                          <span style={{ color: "#4caf50", fontWeight: "bold" }}>✅ SAĞLAM</span>
                        ) : (
                          <span style={{ color: "#f44336", fontWeight: "bold" }}>❌ SORUNLU</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Connector test özeti */}
          <div
            style={{
              marginTop: "15px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "10px",
            }}
          >
            <div
              style={{
                padding: "15px",
                background:
                  connectorTests.filter((t) => t.unreachableFromConnector === 0 && t.cannotReachConnector === 0)
                    .length === connectorTests.length
                    ? "#e8f5e8"
                    : "#ffebee",
                borderRadius: "8px",
                border:
                  "2px solid " +
                  (connectorTests.filter((t) => t.unreachableFromConnector === 0 && t.cannotReachConnector === 0)
                    .length === connectorTests.length
                    ? "#4caf50"
                    : "#f44336"),
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px 0",
                  color:
                    connectorTests.filter((t) => t.unreachableFromConnector === 0 && t.cannotReachConnector === 0)
                      .length === connectorTests.length
                      ? "#388e3c"
                      : "#d32f2f",
                }}
              >
                🔗 Genel Connectivity
              </h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {connectorTests.filter((t) => t.unreachableFromConnector === 0 && t.cannotReachConnector === 0).length}/
                {connectorTests.length}
              </div>
              <div style={{ fontSize: "12px" }}>Sağlam connector</div>
            </div>

            <div style={{ padding: "15px", background: "#e3f2fd", borderRadius: "8px", border: "2px solid #2196f3" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#1976d2" }}>➡️ Giden Bağlantılar</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {connectorTests.filter((t) => t.unreachableFromConnector === 0).length}/{connectorTests.length}
              </div>
              <div style={{ fontSize: "12px" }}>Tüm noktalara gidebilir</div>
            </div>

            <div style={{ padding: "15px", background: "#f3e5f5", borderRadius: "8px", border: "2px solid #9c27b0" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#7b1fa2" }}>⬅️ Gelen Bağlantılar</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {connectorTests.filter((t) => t.cannotReachConnector === 0).length}/{connectorTests.length}
              </div>
              <div style={{ fontSize: "12px" }}>Tüm noktalardan erişilebilir</div>
            </div>

            <div style={{ padding: "15px", background: "#fff3e0", borderRadius: "8px", border: "2px solid #ff9800" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#f57c00" }}>🔄 Aynı Kat Connector'lar</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {connectorTests.filter((t) => t.unreachableConnectors === 0).length}/{connectorTests.length}
              </div>
              <div style={{ fontSize: "12px" }}>Aynı kattaki diğer connector'lara erişebilir</div>
            </div>
          </div>

          {/* Sorunlu connector'ların detayları */}
          {connectorTests.some(
            (t) => t.unreachableFromConnector > 0 || t.cannotReachConnector > 0 || t.unreachableConnectors > 0
          ) && (
            <div
              style={{
                marginTop: "15px",
                padding: "15px",
                background: "#fff8f8",
                borderRadius: "8px",
                border: "1px solid #f44336",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", color: "#d32f2f" }}>🚨 Sorunlu Connector Detayları</h4>
              {connectorTests
                .filter(
                  (t) => t.unreachableFromConnector > 0 || t.cannotReachConnector > 0 || t.unreachableConnectors > 0
                )
                .map((test, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: "10px",
                      padding: "10px",
                      background: "#fff",
                      borderRadius: "5px",
                      fontSize: "12px",
                    }}
                  >
                    <strong>
                      {test.baseName || "Unknown"}-{test.direction || "None"} (Kat {test.floor})
                    </strong>
                    {test.unreachableFromConnector > 0 && (
                      <div style={{ color: "#f44336" }}>
                        • Gidemiyor: {test.unreachableFromConnector} node (
                        {test.unreachableFromConnectorDetails.slice(0, 3).join(", ")}
                        {test.unreachableFromConnectorDetails.length > 3 ? "..." : ""})
                      </div>
                    )}
                    {test.cannotReachConnector > 0 && (
                      <div style={{ color: "#f44336" }}>
                        • Gelemiyor: {test.cannotReachConnector} node (
                        {test.cannotReachConnectorDetails.slice(0, 3).join(", ")}
                        {test.cannotReachConnectorDetails.length > 3 ? "..." : ""})
                      </div>
                    )}
                    {test.unreachableConnectors > 0 && (
                      <div style={{ color: "#f44336" }}>
                        • Aynı kat connector erişimi yok: {test.unreachableConnectors} adet (
                        {test.unreachableConnectorsDetails
                          .slice(0, 2)
                          .map((id) => getConnectorProperties(id, graph).baseName || id)
                          .join(", ")}
                        {test.unreachableConnectorsDetails.length > 2 ? "..." : ""})
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {isTestingComplete && (
        <div style={{ marginBottom: "20px" }}>
          <h2>📈 Test Sonuçları</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <div style={{ padding: "15px", background: "#e8f5e8", borderRadius: "8px", border: "2px solid #4caf50" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#388e3c" }}>✅ Başarılı</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{successfulRoutes.length}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                {testResults.length > 0 ? Math.round((successfulRoutes.length / testResults.length) * 100) : 0}%
              </div>
            </div>
            <div style={{ padding: "15px", background: "#ffebee", borderRadius: "8px", border: "2px solid #f44336" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#d32f2f" }}>❌ Başarısız</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{failedRoutes.length}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                {testResults.length > 0 ? Math.round((failedRoutes.length / testResults.length) * 100) : 0}%
              </div>
            </div>
            <div style={{ padding: "15px", background: "#e3f2fd", borderRadius: "8px", border: "2px solid #2196f3" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#1976d2" }}>🏢 Aynı Kat</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{sameFloorRoutes.length}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Başarılı olan</div>
            </div>
            <div style={{ padding: "15px", background: "#f3e5f5", borderRadius: "8px", border: "2px solid #9c27b0" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#7b1fa2" }}>🔄 Kat Değişimi</h3>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>{crossFloorRoutes.length}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Başarılı olan</div>
            </div>
          </div>
        </div>
      )}

      {failedRoutes.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ color: "#d32f2f" }}>❌ Başarısız Rotalar ({failedRoutes.length} adet)</h2>
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Başlangıç</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Hedef</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Kat</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Door ID</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Hata</th>
                </tr>
              </thead>
              <tbody>
                {failedRoutes.map((result, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{result.from}</td>
                    <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{result.to}</td>
                    <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>
                      {result.fromFloor} → {result.toFloor}
                    </td>
                    <td style={{ padding: "10px", borderRight: "1px solid #eee", fontSize: "11px" }}>
                      {result.fromDoorId} → {result.toDoorId}
                    </td>
                    <td style={{ padding: "10px", color: "#d32f2f", fontSize: "12px" }}>{result.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {crossFloorRoutes.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ color: "#388e3c" }}>🔄 Çapraz Kat Rotaları ({crossFloorRoutes.length} adet)</h2>
          <div
            style={{
              maxHeight: "500px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Başlangıç</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Hedef</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Kat</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Mesafe</th>
                  <th style={{ padding: "12px", textAlign: "left", borderRight: "1px solid #ddd" }}>Kat Değişimi</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Rota Uzunluğu</th>
                </tr>
              </thead>
              <tbody>
                {crossFloorRoutes
                  .sort((a, b) => b.distance - a.distance)
                  .map((result, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{result.from}</td>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{result.to}</td>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>
                        <span
                          style={{
                            padding: "2px 6px",
                            background: "#e3f2fd",
                            borderRadius: "3px",
                            fontSize: "12px",
                          }}
                        >
                          {result.fromFloor} → {result.toFloor}
                        </span>
                      </td>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{result.distance.toFixed(1)}m</td>
                      <td style={{ padding: "10px", borderRight: "1px solid #eee" }}>{result.floorChanges || 0}</td>
                      <td style={{ padding: "10px" }}>{result.path.length} nokta</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {testResults.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2>📊 Detaylı İstatistikler</h2>
          <div
            style={{
              padding: "20px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "15px" }}>
              <div>
                <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>📏 Mesafe Dağılımı</h4>
                <div style={{ fontSize: "14px" }}>
                  <div>
                    En Kısa:{" "}
                    {successfulRoutes.length > 0 ? Math.min(...successfulRoutes.map((r) => r.distance)).toFixed(1) : 0}m
                  </div>
                  <div>
                    En Uzun:{" "}
                    {successfulRoutes.length > 0 ? Math.max(...successfulRoutes.map((r) => r.distance)).toFixed(1) : 0}m
                  </div>
                  <div>
                    Ortalama:{" "}
                    {successfulRoutes.length > 0
                      ? (successfulRoutes.reduce((sum, r) => sum + r.distance, 0) / successfulRoutes.length).toFixed(1)
                      : 0}
                    m
                  </div>
                </div>
              </div>
              <div>
                <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>❌ Hata Türleri</h4>
                <div style={{ fontSize: "14px" }}>
                  {Object.entries(
                    failedRoutes.reduce((acc, r) => {
                      acc[r.error] = (acc[r.error] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([error, count]) => (
                    <div key={error} style={{ marginBottom: "2px" }}>
                      <strong>{count}</strong>: {error}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>🏢 Kat Bazında Başarı</h4>
                <div style={{ fontSize: "14px" }}>
                  {Object.keys(GEOJSON_URLS).map((floor) => {
                    const floorNum = parseInt(floor);
                    const floorTests = testResults.filter((r) => r.fromFloor === floorNum || r.toFloor === floorNum);
                    const floorSuccess = floorTests.filter((r) => r.success);
                    return (
                      <div key={floor}>
                        Kat {floor}: {floorSuccess.length}/{floorTests.length}
                        {floorTests.length > 0
                          ? ` (${Math.round((floorSuccess.length / floorTests.length) * 100)}%)`
                          : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>🔄 Kat Değişimi İstatistikleri</h4>
                <div style={{ fontSize: "14px" }}>
                  <div>Tek kat içi: {sameFloorRoutes.length}</div>
                  <div>Çapraz kat: {crossFloorRoutes.length}</div>
                  {crossFloorRoutes.length > 0 && (
                    <>
                      <div>
                        Ort. kat değişimi:{" "}
                        {(
                          crossFloorRoutes.reduce((sum, r) => sum + r.floorChanges, 0) / crossFloorRoutes.length
                        ).toFixed(1)}
                      </div>
                      <div>Max kat değişimi: {Math.max(...crossFloorRoutes.map((r) => r.floorChanges))}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "40px", padding: "20px", background: "#e8f5e8", borderRadius: "8px" }}>
        <h3 style={{ margin: "0 0 15px 0", color: "#388e3c" }}>💡 Test Sonucu Yorumu</h3>
        <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
          {isTestingComplete ? (
            <div>
              <p>
                <strong>📊 Genel Durum:</strong> {testResults.length} testin {successfulRoutes.length} tanesi başarılı.
                ({Math.round((successfulRoutes.length / testResults.length) * 100)}% başarı oranı)
              </p>

              {/* Room-Door uyumsuzluk durumu */}
              {(roomDoorMismatch.orphanRooms.length > 0 || roomDoorMismatch.orphanDoors.length > 0) && (
                <p>
                  <strong>🚪 Room-Door Uyumsuzluklar:</strong>
                  {roomDoorMismatch.orphanRooms.length > 0 && ` ${roomDoorMismatch.orphanRooms.length} oda kapısız,`}
                  {roomDoorMismatch.orphanDoors.length > 0 &&
                    ` ${roomDoorMismatch.orphanDoors.length} kapı odası tanımsız.`}
                  Bu durum rota başarısızlıklarına neden olabilir.
                </p>
              )}

              {/* Connector connectivity durumu */}
              {connectorTests.length > 0 && (
                <p>
                  <strong>🔗 Connector Durumu:</strong> {connectorTests.length} connector'dan{" "}
                  {
                    connectorTests.filter((t) => t.unreachableFromConnector === 0 && t.cannotReachConnector === 0)
                      .length
                  }{" "}
                  tanesi tam sağlam.
                  {connectorTests.some((t) => t.unreachableFromConnector > 0 || t.cannotReachConnector > 0) &&
                    ` ${
                      connectorTests.filter((t) => t.unreachableFromConnector > 0 || t.cannotReachConnector > 0).length
                    } connector'da bağlantı sorunu var.`}
                </p>
              )}

              {failedRoutes.length > 0 && (
                <p>
                  <strong>🚨 Sorunlu Alanlar:</strong> {failedRoutes.length} rota başarısız. En yaygın hatalar:
                  {Object.entries(
                    failedRoutes.reduce((acc, r) => {
                      acc[r.error] = (acc[r.error] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .slice(0, 2)
                    .map(([error, count]) => ` "${error}" (${count} adet)`)
                    .join(",")}
                </p>
              )}

              {crossFloorRoutes.length > 0 && (
                <p>
                  <strong>🔄 Çapraz Kat Performansı:</strong> {crossFloorRoutes.length} çapraz kat rotası başarılı.
                  Floor connector sisteminiz çalışıyor!
                </p>
              )}

              {sameFloorRoutes.length > 0 && (
                <p>
                  <strong>🏢 Tek Kat Performansı:</strong> {sameFloorRoutes.length} aynı kat rotası başarılı. Temel
                  navigation sisteminiz sağlam.
                </p>
              )}

              <p>
                <strong>🔧 Öneriler:</strong>
                {roomDoorMismatch.orphanRooms.length > 0 &&
                  " • Kapısı olmayan odalar için SVG'de door elemanı ekleyin ve door-connection path'i oluşturun."}
                {roomDoorMismatch.orphanDoors.length > 0 &&
                  " • Room property'si olmayan kapılar için room=\"room-xxx\" attribute'u ekleyin."}
                {connectorTests.some((t) => t.unreachableConnectors > 0) &&
                  " • Aynı kattaki connector'lar arası bağlantı kopuk - tek kat içinde connector geçişi çalışmayabilir."}
                {connectorTests.some((t) => t.unreachableFromConnector > 0) &&
                  " • Bazı connector'lardan tüm noktalara ulaşılamıyor - corridor bağlantılarını kontrol edin."}
                {connectorTests.some((t) => t.cannotReachConnector > 0) &&
                  " • Bazı connector'lara tüm noktalardan ulaşılamıyor - ters yön bağlantıları kontrol edin."}
                {failedRoutes.length > testResults.length * 0.1 && " • Door-corridor bağlantılarını kontrol edin."}
                {successfulRoutes.length < testResults.length * 0.8 && " • Graph yapısında eksik bağlantılar olabilir."}
                {failedRoutes.filter((r) => r.error === "Door node not found in graph").length > 5 &&
                  " • Bazı odaların door ID'leri eksik veya hatalı."}
              </p>

              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  background: "#fff",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              >
                <strong>🎯 Kritik Sorunlar:</strong>
                <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                  {roomDoorMismatch.orphanRooms.length > 0 && (
                    <li style={{ color: "#f44336" }}>
                      Kapısı olmayan odalar: {roomDoorMismatch.orphanRooms.length} adet - bu odalar rotalamada
                      kullanılamaz
                    </li>
                  )}
                  {roomDoorMismatch.orphanDoors.length > 0 && (
                    <li style={{ color: "#f44336" }}>
                      Odası tanımsız kapılar: {roomDoorMismatch.orphanDoors.length} adet - room property eksik
                    </li>
                  )}
                  {connectorTests.filter((t) => t.unreachableFromConnector > 0).length > 0 && (
                    <li style={{ color: "#f44336" }}>
                      Connector outgoing sorunu: {connectorTests.filter((t) => t.unreachableFromConnector > 0).length}{" "}
                      adet connector
                    </li>
                  )}
                  {connectorTests.filter((t) => t.cannotReachConnector > 0).length > 0 && (
                    <li style={{ color: "#f44336" }}>
                      Connector incoming sorunu: {connectorTests.filter((t) => t.cannotReachConnector > 0).length} adet
                      connector
                    </li>
                  )}
                  {connectorTests.filter((t) => t.unreachableConnectors > 0).length > 0 && (
                    <li style={{ color: "#f44336" }}>
                      Aynı kat connector sorunu: {connectorTests.filter((t) => t.unreachableConnectors > 0).length} adet
                      connector
                    </li>
                  )}
                  {failedRoutes.length > 0 && <li>Normal rota başarısızlığı: {failedRoutes.length} adet</li>}
                  {failedRoutes.filter((r) => r.error.includes("Door node not found")).length > 0 && (
                    <li>
                      Door node bulunamayan:{" "}
                      {failedRoutes.filter((r) => r.error.includes("Door node not found")).length} adet
                    </li>
                  )}
                  {failedRoutes.filter((r) => r.error.includes("No route found")).length > 0 && (
                    <li>
                      Rota bulunamayan: {failedRoutes.filter((r) => r.error.includes("No route found")).length} adet
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <p>Test tamamlandığında burada detaylı analiz görünecek.</p>
          )}
        </div>
      </div>

      {/* Debug bilgileri */}
      <div style={{ marginTop: "20px", padding: "15px", background: "#f0f0f0", borderRadius: "8px", fontSize: "12px" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>🔍 Debug Bilgileri</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
          <div>
            <strong>Graph Node Türleri:</strong>
            <div>
              {Object.values(graph).reduce((acc, node) => {
                acc[node.type] = (acc[node.type] || 0) + 1;
                return acc;
              }, {}) &&
                Object.entries(
                  Object.values(graph).reduce((acc, node) => {
                    acc[node.type] = (acc[node.type] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([type, count]) => (
                  <div key={type}>
                    {type}: {count}
                  </div>
                ))}
            </div>
          </div>
          <div>
            <strong>Kat Dağılımı:</strong>
            <div>
              {Object.keys(GEOJSON_URLS).map((floor) => (
                <div key={floor}>
                  Kat {floor}: {Object.values(graph).filter((node) => node.floor === parseInt(floor)).length} node
                </div>
              ))}
            </div>
          </div>
          <div>
            <strong>Mevcut Floor Connectors:</strong>
            <div style={{ maxHeight: "100px", overflowY: "auto" }}>
              {Object.keys(graph)
                .filter((id) => graph[id].type === "floor-connector-node")
                .map((id) => (
                  <div key={id} style={{ fontSize: "10px" }}>
                    {id} (Kat {graph[id].floor})
                  </div>
                ))}
            </div>
          </div>
          <div>
            <strong>Room-Door İstatistikleri:</strong>
            <div>
              <div>Toplam Oda: {rooms.length}</div>
              <div>Toplam Kapı: {doors.length}</div>
              <div style={{ color: roomDoorMismatch.orphanRooms.length > 0 ? "#f44336" : "#4caf50" }}>
                Kapısız Oda: {roomDoorMismatch.orphanRooms.length}
              </div>
              <div style={{ color: roomDoorMismatch.orphanDoors.length > 0 ? "#f44336" : "#4caf50" }}>
                Tanımsız Kapı: {roomDoorMismatch.orphanDoors.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteTestPage;

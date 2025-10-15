'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { specialLocations, geojsonURLS } from '../utils/utils.js';
import { elevatorIcon, arrowIcon } from '../utils/icons.js';
import callOpenAI from '../utils/callOpenAI.js';
import { useChatManagement } from '../hooks/useChatManagement';
import {
  createFunctionCallRouter,
  OPENAI_FUNCTIONS,
} from '../utils/functionCallHandler';
import {
  multiFloorDijkstra,
  calculatePathDistance,
} from '../utils/dijkstra.js';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';
import SVGVoiceProcessing from '../public/assets/icons/SVGVoiceProccesing.jsx';
import SVGMicrophone from '../public/assets/icons/SVGMicrophone.jsx';

export default function MapLibreMap() {
  // Chat yönetimi hook'u
  const chatHook = useChatManagement({
    functions: OPENAI_FUNCTIONS,
    onFunctionCall: null, // Önce null, sonra güncellenecek
    initialMessage:
      'Merhaba! Ben navigasyon asistanınızım. Size yardımcı olmak için buradayım. Hangi mağazaya gitmek istiyorsunuz?',
  });

  // Chat hook'undan state'leri çıkar
  const {
    chatMessages,
    input,
    setInput,
    isAssistantTyping,
    sendMessage: originalSendMessage,
    addMessage,
    setChatMessages,
    functions,
  } = chatHook;
  // Ses kayıt hook'u
  const {
    isRecording,
    isProcessing: isVoiceProcessing,
    vadInitialized: isVADReady,
    error: voiceError,
    startVoiceRecording,
    stopVoiceRecording,
    initializeVAD,
    destroyVAD,
  } = useVoiceRecorder();
  // 3. Ses mesajı gönderme fonksiyonu (transcribe edilmiş metin ile)
  const handleVoiceMessage = async transcribedText => {
    try {
      console.log('[Voice] Transkripsiyon alındı:', transcribedText);
      setIsTranscribing(false);

      // Chat hook'u ile mesaj gönder
      await sendMessage(transcribedText);
    } catch (error) {
      console.error('[Voice] API hatası:', error);
      addMessage(
        'assistant',
        'Ses mesajı işlenirken hata oluştu. Tekrar dener misiniz?'
      );
    }
  };

  // 4. Ses butonu click handler'ı
  const handleVoiceButtonClick = async () => {
    if (isRecording) {
      // Kayıt durduruluyor
      console.log('[Voice] Kayıt durduruluyor...');
      await stopVoiceRecording();
      return;
    }

    // Asistan panelini aç
    setActiveNavItem(1);
    setIsCardMinimized(false);

    // VAD hazır değilse başlat
    if (!isVADReady) {
      console.log('[Voice] VAD başlatılıyor...');
      const success = await initializeVAD();
      if (!success) {
        console.error('[Voice] VAD başlatılamadı');
        return;
      }
    }

    // Kayıt başlat
    console.log('[Voice] Kayıt başlatılıyor...');
    setIsTranscribing(true);
    const success = await startVoiceRecording(handleVoiceMessage);

    if (!success) {
      console.error('[Voice] Kayıt başlatılamadı');
    }
  };

  // 6. Hata gösterme
  useEffect(() => {
    if (voiceError) {
      console.error('[Voice] Hata:', voiceError);
      addMessage('assistant', 'Ses sistemi hatası: ' + voiceError);
    }
  }, [voiceError, addMessage]);

  // 7. Component unmount'ta temizlik
  useEffect(() => {
    return () => {
      destroyVAD();
    };
  }, [destroyVAD]);

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const searchParams = useSearchParams();

  const [allGeoData, setAllGeoData] = useState({});
  const [currentFloor, setCurrentFloor] = useState(0);
  const [graph, setGraph] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);

  const [selectedStartRoom, setSelectedStartRoom] = useState('');
  const [selectedEndRoom, setSelectedEndRoom] = useState('');
  const [totalDistance, setTotalDistance] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Chat mesajlarına otomatik kaydırma
  const scrollToBottom = () => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (chatMessagesEndRefMobile.current) {
      chatMessagesEndRefMobile.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);
  const [currentUserLocation, setCurrentUserLocation] = useState('');
  const [preferredTransport, setPreferredTransport] = useState('escalator');
  const [selectedQuickAccess, setSelectedQuickAccess] = useState('');
  const [storeList, setStoreList] = useState([]);
  const [routeSteps, setRouteSteps] = useState([]);
  const [routeByFloor, setRouteByFloor] = useState({});

  const isSelectingStartRoomRef = useRef(false);
  const [startQuery, setStartQuery] = useState('');
  const [showStartDropdown, setShowStartDropdown] = useState(false);

  const [endQuery, setEndQuery] = useState('');
  const [showEndDropdown, setShowEndDropdown] = useState(false);
  const [isCardMinimized, setIsCardMinimized] = useState(true); // Mobilde başlangıçta kapalı
  const [activeNavItem, setActiveNavItem] = useState(1); // 0: Rota, 1: Asistan, 2-3: Boş
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Desktop'ta sol panel açık/kapalı

  const [showAllQuickAccess, setShowAllQuickAccess] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const routeStepsRef = useRef([]);
  const chatMessagesEndRef = useRef(null);
  const chatMessagesEndRefMobile = useRef(null);

  const [placeName, setPlaceName] = useState(''); // API'den gelecek
  const [placeId, setPlaceId] = useState(''); // Place ID - room'ları getirmek için
  const [mapCenter, setMapCenter] = useState([0, 0]); // API'den gelecek
  const [mapZoom, setMapZoom] = useState(15); // API'den gelecek
  const [popularPlacesIndex, setPopularPlacesIndex] = useState(0); // Popüler yerler kaydırma index
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const [isSelectingStartRoom, setIsSelectingStartRoom] = useState(false);

  // Google Maps tarzı arama için state'ler
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Kat seçimi dropdown için state
  const [showFloorDropdown, setShowFloorDropdown] = useState(false);

  useEffect(() => {
    isSelectingStartRoomRef.current = isSelectingStartRoom;
  }, [isSelectingStartRoom]);

  // Arama fonksiyonu
  const handleSearch = useCallback(
    query => {
      if (!query.trim()) {
        // Boş arama - ilk birkaç öneri göster
        const suggestions = rooms.slice(0, 3);
        setSearchResults(suggestions);
        return;
      }

      const filteredRooms = rooms.filter(
        room =>
          room.name && room.name.toLowerCase().includes(query.toLowerCase())
      );

      // Özel lokasyonları da dahil et
      const specialLocations = rooms.filter(
        room =>
          room.is_special &&
          room.special_type &&
          room.special_type.toLowerCase().includes(query.toLowerCase())
      );

      const allResults = [...filteredRooms, ...specialLocations];
      setSearchResults(allResults);
    },
    [rooms]
  );

  // Arama query'si değiştiğinde sonuçları güncelle
  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  // Arama sonucu seçildiğinde
  const handleSearchResultSelect = useCallback(
    room => {
      setSearchQuery(room.name);
      setShowSearchDropdown(false);
      setIsSearchFocused(false);

      // Oda seçimini yap - başlangıç veya bitiş noktası olarak
      if (isSelectingStartRoom) {
        setSelectedStartRoom(room.id);
        setIsSelectingStartRoom(false);
        console.log(`🎯 Arama sonucu başlangıç noktası seçildi: ${room.name}`);
      } else {
        setSelectedEndRoom(room.id);
        console.log(`🎯 Arama sonucu bitiş noktası seçildi: ${room.name}`);
      }

      // Rota panelini aç
      setActiveNavItem(0); // Rota navbar'ına geç
      setIsCardMinimized(false); // Paneli aç

      // Seçilen odayı haritada göster
      if (mapRef.current && room.coordinates) {
        mapRef.current.flyTo({
          center: [room.coordinates[0], room.coordinates[1]],
          zoom: 18,
          duration: 1000,
        });
      }

      // Kartı açık tut
      setIsCardMinimized(false);
    },
    [isSelectingStartRoom]
  );

  const getCurrentInstruction = () => {
    if (!routeSteps.length) return '';

    // Dinamik sıralama ekle
    const startRoom = rooms.find(r => r.id === selectedStartRoom);
    const endRoom = rooms.find(r => r.id === selectedEndRoom);
    const isGoingUp = endRoom?.floor > startRoom?.floor;

    const floors = Object.keys(routeByFloor)
      .map(Number)
      .sort((a, b) => (isGoingUp ? a - b : b - a)); // ← Bu satırı değiştir

    const currentIndex = floors.indexOf(currentFloor);
    const isLastFloor = currentIndex >= floors.length - 1;

    //Son katta isek hedefe doğru git
    if (isLastFloor) {
      const endRoom = rooms.find(r => r.id === selectedEndRoom);
      return `Hedefiniz ${endRoom?.name}'e doğru yolu takip edin`;
    }

    // Kat değişimi gerekiyorsa
    const nextFloor = floors[currentIndex + 1]; // ← Artık doğru sıradaki katı alacak
    const isGoingUpStep = nextFloor > currentFloor;
    const action = isGoingUpStep ? 'çıkın' : 'inin';

    // Transport türünü belirle
    const transportNames = {
      escalator: 'yürüyen merdiven',
      elevator: 'asansör',
      stairs: 'merdiven',
    };

    const transportName = transportNames[preferredTransport] || 'merdiven';

    // Kat isimlerini belirle
    const nextFloorName = nextFloor === 0 ? 'zemin kata' : `${nextFloor}. kata`;

    return `${transportName.charAt(0).toUpperCase() +
      transportName.slice(1)} ile ${nextFloorName} ${action}`;
  };

  const updateRoomClickHandlers = useCallback(() => {
    console.log('CLICK state:', isSelectingStartRoomRef.current);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    console.log(
      `Updating handlers (ref), isSelectingStartRoom: ${isSelectingStartRoomRef.current}`
    );

    // Tüm click handler'ları kaldır
    Object.keys(geojsonURLS).forEach(floor => {
      const layerId = `rooms-floor-${floor}`;
      if (map.getLayer(layerId)) {
        map.off('click', layerId);
        map.off('mouseenter', layerId);
        map.off('mouseleave', layerId);
      }
    });

    // Yeni handler'ları ekle
    Object.keys(geojsonURLS).forEach(floor => {
      const layerId = `rooms-floor-${floor}`;
      if (!map.getLayer(layerId)) return;

      map.on('click', layerId, e => {
        const layerVisibility = map.getLayoutProperty(layerId, 'visibility');
        if (layerVisibility === 'none') return;

        if (routeStepsRef.current.length > 0) return;
        const roomFeature = e.features[0];
        const roomId = roomFeature.properties.id;
        const namespacedRoomId = `f${floor}-${roomId}`;

        console.log(
          `CLICKED: ${namespacedRoomId}, MODE: ${
            isSelectingStartRoomRef.current ? 'START' : 'END'
          }`
        );
        console.log(`🔍 roomFeature.properties:`, roomFeature.properties);
        console.log(
          `🔍 roomId: ${roomId}, namespacedRoomId: ${namespacedRoomId}`
        );

        if (isSelectingStartRoomRef.current) {
          setSelectedStartRoom(namespacedRoomId);
          setIsSelectingStartRoom(false);
          // Arama kutusunu güncelle
          const selectedRoom = rooms.find(r => r.id === namespacedRoomId);
          console.log(`🔍 Seçilen oda bulundu:`, selectedRoom);
          if (selectedRoom) {
            console.log(`🔄 startQuery öncesi: "${startQuery}"`);
            setStartQuery(selectedRoom.name);
            console.log(`🔄 startQuery sonrası: "${selectedRoom.name}"`);
          } else {
            console.log(`❌ Oda bulunamadı! ID: ${namespacedRoomId}`);
          }
        } else {
          setSelectedEndRoom(namespacedRoomId);
          // Arama kutusunu güncelle
          const selectedRoom = rooms.find(r => r.id === namespacedRoomId);
          if (selectedRoom) {
            setEndQuery(selectedRoom.name);
            console.log(
              `🔄 Harita seçimi - endQuery güncellendi: ${selectedRoom.name}`
            );
          }
        }

        // Rota panelini aç
        setActiveNavItem(0); // Rota navbar'ına geç
        setIsCardMinimized(false); // Paneli aç
      });

      // Hover eventleri
      map.on('mouseenter', layerId, () => {
        const layerVisibility = map.getLayoutProperty(layerId, 'visibility');
        if (layerVisibility === 'none') return;
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    });
  }, [isSelectingStartRoom]);

  const handleQuickAccessItemClick = locationKey => {
    // Özel lokasyonu hedef olarak seç
    const specialLocation = specialLocations[locationKey];
    if (specialLocation) {
      const targetRoom = rooms.find(
        room => room.is_special && room.special_type === locationKey
      );
      if (targetRoom) {
        setSelectedEndRoom(targetRoom.id);
        setEndQuery(targetRoom.name);
      }
    }

    // Başlangıç noktası yoksa kullanıcıdan seçmesini iste
    if (!currentUserLocation && !selectedStartRoom) {
      // Rota panelini aç ve başlangıç seçim moduna geç
      setActiveNavItem(0);
      setIsCardMinimized(false);
      setIsSelectingStartRoom(true);
      setSelectedStartRoom('');
      setStartQuery('');
      return;
    }

    // Başlangıç noktası varsa rota oluştur
    setShowLocationWarning(false);
    handleSpecialLocationButton(locationKey);
  };
  useEffect(() => {
    if (selectedStartRoom && rooms.length > 0) {
      const startRoom = rooms.find(r => r.id === selectedStartRoom);
      if (startRoom && startRoom.floor !== currentFloor) {
        console.log(
          `🗺️ Başlangıç odası seçildi: ${startRoom.name} (Kat ${startRoom.floor})`
        );
        console.log(
          `📍 Harita katı değiştiriliyor: ${currentFloor} → ${startRoom.floor}`
        );

        setCurrentFloor(startRoom.floor);
        changeFloor(startRoom.floor);
      }
    }
  }, [selectedStartRoom, rooms]);

  // Başlangıç seçildikten sonra hızlı erişim rotasını oluştur
  useEffect(() => {
    if (selectedStartRoom && selectedEndRoom && isSelectingStartRoom) {
      // Hızlı erişim butonundan gelen rota isteği
      const endRoom = rooms.find(r => r.id === selectedEndRoom);
      if (endRoom && endRoom.is_special) {
        // Rota oluştur
        setIsSelectingStartRoom(false);
        console.log(
          `🎯 Hızlı erişim rotası oluşturuluyor: ${selectedStartRoom} → ${selectedEndRoom}`
        );
      }
    }
  }, [selectedStartRoom, selectedEndRoom, isSelectingStartRoom, rooms]);

  const handleLocationSelection = userLocationId => {
    if (!selectedQuickAccess || !userLocationId) return;

    setCurrentUserLocation(userLocationId);
    handleSpecialLocationButton(selectedQuickAccess);

    setSelectedQuickAccess('');
  };

  useEffect(() => {
    if (selectedEndRoom) {
      const endRoom = rooms.find(r => r.id === selectedEndRoom);
      setEndQuery(endRoom?.name || '');
    } else {
      setEndQuery('');
    }
  }, [selectedEndRoom, rooms]);

  useEffect(() => {
    if (selectedStartRoom) {
      const startRoom = rooms.find(r => r.id === selectedStartRoom);
      setStartQuery(startRoom?.name || '');
    } else {
      setStartQuery('');
    }
  }, [selectedStartRoom, rooms]);

  const quickAccessList = Object.entries(specialLocations).map(
    ([key, value]) => ({
      key,
      name: value.name,
      icon: value.icon,
    })
  );

  // İlk sistem mesajı
  useEffect(() => {
    console.log('🚀 İlk sistem mesajı useEffect çalışıyor');
    const slug = searchParams.get('slug');
    console.log("🔍 URL'den alınan slug:", slug);

    if (!slug) {
      console.log('❌ Slug bulunamadı, varsayılan mesaj gönderiliyor');
      setChatMessages([
        {
          role: 'assistant',
          content:
            'Merhaba! Ben navigasyon asistanınızım. Size yardımcı olmak için buradayım. Hangi mağazaya gitmek istiyorsunuz?',
        },
      ]);
      return;
    }

    console.log('🌐 API çağrısı yapılıyor, slug:', slug);
    fetch('/api/places?slug=' + encodeURIComponent(slug))
      .then(res => res.json())
      .then(data => {
        console.log("📡 API'den gelen veri:", data);
        const name = data.place;
        const place_id = data.place_id;
        const floors = data.floors;
        const center = data.center;
        const zoom = data.zoom;

        console.log('🔄 State güncelleniyor:');
        console.log('  - placeName:', name);
        console.log('  - placeId:', place_id);
        console.log('  - mapCenter:', center);
        console.log('  - mapZoom:', zoom);

        setPlaceName(name);
        setPlaceId(place_id); // Place ID'yi kaydet

        // Dinamik geojsonURLS güncelle
        if (floors) {
          console.log('📁 Floors güncelleniyor:', floors);
          // geojsonURLS'i güncelle
          Object.keys(floors).forEach(floor => {
            geojsonURLS[floor] = floors[floor];
          });
        }

        // Harita merkezini güncelle
        if (center) {
          console.log('📍 MapCenter set ediliyor:', center);
          setMapCenter(center);
        }
        if (zoom) {
          console.log('🔍 MapZoom set ediliyor:', zoom);
          setMapZoom(zoom);
        }

        // StoreList'i burada oluştur (henüz harita yüklenmediği için boş)
        const currentStoreList = Array.from(storeList).sort();
        console.log('Sisteme Gönderilen Mağazalar:', currentStoreList);
        console.log('Yüklenen Harita:', name, 'Katlar:', floors);
        setChatMessages([
          {
            role: 'system',
            content: `
              # ${name} iç mekanında çalışan bir navigasyon asistanısın.

              ## MEVCUT MAĞAZALAR: Bu Mağazalar şu an bulunan mağazalar. Bunların dışında kesinlikle mağaza ismi verme.
              Güncel ve anlık veriler bu mağazalar. İsimleri ve kullanıcıları bu mağazalara yönlendir. Bu Mağazalar paylaşılabilir, yönlendirilebilir.
              ${currentStoreList.join(', ')}
              
              ## MAĞAZA İSİM EŞLEŞTİRMESİ:
              - Kullanıcının söylediği mağaza isimlerini yukarıdaki listeden en yakın eşleşeni bul
              - "Starbucksa" → "Starbucks", "H&Me" → "H&M", Etstur -> Ets Tur gibi

              - 0. kat bilgilerini zemin kat veya giriş kat olarak algıla ve kullan.

              ## ÖZEL LOKASYON ÖZELLİKLERİ - YENİ:
              - find_special_location fonksiyonunu kullandığında, dönen bilgileri dikkatli oku:
                * user_floor: Kullanıcının bulunduğu kat
                * floor: Hedef lokasyonun bulunduğu kat  
                * distance: Toplam mesafe

              # YENİ: ÖZEL LOKASYON ÖZELLİKLERİ
              - Kullanıcı özel lokasyonlar istediğinde find_special_location fonksiyonunu kullan:
                * "Tuvalete gitmek istiyorum" → kullanıcının cinsiyetini sor, sonra wc-male veya wc-female
                * "En yakın erkek tuvaleti nerede?" → wc-male
                * "Kadın tuvaleti arıyorum" → wc-female  
                * "Engelli tuvaleti var mı?" → wc-disabled
                * "ATM arıyorum" → atm
                * "Eczane, ilaç" → pharmacy
                * "Acil çıkış nerede?" → emergency-exit
                * "Yangın merdiveni" → fire-exit
                * "Bebek bezini değiştirmem lazım" → baby-care
                * "İlk yardım" → first-aid
                * "Bilgi, danışma" → info-desk
              - Özel lokasyon ararken önce kullanıcının konumunu al, sonra find_special_location fonksiyonunu çağır.
              
              * Kullanıcı rota istediğinde MUTLAKA iki bilgiyi net şekilde al:
                1. Nereden? (Hangi Mağazalara Yakınsın, hangi mağazadasın?)
                2. Nereye? (Hangi mağazaya gitmek istiyorsun?)
              * Kullanıcının bulunduğu yakın konumu belirsizse: "Hangi mağazanın yanındasın?" veya "Şu anda neredesin?" diye sor.
              * Sadece iki net mağaza ismi aldıktan sonra navigate_user fonksiyonunu çağır.
              * Mağazaların ismini olabildiğince doğru dönmeye çalış.
              
              # ÖNEMLİ KAT BİLGİSİ:
              - Kullanıcı "indim", "aşağı indim", "alt kata indim" dediğinde change_floor fonksiyonunu "down" parametresiyle çağır.
              - Kullanıcı "çıktım", "yukarı çıktım", "üst kata çıktım" dediğinde change_floor fonksiyonunu "up" parametresiyle çağır.
              - Kat değişimi yaptığında kullanıcıya hangi kata geçtiğini söyle.
              - Rota planlanırken hangi katlarda ne yapılacağını açıkla.
              `,
          },
          {
            role: 'assistant',
            content: `Merhaba! ${name} navigasyon asistanıyım. Yardımcı olabilmem için konuşmaya başlayabiliriz. (TRY)`,
          },
        ]);
      })
      .catch(err => {
        console.log('MAĞAZALAR CATCH.....', storeList);
        setChatMessages([
          {
            role: 'assistant',
            content:
              'Merhaba! Ben navigasyon asistanınızım. Size yardımcı olmak için buradayım. Hangi mağazaya gitmek istiyorsunuz? (CATCH)',
          },
        ]);
      });
  }, [searchParams]); // storeList'i kaldırdık

  // StoreList güncellendiğinde sistem mesajını güncelle
  useEffect(() => {
    if (storeList.length > 0 && chatMessages.length > 0) {
      console.log(
        '🔄 StoreList güncellendi, sistem mesajı güncelleniyor:',
        storeList
      );

      // İlk mesajı (system mesajı) güncelle
      const updatedMessages = [...chatMessages];
      if (updatedMessages[0]?.role === 'system') {
        updatedMessages[0].content = updatedMessages[0].content.replace(
          /## MEVCUT MAĞAZALAR:.*?(\n\s*\n)/s,
          `## MEVCUT MAĞAZALAR: Bu Mağazalar şu an bulunan mağazalar. Bunların dışında kesinlikle mağaza ismi verme.
              Güncel ve anlık veriler bu mağazalar. İsimleri ve kullanıcıları bu mağazalara yönlendir. Bu Mağazalar paylaşılabilir, yönlendirilebilir.
              ${storeList.join(', ')}
              
              `
        );
        setChatMessages(updatedMessages);
      }
    }
  }, [storeList]);

  // Harita merkezi değiştiğinde haritayı güncelle
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(mapCenter);
      mapRef.current.setZoom(mapZoom);
    }
  }, [mapCenter, mapZoom]);

  const handleFinish = () => {
    setSelectedStartRoom('');
    setSelectedEndRoom(''); // Hedef odayı da temizle
    setRouteSteps([]);
    setRouteByFloor({});
    setTotalDistance(0);
    setIsSelectingStartRoom(false);
    setIsCardMinimized(true); // Paneli kapat

    // String query'leri de temizle
    setStartQuery('');
    setEndQuery('');

    // Dropdown'ları da kapat
    setShowStartDropdown(false);
    setShowEndDropdown(false);

    clearHighlightFromAllFloors();
  };
  const handleNextFloor = () => {
    const startRoom = rooms.find(r => r.id === selectedStartRoom);
    const endRoom = rooms.find(r => r.id === selectedEndRoom);
    const isGoingUp = endRoom?.floor > startRoom?.floor;

    const floors = Object.keys(routeByFloor)
      .map(Number)
      .sort((a, b) => (isGoingUp ? a - b : b - a)); // ← Dinamik sıralama

    const currentIndex = floors.indexOf(currentFloor);
    const nextFloor = floors[currentIndex + 1];
    if (nextFloor !== undefined) changeFloor(nextFloor);
  };

  const handlePreviousFloor = () => {
    const startRoom = rooms.find(r => r.id === selectedStartRoom);
    const endRoom = rooms.find(r => r.id === selectedEndRoom);
    const isGoingUp = endRoom?.floor > startRoom?.floor;

    const floors = Object.keys(routeByFloor)
      .map(Number)
      .sort((a, b) => (isGoingUp ? a - b : b - a)); // ← Dinamik sıralama

    const currentIndex = floors.indexOf(currentFloor);
    const prevFloor = floors[currentIndex - 1];
    if (prevFloor !== undefined) changeFloor(prevFloor);
  };
  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) {
      applyDualRoomHighlight();
    }
  }, [selectedStartRoom, selectedEndRoom]);
  // Güncellenen highlight fonksiyonu - iki oda için
  const applyDualRoomHighlight = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Başlangıç ve bitiş odalarının ID'lerini al
    const startRoomId = selectedStartRoom
      ? rooms.find(r => r.id === selectedStartRoom)?.originalId
      : null;
    const endRoomId = selectedEndRoom
      ? rooms.find(r => r.id === selectedEndRoom)?.originalId
      : null;

    Object.keys(geojsonURLS).forEach(floor => {
      try {
        const layerId = `rooms-floor-${floor}`;
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-extrusion-color', [
            'case',
            // Başlangıç odası - Yeşil
            ['==', ['get', 'id'], startRoomId || ''],
            '#4CAF50', // Yeşil
            // Bitiş odası - Turuncu
            ['==', ['get', 'id'], endRoomId || ''],
            '#FF6B35', // Turuncu
            // Default renk
            '#F5F0FF',
          ]);
        }
      } catch (error) {
        console.warn(
          `Could not apply dual highlight to floor ${floor}:`,
          error
        );
      }
    });
  };

  function findRoomByName(roomName) {
    if (!roomName) return null;
    return rooms.find(
      r =>
        r.name && r.name.toLowerCase().trim() === roomName.toLowerCase().trim()
    );
  }
  // Özel lokasyonları filtrele
  function getSpecialLocationsByType(specialType) {
    return rooms.filter(room => {
      return room.is_special === true && room.special_type === specialType;
    });
  }

  // En yakın özel lokasyonu bul
  function findClosestSpecialLocation(userLocation, specialType) {
    const specialLocations = getSpecialLocationsByType(specialType);

    if (specialLocations.length === 0) {
      return null;
    }

    let closest = null;
    let shortestDistance = Infinity;

    for (const location of specialLocations) {
      try {
        const userDoorId = `f${userLocation.floor}-${userLocation.doorId}`;
        const targetDoorId = `f${location.floor}-${location.doorId}`;

        const path = multiFloorDijkstra(
          userDoorId,
          targetDoorId,
          graph,
          preferredTransport,
          allGeoData
        );
        if (path.length === 0) continue;

        const routeDistance = calculatePathDistance(path, graph);

        if (routeDistance < shortestDistance) {
          shortestDistance = routeDistance;
          closest = { ...location, routeDistance };
        }
      } catch (error) {
        console.warn(`Route calculation failed for ${location.name}:`, error);
      }
    }

    return closest;
  }

  // Diğer fonksiyonların orijinal hali:
  const handleNavigateUser = async (
    argumentsStr,
    newMessages,
    reply,
    openai
  ) => {
    const args = JSON.parse(argumentsStr);
    console.log('navigate_user tetiklendi:', args);
    const fromRoom = findRoomByName(args.from);
    const toRoom = findRoomByName(args.to);

    if (!fromRoom || !toRoom) {
      const errorMsg = `Üzgünüm, ${
        !fromRoom ? args.from : args.to
      } mağazasını bulamadım. Mevcut mağazalardan birini seçer misiniz?`;
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: errorMsg },
      ]);
      return;
    }

    setSelectedStartRoom(fromRoom.id);
    setSelectedEndRoom(toRoom.id);

    if (fromRoom.floor !== currentFloor) {
      setCurrentFloor(fromRoom.floor);
      changeFloor(fromRoom.floor);
    }
  };

  const handleChangeFloor = argumentsStr => {
    const args = JSON.parse(argumentsStr);
    console.log('change_floor tetiklendi:', args);
    let newFloor = currentFloor;

    if (args.direction === 'up') {
      const availableFloors = Object.keys(geojsonURLS)
        .map(Number)
        .sort((a, b) => a - b);
      const upperFloors = availableFloors.filter(f => f > currentFloor);
      if (upperFloors.length > 0) {
        newFloor = upperFloors[0];
      }
    } else if (args.direction === 'down') {
      const availableFloors = Object.keys(geojsonURLS)
        .map(Number)
        .sort((a, b) => b - a);
      const lowerFloors = availableFloors.filter(f => f < currentFloor);
      if (lowerFloors.length > 0) {
        newFloor = lowerFloors[0];
      }
    }

    if (newFloor !== currentFloor) {
      setCurrentFloor(newFloor);
      changeFloor(newFloor);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `${newFloor}. kata geçtiniz. Harita güncellendi! 🗺️`,
        },
      ]);
    } else {
      const direction = args.direction === 'up' ? 'üst' : 'alt';
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `${direction} katta başka kat bulunmuyor.`,
        },
      ]);
    }
  };

  const handleSpecialLocationButton = specialType => {
    console.log(`🎯 Buton basıldı: ${specialType}`);

    if (!currentUserLocation) {
      console.log(`❌ Konum seçilmemiş! currentUserLocation boş`);
      return;
    }

    console.log(`📍 Kullanıcı konumu ID: ${currentUserLocation}`);

    //ID ile room bul
    const fromRoom = rooms.find(r => r.id === currentUserLocation);
    if (!fromRoom) {
      console.log(`❌ Başlangıç odası bulunamadı: ${currentUserLocation}`);
      return;
    }

    console.log(`✅ Başlangıç odası bulundu:`, fromRoom);
    console.log(`📍 Kullanıcı katı: ${fromRoom.floor}`);

    // DÜZELTİLMİŞ: Aynı kattaki özel lokasyonları bul
    const specialRooms = rooms.filter(room => {
      return (
        room.is_special === true &&
        room.special_type === specialType &&
        room.floor === fromRoom.floor
      ); // AYNI KATTA OLSUN
    });

    console.log(
      `🔍 ${specialType} tipinde KAT ${fromRoom.floor}'da ${specialRooms.length} oda bulundu:`,
      specialRooms.map(room => `${room.name} (Kat ${room.floor})`)
    );

    if (specialRooms.length === 0) {
      // Diğer katlarda var mı kontrol et
      const allSpecialRooms = getSpecialLocationsByType(specialType);
      console.log(
        `⚠️ Kat ${fromRoom.floor}'da ${specialType} yok, tüm katlarda ${allSpecialRooms.length} adet var`
      );

      if (allSpecialRooms.length === 0) {
        console.log(
          `❌ Hiç ${specialType} odası yok! GeoJSON'da özel lokasyonlar var mı kontrol et.`
        );
        return;
      }
    }

    const closestRoom = findClosestSpecialLocation(fromRoom, specialType);

    if (!closestRoom) {
      console.log(
        `❌ En yakın ${specialType} bulunamadı! Rota hesaplanamıyor olabilir.`
      );
      return;
    }

    console.log(`✅ En yakın ${specialType} bulundu:`, closestRoom);
    console.log(`📏 Mesafe: ${closestRoom.routeDistance?.toFixed(1)}m`);
    console.log(
      `🏢 Hedef kat: ${closestRoom.floor}, Kullanıcı kat: ${fromRoom.floor}`
    );

    console.log(`🗺️ Rota çiziliyor: ${fromRoom.id} → ${closestRoom.id}`);
    setSelectedStartRoom(fromRoom.id);
    setSelectedEndRoom(closestRoom.id);

    console.log(`✅ Buton işlemi tamamlandı!`);
  };

  // handleFindSpecialLocation fonksiyonunu düzelt
  const handleFindSpecialLocation = async argsStr => {
    const args = JSON.parse(argsStr);
    console.log('find_special_location tetiklendi:', args);

    const locationType = args.location_type;
    const locationInfo = specialLocations[locationType];

    // Kullanıcının konumunu belirle
    let userLocation = null;
    if (args.user_location) {
      userLocation = findRoomByName(args.user_location);
    }

    // Eğer konum belirsizse, GPT'ye söyle
    if (!userLocation) {
      const functionResult = {
        error: 'Konum belirtilmedi',
        message: `${locationInfo.name} için şu anki konumunuzu belirtmeniz gerekiyor.`,
        needs_user_location: true,
      };

      const newMessages = [
        ...chatMessages,
        {
          role: 'function',
          name: 'find_special_location',
          content: JSON.stringify(functionResult),
        },
      ];

      try {
        const response = await callOpenAI(newMessages, functions);
        const followup = response.choices[0].message;
        setChatMessages(prev => [...prev, followup]);
      } catch (err) {
        console.error('Special location error:', err);
      }
      return;
    }

    // En yakın özel lokasyonu bul
    const closestLocation = findClosestSpecialLocation(
      userLocation,
      locationType
    );

    if (!closestLocation) {
      const errorResult = {
        error: 'Lokasyon bulunamadı',
        message: `Yakınınızda ${locationInfo.name} bulunamadı.`,
        success: false,
      };

      const newMessages = [
        ...chatMessages,
        {
          role: 'function',
          name: 'find_special_location',
          content: JSON.stringify(errorResult),
        },
      ];

      try {
        const response = await callOpenAI(newMessages, functions);
        const followup = response.choices[0].message;
        setChatMessages(prev => [...prev, followup]);
      } catch (err) {
        console.error('Special location follow-up error:', err);
      }
      return;
    }

    // Rotayı çiz
    setSelectedStartRoom(userLocation.id);
    setSelectedEndRoom(closestLocation.id);

    // DÜZELTME: Başlangıç katına geç, hedef katına değil!
    if (userLocation.floor !== currentFloor) {
      setCurrentFloor(userLocation.floor);
      changeFloor(userLocation.floor);
    }

    // Sonucu GPT'ye bildir - Sadece başlangıç ve hedef kat bilgisi yeter
    setTimeout(async () => {
      const successResult = {
        success: true,
        found_location: {
          name: closestLocation.display_name || closestLocation.name,
          floor: closestLocation.floor,
          user_floor: userLocation.floor, // Kullanıcının katı
          distance: closestLocation.routeDistance.toFixed(1),
          icon: locationInfo.icon,
        },
      };

      const newMessages = [
        ...chatMessages,
        {
          role: 'function',
          name: 'find_special_location',
          content: JSON.stringify(successResult),
        },
      ];

      try {
        const response = await callOpenAI(newMessages, functions);
        const followup = response.choices[0].message;
        setChatMessages(prev => [...prev, followup]);
      } catch (err) {
        console.error('Special location follow-up error:', err);
      }
    }, 1000);
  };

  // Function call handler'ları
  const functionCallHandlers = {
    navigateUser: handleNavigateUser,
    changeFloor: handleChangeFloor,
    findSpecialLocation: handleFindSpecialLocation,
    // Eksik handler'lar için placeholder'lar
    registerUser: null,
    loginUser: null,
    visitLocation: null,
  };

  // Function call router'ı oluştur
  const handleFunctionCall = createFunctionCallRouter(functionCallHandlers);

  // sendMessage'i override et
  const sendMessage = async (messageText = null) => {
    const message = messageText || input.trim();
    if (!message) return;

    // Mesajı chat'e ekle
    const newMessages = [...chatMessages, { role: 'user', content: message }];
    setChatMessages(newMessages);
    setInput('');

    try {
      // OpenAI'ye gönder
      const response = await callOpenAI(newMessages, OPENAI_FUNCTIONS);
      const reply = response.choices[0].message;

      // Yanıtı chat'e ekle
      setChatMessages(prev => [...prev, reply]);

      // Function call kontrolü
      const functionCall = reply?.function_call;
      if (functionCall && handleFunctionCall) {
        console.log(
          `Fonksiyon çağrısı: ${functionCall.name}`,
          functionCall.arguments
        );
        await handleFunctionCall(functionCall);
      }
    } catch (error) {
      console.error('Chat API hatası:', error);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Mesaj gönderilirken hata oluştu. Tekrar dener misiniz?',
        },
      ]);
    }
  };

  // Escalator/elevator giriş adımı kontrolü
  function isEscalatorEntranceStep(step) {
    return step.to.includes('escalator') || step.to.includes('elevator');
  }

  // Escalator/elevator çıkış adımı kontrolü
  function isEscalatorExitStep(step) {
    return step.from.includes('escalator') || step.from.includes('elevator');
  }

  // YENİ: shouldSkipCorridorBouncing fonksiyonu - KORİDOR bazlı
  function shouldSkipCorridorBouncing(steps, currentIndex) {
    const currentStep = steps[currentIndex];
    const currentDistance = parseFloat(currentStep.distance) || 0;

    // 1. SIFIR MESAFE FİLTRESİ (aynı)
    if (currentDistance === 0.0) {
      console.log(
        `   💡 Sıfır mesafe filtresi: ${currentStep.from} → ${currentStep.to} (0.0m)`
      );
      return true;
    }

    // 2. KORİDOR BOUNCING FİLTRESİ
    // Pattern: corridor-1 → corridor-2 → corridor-1 (kısa mesafeli)
    if (currentIndex > 0 && currentIndex < steps.length - 1) {
      const prevStep = steps[currentIndex - 1];
      const nextStep = steps[currentIndex + 1];

      const prevCorridor =
        extractCorridorName(prevStep.from) || extractCorridorName(prevStep.to);
      const currentCorridorFrom = extractCorridorName(currentStep.from);
      const currentCorridorTo = extractCorridorName(currentStep.to);
      const nextCorridor =
        extractCorridorName(nextStep.from) || extractCorridorName(nextStep.to);

      // Önceki ve sonraki adım aynı koridorda, mevcut adım farklı koridorda
      if (
        prevCorridor &&
        nextCorridor &&
        (currentCorridorFrom || currentCorridorTo) &&
        prevCorridor === nextCorridor &&
        currentCorridorFrom !== prevCorridor &&
        currentCorridorTo !== prevCorridor
      ) {
        // Kısa mesafeli geçişleri filtrele (5m altı)
        if (currentDistance < 5) {
          console.log(
            `   💡 Koridor bouncing: ${prevCorridor} → ${currentCorridorFrom ||
              currentCorridorTo} → ${nextCorridor} (${currentDistance.toFixed(
              1
            )}m)`
          );
          return true;
        }
      }
    }

    // 3. UZUN KORİDOR ZİNCİRİ FİLTRESİ
    // Pattern: corridor-1 → corridor-1 → corridor-2 → corridor-1 → corridor-1
    // Ortadaki corridor-2 geçişi gereksizse filtrele
    if (currentIndex >= 2 && currentIndex <= steps.length - 3) {
      const step1 = steps[currentIndex - 2];
      const step2 = steps[currentIndex - 1];
      const step3 = steps[currentIndex]; // current
      const step4 = steps[currentIndex + 1];
      const step5 = steps[currentIndex + 2];

      const corridor1 =
        extractCorridorName(step1.from) || extractCorridorName(step1.to);
      const corridor2 =
        extractCorridorName(step2.from) || extractCorridorName(step2.to);
      const corridor3 =
        extractCorridorName(step3.from) || extractCorridorName(step3.to);
      const corridor4 =
        extractCorridorName(step4.from) || extractCorridorName(step4.to);
      const corridor5 =
        extractCorridorName(step5.from) || extractCorridorName(step5.to);

      // A-A-B-A-A pattern
      if (
        corridor1 &&
        corridor2 &&
        corridor3 &&
        corridor4 &&
        corridor5 &&
        corridor1 === corridor2 &&
        corridor4 === corridor5 &&
        corridor1 === corridor4 &&
        corridor3 !== corridor1 &&
        currentDistance < 5
      ) {
        console.log(
          `💡 Koridor chain bounce: ${corridor1}-${corridor2}-${corridor3}-${corridor4}-${corridor5}`
        );
        return true;
      }
    }

    return false;
  }

  function shouldSkipStep(steps, currentIndex) {
    // Güvenlik kontrolleri
    if (
      !steps ||
      steps.length === 0 ||
      currentIndex < 0 ||
      currentIndex >= steps.length
    ) {
      console.warn(
        `⚠️ Invalid skip check: steps.length=${steps?.length}, currentIndex=${currentIndex}`
      );
      return false;
    }

    const currentStep = steps[currentIndex];

    // currentStep kontrolü
    if (!currentStep) {
      console.warn(`⚠️ currentStep is undefined at index ${currentIndex}`);
      return false;
    }

    // distance kontrolü
    if (!currentStep.hasOwnProperty('distance')) {
      console.warn(`⚠️ currentStep has no distance property:`, currentStep);
      return false;
    }

    const currentDistance = parseFloat(currentStep.distance) || 0;

    // 1. SIFIR MESAFE - her zaman skip
    if (currentDistance === 0.0) {
      console.log(
        `   💡 Sıfır mesafe filtresi: ${currentStep.from} → ${currentStep.to} (0.0m)`
      );
      return true;
    }

    // 2. KORIDOR BOUNCING - kısa mesafeli koridor değişimleri
    if (currentIndex > 0 && currentIndex < steps.length - 1) {
      const prevStep = steps[currentIndex - 1];
      const nextStep = steps[currentIndex + 1];

      // Güvenlik kontrolleri
      if (!prevStep || !nextStep) {
        return false;
      }

      const prevCorridor =
        extractCorridorName(prevStep.from) || extractCorridorName(prevStep.to);
      const currentCorridor =
        extractCorridorName(currentStep.from) ||
        extractCorridorName(currentStep.to);
      const nextCorridor =
        extractCorridorName(nextStep.from) || extractCorridorName(nextStep.to);

      // corridor-1 → corridor-2 → corridor-1 pattern ve kısa mesafe
      if (
        prevCorridor &&
        nextCorridor &&
        currentCorridor &&
        prevCorridor === nextCorridor &&
        currentCorridor !== prevCorridor &&
        currentDistance < 5
      ) {
        console.log(
          `   💡 Koridor bouncing: ${prevCorridor} → ${currentCorridor} → ${nextCorridor} (${currentDistance.toFixed(
            1
          )}m)`
        );
        return true;
      }
    }

    return false;
  }

  const clearHighlightFromAllFloors = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Room highlight'ları her kat için temizle
    Object.keys(geojsonURLS).forEach(floor => {
      try {
        const layerId = `rooms-floor-${floor}`;
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'fill-extrusion-color', '#F5F0FF');
        }
      } catch (error) {
        console.warn(`Could not clear highlight for floor ${floor}:`, error);
      }
    });

    // Path ve arrow'ları sadece BİR KEZ temizle (döngü dışında)
    try {
      if (map.getSource('path')) {
        map.getSource('path').setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [] },
        });
      }
      if (map.getSource('path-arrows')) {
        map.getSource('path-arrows').setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    } catch (error) {
      console.warn('Could not clear path/arrows:', error);
    }
  };

  // Koridor adını çıkar
  function extractCorridorName(locationName) {
    if (!locationName) return null;
    const match = locationName.match(/corridor-\d+/);
    return match ? match[0] : null;
  }
  // 🚀 GÜNCELLENECEK highlightRoom FONKSİYONU:
  const highlightRoom = (roomFeature, targetFloor) => {
    const map = mapRef.current;
    if (!map || !roomFeature) return;

    const roomId = roomFeature.properties.id;

    // Eğer highlight edilecek oda farklı kattaysa, o kata geç
    if (targetFloor !== currentFloor) {
      console.log(
        `📍 Room is on different floor, switching: ${currentFloor} → ${targetFloor}`
      );
      setCurrentFloor(targetFloor);

      // Kat değiştikten sonra highlight'ı uygula
      setTimeout(() => {
        if (map.getLayer(`rooms-floor-${targetFloor}`)) {
          map.setPaintProperty(
            `rooms-floor-${targetFloor}`,
            'fill-extrusion-color',
            [
              'case',
              ['==', ['get', 'id'], roomId],
              '#FF6B35', // Highlight color
              '#F5F0FF', // Default color
            ]
          );
        }
      }, 200);
    } else {
      // Aynı kattaysa direkt highlight
      if (map.getLayer(`rooms-floor-${targetFloor}`)) {
        map.setPaintProperty(
          `rooms-floor-${targetFloor}`,
          'fill-extrusion-color',
          [
            'case',
            ['==', ['get', 'id'], roomId],
            '#FF6B35', // Highlight color
            '#F5F0FF', // Default color
          ]
        );
      }
    }
  };

  // Multi-floor GeoJSON yükleme (Final + DB Room Merge)
  const loadAllFloors = async () => {
    console.log('🔄 Tüm katlar yükleniyor (Final + DB Merge)...');
    const floorData = {};

    // 1. Final GeoJSON'ları yükle (yerel veriler)
    for (const [floor, url] of Object.entries(geojsonURLS)) {
      try {
        const response = await fetch(url);
        const data = await response.json();
        floorData[floor] = data;
        console.log(
          `✅ Final Floor ${floor} yüklendi:`,
          data.features.length,
          'feature'
        );
      } catch (err) {
        console.error(`❌ Final Floor ${floor} yüklenemedi:`, err);
        floorData[floor] = { type: 'FeatureCollection', features: [] };
      }
    }

    // 2. DB'den room'ları yükle ve merge et
    if (placeId) {
      try {
        console.log("🔄 DB'den room'lar getiriliyor, place_id:", placeId);
        const roomsResponse = await fetch(`/api/rooms?place_id=${placeId}`);
        const dbRoomsByFloor = await roomsResponse.json();

        console.log("✅ DB'den room'lar geldi:", Object.keys(dbRoomsByFloor));

        // Debug: Her kat için room sayısını logla
        Object.keys(dbRoomsByFloor).forEach(floor => {
          const roomCount = dbRoomsByFloor[floor].features.length;
          console.log(`📊 Kat ${floor}: ${roomCount} room`);
        });

        // Her kat için DB room'larını final verilerin üzerine yaz
        Object.keys(dbRoomsByFloor).forEach(floor => {
          const dbFloorData = dbRoomsByFloor[floor];

          if (!floorData[floor]) {
            // Final'de bu kat yoksa, DB'den geleni kullan
            floorData[floor] = dbFloorData;
            console.log(
              `📁 Kat ${floor} sadece DB'den oluşturuldu:`,
              dbFloorData.features.length,
              'room'
            );
          } else {
            // Final'de bu kat varsa, DB room'larını üzerine yaz
            const finalFloorData = floorData[floor];
            const dbRoomIds = new Set(
              dbFloorData.features.map(f => f.properties.id)
            );

            // Final'deki room'ları filtrele (DB'de olmayanları koru)
            const nonRoomFeatures = finalFloorData.features.filter(
              feature => !dbRoomIds.has(feature.properties.id)
            );

            // DB room'larını ekle (yerel room'ların üzerine yazar)
            floorData[floor] = {
              ...finalFloorData,
              features: [...nonRoomFeatures, ...dbFloorData.features],
            };

            console.log(
              `🔀 Kat ${floor} merge edildi: ${nonRoomFeatures.length} yerel + ${dbFloorData.features.length} DB room`
            );
          }
        });

        console.log("✅ DB room'ları merge edildi");
      } catch (err) {
        console.error("❌ DB room'ları yüklenirken hata:", err);
        // Hata olursa sadece final verilerle devam et
      }
    }

    setAllGeoData(floorData);
    console.log('✅ Tüm katlar yüklendi ve merge edildi');
    return floorData;
  };

  useEffect(() => {
    console.log('🗺️ Harita useEffect çalışıyor');
    console.log('📍 mapCenter:', mapCenter);
    console.log('🔍 mapZoom:', mapZoom);
    console.log('🏢 placeName:', placeName);

    // API'den veri gelene kadar bekle
    if (!mapCenter || mapCenter[0] === 0 || mapCenter[1] === 0) {
      console.log("❌ API'den veri henüz gelmedi, harita oluşturulmuyor");
      return;
    }

    // Harita zaten varsa sadece merkez ve zoom güncelle
    if (mapRef.current) {
      console.log('🔄 Harita zaten var, sadece merkez ve zoom güncelleniyor');
      mapRef.current.setCenter(mapCenter);
      mapRef.current.setZoom(mapZoom);
      return;
    }

    console.log('✅ Harita oluşturuluyor...');
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style:
        'https://api.maptiler.com/maps/basic/style.json?key=c2b5poelsH66NYMBeaq6',
      center: mapCenter,
      zoom: mapZoom,
      minZoom: 17,
      maxZoom: 22,
      attributionControl: false,

      pitch: 45, // Başlangıçta eğik
      bearing: 0,
      interactive: true, // Default true, false olabilir
      dragPan: true, // Sürükleme
      scrollZoom: true, // Zoom
      touchZoomRotate: true, // Dokunmatik zoom/rotate
      dragRotate: true,
    });
    mapRef.current = map;

    map.on('load', async () => {
      const style = map.getStyle();

      // Glyphs URL'ini ekle (font dosyaları için gerekli)
      if (!style.glyphs) {
        style.glyphs =
          'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=c2b5poelsH66NYMBeaq6';
        map.setStyle(style);
      }

      if (style.layers) {
        style.layers.forEach(layer => {
          if (
            layer.source !== undefined &&
            !layer.id.includes('indoor') &&
            !layer.id.includes('path')
          ) {
            if (layer.type === 'background') {
              map.setPaintProperty(layer.id, 'background-opacity', 0.2);
            } else if (layer.type === 'fill') {
              map.setPaintProperty(layer.id, 'fill-opacity', 0.2);
            } else if (layer.type === 'line') {
              map.setPaintProperty(layer.id, 'line-opacity', 0.2);
            } else if (layer.type === 'symbol') {
              map.setPaintProperty(layer.id, 'text-opacity', 0.1);
              map.setPaintProperty(layer.id, 'icon-opacity', 0.1);
            } else if (layer.type === 'raster') {
              map.setPaintProperty(layer.id, 'raster-opacity', 0.2);
            }
          }
        });
      }

      // Elevator icon'unu map'e ekle
      const elevatorImg = new Image(24, 24);
      elevatorImg.onload = () => map.addImage('elevator-icon', elevatorImg);
      elevatorImg.src = elevatorIcon;

      // Icon'u map'e ekle
      const img = new Image(24, 24);
      img.onload = () => map.addImage('custom-arrow', img);
      img.src = arrowIcon;

      const floorData = await loadAllFloors();

      if (Object.keys(floorData).length > 0) {
        const {
          graph: g,
          rooms: r,
          doors: d,
          storeList: stores,
        } = buildMultiFloorGraph(floorData);
        setGraph(g);
        setRooms(r);
        setDoors(d);
        setStoreList(stores);

        // Her kat için source ve layer ekle
        Object.entries(floorData).forEach(([floor, data]) => {
          const sourceId = `indoor-floor-${floor}`;
          map.addSource(sourceId, { type: 'geojson', data });

          // 1. Walkable areas (En altta)
          map.addLayer({
            id: `walkable-areas-floor-${floor}`,
            type: 'fill',
            source: sourceId,
            filter: [
              'all',
              ['==', ['get', 'type'], 'area'],
              ['==', ['get', 'subtype'], 'walkable'],
            ],
            paint: {
              'fill-color': '#FFFFFF',
              'fill-opacity': 0.4,
            },
            layout: {
              visibility: floor == currentFloor ? 'visible' : 'none',
            },
          });

          // 2. Non-walkable areas (Duvarlar, kolonlar)
          map.addLayer({
            id: `non-walkable-areas-floor-${floor}`,
            type: 'fill-extrusion',
            source: sourceId,
            filter: [
              'all',
              ['==', ['get', 'type'], 'area'],
              ['==', ['get', 'subtype'], 'non-walkable'],
            ],
            paint: {
              'fill-extrusion-color': '#8E9AAF',
              'fill-extrusion-height': 3, // Duvarlar daha yüksek
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 1,
            },
            layout: {
              visibility: floor == currentFloor ? 'visible' : 'none',
            },
          });

          // 3. Rooms (Ana odalar)
          map.addLayer({
            id: `rooms-floor-${floor}`,
            type: 'fill-extrusion', // fill yerine fill-extrusion
            source: sourceId,
            filter: ['==', ['get', 'type'], 'room'],
            paint: {
              'fill-extrusion-color': '#F5F0FF',
              'fill-extrusion-height': 4, // 8 piksel yükseklik (3-4 metre gibi)
              'fill-extrusion-base': 0, // Zeminden başla
              'fill-extrusion-opacity': 1,
            },
            layout: {
              visibility: floor == currentFloor ? 'visible' : 'none',
            },
          });

          // 6. Floor connectors (Asansör/Merdiven) - GÜNCELLEME
          map.addLayer({
            id: `floor-connectors-floor-${floor}`,
            type: 'symbol', // circle yerine symbol
            source: sourceId,
            filter: ['==', ['get', 'type'], 'floor-connector-node'],
            layout: {
              'icon-image': 'elevator-icon',
              'icon-size': 0.8,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              visibility: floor == currentFloor ? 'visible' : 'none',
            },
            minzoom: 19, // Zoom 19'dan sonra görünür
          });

          // 7. Room labels (En üstte)
          map.addLayer({
            id: `room-labels-floor-${floor}`,
            type: 'symbol',
            source: sourceId,
            filter: ['==', ['get', 'type'], 'room'],
            layout: {
              'text-field': ['get', 'name'], // ✅ Final JSON'da güncel isimler title field'ında
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 15,

              'text-anchor': 'center',
              'text-offset': [0, 0],
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              visibility: floor == currentFloor ? 'visible' : 'none',
            },
            paint: {
              'text-color': '#333333',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          });
          // Highlight source ve layer ekle - VAR MI KONTROL ET
          if (!map.getSource('room-highlight')) {
            map.addSource('room-highlight', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [],
              },
            });
          }

          if (!map.getLayer('room-highlight-layer')) {
            map.addLayer({
              id: 'room-highlight-layer',
              type: 'fill',
              source: 'room-highlight',
              paint: {
                'fill-color': '#FF6B35',
                'fill-opacity': 0.7,
              },
            });
          }
        });

        // DEĞİŞİKLİK: Map'in idle olmasını bekle
        map.once('idle', () => {
          updateRoomClickHandlers();
        });
      }
    });
    setTimeout(updateRoomClickHandlers, 1000);
    return () => {
      // Sadece component unmount olduğunda haritayı sil
      if (mapRef.current) {
        console.log('🗑️ Harita temizleniyor (component unmount)');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapCenter, mapZoom]); // API'den veri geldiğinde çalışsın

  // changeFloor fonksiyonunu sadeleştir - PATH ÇİZME SORUMLULUĞUNU KALDIR
  const changeFloor = newFloor => {
    console.log(`Floor changing: ${currentFloor} → ${newFloor}`);
    setCurrentFloor(newFloor);

    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;

    // Sadece visibility değiştir - PATH ÇİZME
    Object.keys(geojsonURLS).forEach(floor => {
      const visibility = floor == newFloor ? 'visible' : 'none';
      [
        `walkable-areas-floor-${floor}`,
        `non-walkable-areas-floor-${floor}`,
        `rooms-floor-${floor}`,
        `doors-floor-${floor}`,
        `floor-connectors-floor-${floor}`,
        `room-labels-floor-${floor}`,
      ].forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visibility);
        }
      });
    });
    // PATH ÇİZİMİNİ BURADA YAPMA - SADECE EĞER ROTA VARSA ÇİZ
    if (routeByFloor[newFloor] && routeByFloor[newFloor].length > 0) {
      setTimeout(() => drawPathSafely(routeByFloor[newFloor]), 150);
    } else {
      // Boş path gönder
      setTimeout(() => drawPathSafely([]), 150);
    }
  };

  useEffect(() => {
    if (!graph || !selectedStartRoom || !selectedEndRoom) {
      setTotalDistance(0);
      setRouteByFloor({});
      setRouteSteps([]);

      // Clear path
      const map = mapRef.current;
      if (map && map.isStyleLoaded() && map.getSource('path')) {
        map.getSource('path').setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [] },
        });
      }
      return;
    }

    const startRoom = rooms.find(r => r.id === selectedStartRoom);
    const endRoom = rooms.find(r => r.id === selectedEndRoom);
    if (!startRoom || !endRoom) {
      setTotalDistance(0);
      setRouteByFloor({});
      setRouteSteps([]);
      return;
    }

    console.log('🔄 Route calculation starting...');
    const startDoorId = `f${startRoom.floor}-${startRoom.doorId}`;
    const endDoorId = `f${endRoom.floor}-${endRoom.doorId}`;

    const path = multiFloorDijkstra(
      startDoorId,
      endDoorId,
      graph,
      preferredTransport,
      allGeoData
    );
    if (path.length === 0) {
      setTotalDistance(0);
      setRouteByFloor({});
      setRouteSteps([]);
      return;
    }

    // Route calculation (aynı kalacak)
    let dist = 0;
    const steps = [];
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i],
        v = path[i + 1];
      const edge = graph[u].neighbors.find(e => e.to === v);

      let stepDistance,
        isFloorChange = false,
        direction = null;

      if (edge) {
        stepDistance = edge.weight;
        direction = edge.direction;
        isFloorChange = edge.type === 'floor-connector-connection';
      } else {
        const uFloor = graph[u]?.floor;
        const vFloor = graph[v]?.floor;
        if (uFloor !== vFloor) {
          stepDistance = 10;
          isFloorChange = true;
          direction = 'floor-change';
        } else {
          console.warn(`Edge bulunamadı: ${u} → ${v}`);
          stepDistance = 0;
        }
      }

      dist += stepDistance;
      steps.push({
        from: u,
        to: v,
        direction,
        distance: stepDistance,
        floorChange: isFloorChange,
      });
    }

    const filteredPath = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      if (!shouldSkipStep(steps, i)) filteredPath.push(path[i]);
    }
    if (path.length > 1) filteredPath.push(path[path.length - 1]);

    // Kat bazında parçala
    const routeParts = {};
    filteredPath.forEach(nodeId => {
      const node = graph[nodeId];
      if (node) {
        const floor = node.floor;
        if (!routeParts[floor]) routeParts[floor] = [];
        routeParts[floor].push([...node.coords].reverse());
      }
    });

    console.log('✅ Route calculated, setting state...');

    // State'i set et
    setRouteByFloor(routeParts);
    setRouteSteps(steps);
    setTotalDistance(dist);

    // Arama kısmındaki değeri temizle
    setSearchQuery('');

    // Kat değiştir
    if (startRoom.floor !== currentFloor) {
      setCurrentFloor(startRoom.floor);
    }
    // Path'i çiz - currentFloor update'ini beklemek için useEffect kullan
    const currentFloorPath = routeParts[startRoom.floor];
    if (currentFloorPath && currentFloorPath.length > 0) {
      drawPathSafely(currentFloorPath);
    }
  }, [selectedStartRoom, selectedEndRoom, graph, doors, preferredTransport]);
  // Basit ve güvenilir path çizim fonksiyonu
  function drawPathSafely(coords) {
    const map = mapRef.current;

    if (!map) {
      console.log('No map reference');
      return;
    }

    if (!map.isStyleLoaded()) {
      console.log('Map style not loaded, retrying...');
      setTimeout(() => drawPathSafely(coords), 100);
      return;
    }

    // Boş coordinates kontrolü - BOTH path ve arrows temizle
    if (!coords || coords.length === 0) {
      console.log('🧹 Empty coordinates, clearing path AND arrows');
      try {
        if (map.getSource('path')) {
          map.getSource('path').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
          });
        }
        if (map.getSource('path-arrows')) {
          map.getSource('path-arrows').setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
      } catch (error) {
        console.error('Error clearing path/arrows:', error);
      }
      return;
    }

    console.log(`🎯 Drawing path with ${coords.length} points`);

    try {
      const geo = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
      };

      // Ana rota çizgisi
      if (map.getSource('path')) {
        map.getSource('path').setData(geo);
      } else {
        map.addSource('path', { type: 'geojson', data: geo });
        map.addLayer({
          id: 'path-line',
          type: 'line',
          source: 'path',
          paint: {
            'line-color': '#2196F3',
            'line-width': 13,
          },
        });
      }

      // Ok işaretleri - sadece yeterli nokta varsa
      if (coords.length > 1) {
        const arrowPoints = [];

        for (let i = 3; i < coords.length; i += 3) {
          const current = coords[i];
          const previous = coords[i - 1];
          const bearing = calculateBearing(
            previous[1],
            previous[0],
            current[1],
            current[0]
          );

          arrowPoints.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: current },
            properties: { bearing: bearing },
          });
        }

        const arrowGeo = { type: 'FeatureCollection', features: arrowPoints };

        if (map.getSource('path-arrows')) {
          map.getSource('path-arrows').setData(arrowGeo);
        } else {
          map.addSource('path-arrows', { type: 'geojson', data: arrowGeo });
          map.addLayer({
            id: 'path-arrows',
            type: 'symbol',
            source: 'path-arrows',
            layout: {
              'icon-image': 'custom-arrow',
              'icon-size': 0.6,
              'icon-rotate': ['get', 'bearing'],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
          });
        }
      } else {
        // Tek nokta varsa arrows'ları temizle
        if (map.getSource('path-arrows')) {
          map.getSource('path-arrows').setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
      }

      console.log('✅ Path drawn from drawPathSafely');
      // Path çizildikten sonra haritayı o path'e odakla
      if (coords && coords.length > 1) {
        fitMapToPath(coords);
      }
    } catch (error) {
      console.error('❌ Path drawing error:', error);
    }
  }
  function fitMapToPath(coords) {
    const map = mapRef.current;
    if (!map || !coords || coords.length < 2) return;

    try {
      // Path'in sınırlarını hesapla
      let minLng = coords[0][0],
        maxLng = coords[0][0];
      let minLat = coords[0][1],
        maxLat = coords[0][1];

      coords.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });

      // Haritayı bu sınırlara odakla
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 1000, // 1 saniye animasyon
          maxZoom: 20,
        }
      );
    } catch (error) {
      console.error('Error fitting map to path:', error);
    }
  }

  // Bearing hesaplama fonksiyonu
  function calculateBearing(lat1, lon1, lat2, lon2) {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dlambda = ((lon2 - lon1) * Math.PI) / 180;

    const x = Math.sin(dlambda) * Math.cos(phi2);
    const y =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlambda);

    const bearing = (Math.atan2(x, y) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  function buildMultiFloorGraph(floorData) {
    const graph = {};
    const rooms = [];
    const doors = [];
    const allStores = new Set();

    // Her kat için ayrı namespace ile graph oluştur
    Object.entries(floorData).forEach(([floor, data]) => {
      const floorPrefix = `f${floor}`;

      data.features.forEach(({ geometry, properties }) => {
        // Store-index yerine room name'lerden liste oluştur
        if (
          properties.type === 'room' &&
          properties.name &&
          properties.name.trim() !== ''
        ) {
          allStores.add(properties.name);
        }
        const {
          type,
          id,
          connector,
          connector_type,
          direction,
          room: roomId,
        } = properties;
        if (!geometry || geometry.type !== 'Point') {
          return; // Store-index gibi geometry'si olmayan feature'ları atla
        }
        if (geometry.type === 'Point') {
          const [lon, lat] = geometry.coordinates;
          const namespacedId = `${floorPrefix}-${id}`;

          if (
            type === 'door-node' ||
            type === 'corridor-node' ||
            type === 'floor-connector-node'
          ) {
            if (type === 'floor-connector-node') {
              console.log(`🌐 Floor connector found: ${namespacedId}`);
            }
            graph[namespacedId] = {
              coords: [lat, lon],
              neighbors: [],
              floor: parseInt(floor),
              originalId: id,
              type: type,
              direction: direction || null,
              baseName: connector,
              connector_type: connector_type || null,
            };

            if (type === 'door-node') {
              doors.push({
                id: namespacedId,
                coords: [lat, lon],
                roomId: `${floorPrefix}-${roomId}`,
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

        if (
          (type === 'corridor-edge' || type === 'door-connection') &&
          graph[namespacedFrom] &&
          graph[namespacedTo]
        ) {
          graph[namespacedFrom].neighbors.push({
            to: namespacedTo,
            weight,
            direction,
            type,
          });
          graph[namespacedTo].neighbors.push({
            to: namespacedFrom,
            weight,
            direction: reverseDirection(direction),
            type,
          });
        }
      });
      function reverseDirection(direction) {
        const opposites = {
          north: 'south',
          south: 'north',
          east: 'west',
          west: 'east',
          northeast: 'southwest',
          northwest: 'southeast',
          southeast: 'northwest',
          southwest: 'northeast',
        };
        return opposites[direction] || direction;
      }

      // Room'ları ekle
      data.features.forEach(({ properties }) => {
        if (properties.type === 'room') {
          console.log(`🏠 Room bulundu: ${properties.name} (Kat ${floor})`);
          const doorObj = doors.find(
            d => d.roomId === `${floorPrefix}-${properties.id}`
          );
          rooms.push({
            id: `${floorPrefix}-${properties.id}`,
            name: properties.name, // ✅ Sadece name, fallback yok
            logo: properties.logo || null,
            doorId: doorObj?.originalId || null,
            floor: parseInt(floor),
            originalId: properties.id,
            // YENİ EKLENEN: Özel lokasyon bilgileri
            is_special: properties.is_special || false,
            special_type: properties.special_type || null,
            category: properties.category || 'general',
            subtype: properties.subtype || null,
            icon: properties.icon || null,
            display_name: properties.name,
            gender: properties.gender || null,
            priority: properties.priority || null,
            // İçerik alanları
            special_offers: properties.special_offers || null,
            description: properties.description || null,
            phone: properties.phone || null,
            hours: properties.hours || null,
            promotion: properties.promotion || null,
            website: properties.website || null,
            email: properties.email || null,
            instagram: properties.instagram || null,
            twitter: properties.twitter || null,
            services: properties.services || null,
            tags: properties.tags || null,
            header_image: properties.header_image || null,
          });
        }
      });
    });

    // Floor connector'ların corridor'lara bağlantısı
    console.log(
      "🔗 Floor connector'ların corridor'lara bağlantısı kuruluyor..."
    );

    Object.entries(floorData).forEach(([floor, data]) => {
      console.log(
        `🔗 Floor ${floor} için connector bağlantıları kontrol ediliyor...`
      );

      // Floor connector connection edge'lerini bul ve direction'ı al
      const connectorEdges = data.features.filter(
        feature => feature.properties.type === 'floor-connector-connection'
      );

      console.log(
        `📍 Floor ${floor} - Connector edges bulundu: ${connectorEdges.length} adet`
      );

      connectorEdges.forEach(edge => {
        const { from, to, direction, weight, id } = edge.properties;
        const namespacedFrom = `f${floor}-${from}`;
        const namespacedTo = `f${floor}-${to}`;

        // Graph'ta bu node'lar var mı kontrol et
        if (graph[namespacedFrom] && graph[namespacedTo]) {
          console.log(
            `✅ Floor ${floor} - Edge bulundu: ${namespacedFrom} → ${namespacedTo} (${direction})`
          );

          // Direction ile bağlantı kur
          graph[namespacedFrom].neighbors.push({
            to: namespacedTo,
            weight: weight,
            direction: direction, // ✅ GeoJSON'dan direction al!
            type: 'floor-connector-connection',
          });

          // Ters yönde de bağlantı kur (reverse direction ile)
          const reverseDirection = getReverseDirection(direction);
          graph[namespacedTo].neighbors.push({
            to: namespacedFrom,
            weight: weight,
            direction: reverseDirection, // ✅ Ters direction!
            type: 'floor-connector-connection',
          });
        } else {
          console.warn(
            `❌ Floor ${floor} - Edge node'ları bulunamadı: ${namespacedFrom} veya ${namespacedTo}`
          );
        }
      });
    });
    function getReverseDirection(direction) {
      const opposites = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
        northeast: 'southwest',
        northwest: 'southeast',
        southeast: 'northwest',
        southwest: 'northeast',
      };
      return opposites[direction] || direction;
    }

    console.log('🏗️ Multi-floor graph oluşturuldu:', {
      totalNodes: Object.keys(graph).length,
      rooms: rooms.length,
      doors: doors.length,
    });

    const storeList = Array.from(allStores).sort();
    return { graph, rooms, doors, storeList };
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Sol Panel - Oda Seçimi - SADECE MASAÜSTÜNDE */}
      <div
        className={`hidden lg:block h-screen bg-white overflow-y-auto order-0 shadow-lg transition-all duration-300 ${
          isSidebarOpen ? 'w-80' : 'w-0'
        }`}
      >
        {/* Header Section */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-white-600 rounded-lg flex items-center justify-center shadow-md">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3v13l-6 3-6-3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold text-gray-900">SIGNOASSIST</h1>
              <p className="text-xs text-gray-500">
                Explore SignoAssist in your walk
              </p>
            </div>
            {/* Admin Panel Link */}
            <Link
              href="/admin"
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="Admin Panel"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </Link>
            {/* Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              title={isSidebarOpen ? 'Paneli Kapat' : 'Paneli Aç'}
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* YENİ: Harita + Chat Wrapper */}
      <div className="flex-1 flex flex-col">
        {/* Sidebar Toggle Button - Sadece kapalıyken göster */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="hidden lg:block fixed top-4 left-2 z-[60] p-2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors border border-gray-200"
            title="Paneli Aç"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        {/* Harita - Mobilde tam ekran */}
        <div className="flex-1 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-auto relative w-full">
          {/* Kart - Always show when card is not minimized */}
          {/* Oda kartı - sadece içerik varsa göster */}
          {!isCardMinimized &&
            (selectedEndRoom ||
              routeSteps.length > 0 ||
              activeNavItem === 1 ||
              activeNavItem === 2 ||
              activeNavItem === 3) && (
              <div
                className={`
        fixed bottom-16 left-1 right-1 rounded-lg transition-transform duration-300 
        md:absolute md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:top-auto md:rounded-xl md:max-w-96
        bg-white shadow-lg z-40 border border-gray-200
        p-3 pb-4 md:p-4
        ${
          isCardMinimized
            ? 'translate-y-full md:translate-y-full md:translate-x-[-50%]'
            : 'translate-y-0 md:-translate-x-1/2'
        }
        ${activeNavItem !== 0 || routeSteps.length === 0 ? 'md:hidden' : ''}
      `}
              >
                <>
                  <div
                    className={`${activeNavItem === 0 ? 'block' : 'hidden'}`}
                  >
                    {!routeSteps.length ? (
                      // ROTA YOK - Sadece oda bilgileri göster
                      <>
                        {selectedEndRoom ? (
                          // ODA SEÇİLİ - Oda bilgilerini göster - Sadece mobilde göster
                          <div className="md:hidden">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h2 className="text-base font-bold text-gray-800">
                                  {rooms.find(r => r.id === selectedEndRoom)
                                    ?.name || 'Seçili Oda'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                  Kat{' '}
                                  {rooms.find(r => r.id === selectedEndRoom)
                                    ?.floor ?? '?'}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedEndRoom('');
                                  setSelectedStartRoom('');
                                  setIsSelectingStartRoom(false); // Rota seçim modundan çık
                                  setIsCardMinimized(true); // Paneli kapat
                                }}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                              >
                                ✕
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                // Yol tarifi al moduna geç - başlangıç ve bitiş seçim ekranı
                                setIsSelectingStartRoom(true);
                                setSelectedStartRoom(''); // Başlangıcı temizle
                                // selectedEndRoom zaten seçili, onu koru
                                setEndQuery(
                                  rooms.find(r => r.id === selectedEndRoom)
                                    ?.name || ''
                                );
                                setStartQuery('');
                              }}
                              className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
                            >
                              {isSelectingStartRoom
                                ? 'Konumunuzu Seçin'
                                : 'Yol Tarifi Al'}
                            </button>
                          </div>
                        ) : (
                          // HİÇ ODA SEÇİLİ DEĞİL - Boş durum - Sadece mobilde göster
                          <div className="md:hidden text-center py-8">
                            <div className="text-gray-400 mb-2">
                              <svg
                                className="w-12 h-12 mx-auto"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3v13l-6 3-6-3z"
                                />
                              </svg>
                            </div>
                            <p className="text-sm text-gray-500">
                              Henüz bir oda seçilmedi
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Yukarıdaki arama kısmından oda seçebilirsiniz
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      // ROTA VAR - Sadece mobilde göster, desktop'ta haritanın sol altında gösterilecek
                      <div className="md:hidden">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {rooms.find(r => r.id === selectedEndRoom)
                              ?.logo && (
                              <img
                                src={
                                  rooms.find(r => r.id === selectedEndRoom)
                                    ?.logo
                                }
                                alt={`${
                                  rooms.find(r => r.id === selectedEndRoom)
                                    ?.name
                                } Logo`}
                                className="h-10 w-10 object-contain rounded-md border p-1"
                              />
                            )}
                            <div>
                              <h2 className="text-lg font-bold text-gray-800">
                                {rooms.find(r => r.id === selectedEndRoom)
                                  ?.name || 'Seçili Oda'}
                              </h2>
                              {rooms.find(r => r.id === selectedEndRoom)
                                ?.category &&
                                rooms.find(r => r.id === selectedEndRoom)
                                  ?.category !== 'general' && (
                                  <p className="text-xs text-blue-600 font-semibold">
                                    #
                                    {
                                      rooms.find(r => r.id === selectedEndRoom)
                                        ?.category
                                    }
                                  </p>
                                )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleFinish}
                              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-lg"
                            >
                              Rotayı Kapat
                            </button>
                          </div>
                        </div>

                        {/* Rota Özet Bilgileri */}
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span>{Math.ceil(totalDistance / 80)} min</span>
                          <span>{Math.round(totalDistance)} m</span>
                          <span>
                            {new Date(
                              Date.now() + (totalDistance / 80) * 60000
                            ).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Yönlendirme mesajı */}
                        <div className="mb-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                          {/* Üst kısım: Yönlendirme mesajı */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-blue-800 text-sm font-medium flex-1">
                              {getCurrentInstruction()}
                            </div>
                          </div>

                          {/* Alt kısım: İleri/Geri butonları - sadece çok katlı rotalarda */}
                          {Object.keys(routeByFloor).length > 1 && (
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-600">
                                Kat {currentFloor} -{' '}
                                {(() => {
                                  // DÜZELTME: Başlangıç katına göre sırala
                                  const startRoom = rooms.find(
                                    r => r.id === selectedStartRoom
                                  );
                                  const endRoom = rooms.find(
                                    r => r.id === selectedEndRoom
                                  );
                                  const isGoingUp =
                                    endRoom?.floor > startRoom?.floor;

                                  const floors = Object.keys(routeByFloor)
                                    .map(Number)
                                    .sort((a, b) =>
                                      isGoingUp ? a - b : b - a
                                    ); // Rota yönüne göre sırala

                                  const currentIndex = floors.indexOf(
                                    currentFloor
                                  );
                                  return `${currentIndex + 1}/${floors.length}`;
                                })()}
                              </div>

                              <div className="flex gap-2">
                                {/* Geri butonu */}
                                <button
                                  onClick={handlePreviousFloor}
                                  disabled={(() => {
                                    const startRoom = rooms.find(
                                      r => r.id === selectedStartRoom
                                    );
                                    const endRoom = rooms.find(
                                      r => r.id === selectedEndRoom
                                    );
                                    const isGoingUp =
                                      endRoom?.floor > startRoom?.floor;

                                    const floors = Object.keys(routeByFloor)
                                      .map(Number)
                                      .sort((a, b) =>
                                        isGoingUp ? a - b : b - a
                                      );

                                    const currentIndex = floors.indexOf(
                                      currentFloor
                                    );
                                    return currentIndex <= 0;
                                  })()}
                                  className={`text-white text-xs px-2 py-1 rounded transition ${
                                    (() => {
                                      const startRoom = rooms.find(
                                        r => r.id === selectedStartRoom
                                      );
                                      const endRoom = rooms.find(
                                        r => r.id === selectedEndRoom
                                      );
                                      const isGoingUp =
                                        endRoom?.floor > startRoom?.floor;

                                      const floors = Object.keys(routeByFloor)
                                        .map(Number)
                                        .sort((a, b) =>
                                          isGoingUp ? a - b : b - a
                                        );

                                      const currentIndex = floors.indexOf(
                                        currentFloor
                                      );
                                      return currentIndex <= 0;
                                    })()
                                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                      : 'bg-gray-500 hover:bg-gray-600'
                                  }`}
                                >
                                  Geri
                                </button>

                                {/* İleri butonu */}
                                <button
                                  onClick={handleNextFloor}
                                  disabled={(() => {
                                    const startRoom = rooms.find(
                                      r => r.id === selectedStartRoom
                                    );
                                    const endRoom = rooms.find(
                                      r => r.id === selectedEndRoom
                                    );
                                    const isGoingUp =
                                      endRoom?.floor > startRoom?.floor;

                                    const floors = Object.keys(routeByFloor)
                                      .map(Number)
                                      .sort((a, b) =>
                                        isGoingUp ? a - b : b - a
                                      );

                                    const currentIndex = floors.indexOf(
                                      currentFloor
                                    );
                                    return currentIndex >= floors.length - 1;
                                  })()}
                                  className={`text-white text-xs px-2 py-1 rounded transition ${
                                    (() => {
                                      const startRoom = rooms.find(
                                        r => r.id === selectedStartRoom
                                      );
                                      const endRoom = rooms.find(
                                        r => r.id === selectedEndRoom
                                      );
                                      const isGoingUp =
                                        endRoom?.floor > startRoom?.floor;

                                      const floors = Object.keys(routeByFloor)
                                        .map(Number)
                                        .sort((a, b) =>
                                          isGoingUp ? a - b : b - a
                                        );

                                      const currentIndex = floors.indexOf(
                                        currentFloor
                                      );
                                      return currentIndex >= floors.length - 1;
                                    })()
                                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                      : 'bg-blue-600 hover:bg-blue-700'
                                  }`}
                                >
                                  İlerle
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* CHAT NAVBAR İÇERİĞİ - Sadece mobilde */}
                  <div
                    className={`md:hidden ${
                      activeNavItem === 1 ? 'block' : 'hidden'
                    }`}
                  >
                    {/* Mobil input kısmı - TAB 1 içindeki input'u da güncelle */}
                    <div className="block">
                      <div className="h-80 flex flex-col">
                        {/* Chat mesajları */}
                        <div className="flex-1 overflow-y-auto border rounded-lg p-3 mb-3 bg-gray-50">
                          {chatMessages
                            .filter(m => m.role !== 'system')
                            .map((msg, i) => (
                              <div
                                key={i}
                                className={`mb-3 p-2 rounded-lg ${
                                  msg.role === 'user'
                                    ? 'bg-blue-100 ml-8'
                                    : 'bg-white mr-8'
                                }`}
                              >
                                <div className="text-xs font-semibold mb-1 text-gray-600">
                                  {msg.role === 'user' ? 'Siz' : 'Asistan'}
                                </div>
                                <div className="text-sm">{msg.content}</div>
                              </div>
                            ))}
                          <div ref={chatMessagesEndRefMobile} />

                          {/* Voice Processing Indicator */}
                          {isVoiceProcessing && (
                            <div className="mb-3 p-2 rounded-lg bg-gray-200 mr-8">
                              <div className="text-xs font-semibold mb-1 text-gray-600">
                                Asistan
                              </div>
                              <div className="text-sm flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 animate-spin"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                Ses işleniyor...
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Input alanı - Mobile */}
                        <div className="flex gap-2">
                          <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                            placeholder="Mesajınızı yazın..."
                            className="flex-1 px-3 py-2 border rounded-lg text-sm"
                            disabled={isVoiceProcessing}
                          />

                          {/* Send Button - Mobile */}
                          <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isVoiceProcessing}
                            className={`px-3 py-2 text-white rounded-xl text-sm transition-colors ${
                              input.trim() && !isVoiceProcessing
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-gray-400 cursor-not-allowed'
                            }`}
                          >
                            ➤
                          </button>

                          {/* Voice Button - Mobile */}
                          <button
                            onClick={handleVoiceButtonClick}
                            disabled={isVoiceProcessing}
                            className={`px-3 py-2 text-white rounded-xl text-sm transition-all relative ${
                              isRecording
                                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                                : isVoiceProcessing
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isVoiceProcessing ? (
                              <svg
                                className="w-4 h-4 animate-spin"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            ) : isRecording ? (
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <rect
                                  x="6"
                                  y="6"
                                  width="12"
                                  height="12"
                                  rx="2"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                              </svg>
                            )}

                            {/* Recording Pulse Effect - Mobile */}
                            {isRecording && (
                              <div className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-20"></div>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Boş Navbar İçerikleri */}
                  <div
                    className={`block md:hidden ${
                      activeNavItem === 2 ? 'block' : 'hidden'
                    }`}
                  >
                    <div className="h-80 overflow-y-auto space-y-3">
                      {/* Popüler Yerler */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                          Popüler Yerler
                        </h3>
                        <div className="relative flex items-center gap-1">
                          {/* Sol Ok - Küçük */}
                          <button
                            className="flex-shrink-0 bg-white hover:bg-gray-50 rounded-full p-1.5 shadow-sm transition-all border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed z-10"
                            onClick={() => {
                              const popularRooms = rooms.filter(r => r.logo);
                              if (popularPlacesIndex > 0) {
                                setPopularPlacesIndex(popularPlacesIndex - 1);
                              }
                            }}
                            disabled={popularPlacesIndex === 0}
                          >
                            <svg
                              className="w-3 h-3 text-gray-700"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M15 19l-7-7 7-7"
                              />
                            </svg>
                          </button>

                          {/* Carousel Container */}
                          <div
                            className="flex-1 relative h-40 overflow-hidden"
                            onTouchStart={e => {
                              setTouchEnd(null);
                              setTouchStart(e.targetTouches[0].clientX);
                            }}
                            onTouchMove={e => {
                              setTouchEnd(e.targetTouches[0].clientX);
                            }}
                            onTouchEnd={() => {
                              if (!touchStart || !touchEnd) return;
                              const distance = touchStart - touchEnd;
                              const isLeftSwipe = distance > 50;
                              const isRightSwipe = distance < -50;

                              const popularRooms = rooms.filter(r => r.logo);

                              if (
                                isLeftSwipe &&
                                popularPlacesIndex < popularRooms.length - 1
                              ) {
                                setPopularPlacesIndex(popularPlacesIndex + 1);
                              }
                              if (isRightSwipe && popularPlacesIndex > 0) {
                                setPopularPlacesIndex(popularPlacesIndex - 1);
                              }
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center gap-2 px-1 transition-transform duration-500 ease-out">
                              {(() => {
                                const popularRooms = rooms.filter(r => r.logo);
                                if (popularRooms.length === 0) {
                                  return (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">
                                      Popüler yer bulunamadı
                                    </div>
                                  );
                                }

                                const prevIndex =
                                  popularPlacesIndex > 0
                                    ? popularPlacesIndex - 1
                                    : null;
                                const currentIndex = popularPlacesIndex;
                                const nextIndex =
                                  popularPlacesIndex < popularRooms.length - 1
                                    ? popularPlacesIndex + 1
                                    : null;

                                const renderCard = (room, isCenter, index) => (
                                  <div
                                    key={room.id}
                                    onClick={() => {
                                      if (!isCenter) {
                                        setPopularPlacesIndex(index);
                                      }
                                    }}
                                    className={`bg-white rounded-lg border border-gray-200 flex-shrink-0 transition-all duration-500 ease-out ${
                                      isCenter
                                        ? 'w-[55%] h-full p-3 shadow-md'
                                        : 'w-[22%] h-[85%] p-2 shadow-sm cursor-pointer hover:opacity-80'
                                    }`}
                                  >
                                    <div
                                      className={`h-full flex flex-col overflow-hidden transition-opacity duration-500 ${
                                        isCenter ? 'opacity-100' : 'opacity-40'
                                      }`}
                                    >
                                      {/* Üst Kısım: Logo ve Bilgiler */}
                                      <div
                                        className={`flex gap-2 ${
                                          isCenter ? 'mb-2' : 'mb-1'
                                        }`}
                                      >
                                        {/* Logo */}
                                        <img
                                          src={room.logo}
                                          alt={room.name}
                                          className={`flex-shrink-0 object-contain rounded-lg border border-gray-200 bg-white transition-all duration-500 ${
                                            isCenter
                                              ? 'h-12 w-12 p-1.5'
                                              : 'h-8 w-8 p-1'
                                          }`}
                                        />

                                        {/* Bilgiler */}
                                        <div className="flex-1 min-w-0">
                                          <h4
                                            className={`font-bold text-gray-800 mb-0.5 truncate transition-all duration-500 ${
                                              isCenter
                                                ? 'text-xs'
                                                : 'text-[9px]'
                                            }`}
                                          >
                                            {room.name}
                                          </h4>
                                          <p
                                            className={`text-gray-600 whitespace-nowrap transition-all duration-500 ${
                                              isCenter
                                                ? 'text-[10px]'
                                                : 'text-[8px]'
                                            }`}
                                          >
                                            {room.openingHours ||
                                              '10:00 - 22:00'}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Kategori ve Etiketler */}
                                      <div
                                        className={`flex items-center gap-1.5 mb-2 flex-wrap transition-all duration-500 ${
                                          isCenter
                                            ? 'opacity-100'
                                            : 'opacity-60'
                                        }`}
                                      >
                                        <span
                                          className={`bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium transition-all duration-500 ${
                                            isCenter
                                              ? 'text-[10px]'
                                              : 'text-[7px]'
                                          }`}
                                        >
                                          {room.category || 'Mağaza'}
                                        </span>
                                        {room.tags && (Array.isArray(room.tags) ? room.tags.length > 0 : room.tags.trim() !== '') ? (
                                          (Array.isArray(room.tags) ? room.tags : room.tags.split(',').map(t => t.trim()))
                                            .slice(0, 1)
                                            .map((tag, idx) => (
                                              <span
                                                key={idx}
                                                className={`bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full transition-all duration-500 ${
                                                  isCenter
                                                    ? 'text-[10px]'
                                                    : 'text-[7px]'
                                                }`}
                                              >
                                                {tag}
                                              </span>
                                            ))
                                        ) : (
                                          <span
                                            className={`bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full transition-all duration-500 ${
                                              isCenter
                                                ? 'text-[10px]'
                                                : 'text-[7px]'
                                            }`}
                                          >
                                            Kat {room.floor}
                                          </span>
                                        )}
                                      </div>

                                      {/* Yol Tarif Butonu - Sadece ortadaki kartta */}
                                      {isCenter && (
                                        <button
                                          onClick={() => {
                                            setSelectedEndRoom(room.id);
                                            setEndQuery(room.name);
                                            setActiveNavItem(0);
                                          }}
                                          className="mt-auto w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-xs py-1.5 px-3"
                                        >
                                          Yol Tarifi Al
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );

                                return (
                                  <>
                                    {prevIndex !== null &&
                                      renderCard(
                                        popularRooms[prevIndex],
                                        false,
                                        prevIndex
                                      )}
                                    {renderCard(
                                      popularRooms[currentIndex],
                                      true,
                                      currentIndex
                                    )}
                                    {nextIndex !== null &&
                                      renderCard(
                                        popularRooms[nextIndex],
                                        false,
                                        nextIndex
                                      )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Sağ Ok - Küçük */}
                          <button
                            className="flex-shrink-0 bg-white hover:bg-gray-50 rounded-full p-1.5 shadow-sm transition-all border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed z-10"
                            onClick={() => {
                              const popularRooms = rooms.filter(r => r.logo);
                              if (
                                popularPlacesIndex <
                                popularRooms.length - 1
                              ) {
                                setPopularPlacesIndex(popularPlacesIndex + 1);
                              }
                            }}
                            disabled={
                              popularPlacesIndex >=
                              rooms.filter(r => r.logo).length - 1
                            }
                          >
                            <svg
                              className="w-3 h-3 text-gray-700"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Kampanyalar */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                          Kampanyalar
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-2">
                          {(() => {
                            // Özel teklifleri olan mağazaları filtrele
                            console.log('🔍 Tüm rooms:', rooms.length);
                            console.log('🔍 İlk 3 room örneği:', rooms.slice(0, 3));
                            const offersRooms = rooms.filter(
                              r => r.special_offers && r.special_offers.trim() !== ''
                            );
                            console.log('🎁 Özel teklifli mağazalar:', offersRooms.length, offersRooms);

                            if (offersRooms.length === 0) {
                              return (
                                <div className="h-36 flex items-center justify-center text-gray-400 text-sm">
                                  Henüz kampanya bulunmuyor
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                {offersRooms.map((room, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => {
                                      setSelectedEndRoom(room.id);
                                      setEndQuery(room.name);
                                      setActiveNavItem(0);
                                    }}
                                  >
                                    {/* Mağaza İsmi */}
                                    <h4 className="text-sm font-bold text-gray-800 mb-1">
                                      {room.name}
                                    </h4>
                                    {/* Özel Teklif */}
                                    <p className="text-xs text-gray-600">
                                      {room.special_offers}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`block md:hidden ${
                      activeNavItem === 3 ? 'block' : 'hidden'
                    }`}
                  >
                    <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
                      <div className="text-center text-gray-500">
                        <div className="text-4xl mb-2">🔧</div>
                        <div className="text-sm">
                          Bu bölüm henüz hazır değil
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              </div>
            )}

          <div className="w-full h-full r" ref={mapContainerRef} />

          {/* Desktop Bilgi Kartları - Haritanın sol altında */}
          {routeSteps.length > 0 ? (
            <div className="hidden md:block absolute bottom-4 left-24 max-w-sm min-w-[380px] z-40">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4 min-h-[190px]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {rooms.find(r => r.id === selectedEndRoom)?.logo && (
                      <img
                        src={rooms.find(r => r.id === selectedEndRoom)?.logo}
                        alt={`${
                          rooms.find(r => r.id === selectedEndRoom)?.name
                        } Logo`}
                        className="h-10 w-10 object-contain rounded-md border p-1"
                      />
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">
                        {rooms.find(r => r.id === selectedEndRoom)?.name ||
                          'Seçili Oda'}
                      </h2>
                      {rooms.find(r => r.id === selectedEndRoom)?.category &&
                        rooms.find(r => r.id === selectedEndRoom)?.category !==
                          'general' && (
                          <p className="text-xs text-blue-600 font-semibold">
                            #
                            {
                              rooms.find(r => r.id === selectedEndRoom)
                                ?.category
                            }
                          </p>
                        )}
                    </div>
                  </div>
                  <button
                    onClick={handleFinish}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-lg"
                  >
                    Rotayı Kapat
                  </button>
                </div>

                {/* Rota Özet Bilgileri */}
                <div className="flex items-center justify-between text-sm mb-3">
                  <span>{Math.ceil(totalDistance / 80)} min</span>
                  <span>{Math.round(totalDistance)} m</span>
                  <span>
                    {new Date(
                      Date.now() + (totalDistance / 80) * 60000
                    ).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Yönlendirme mesajı */}
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  {/* Üst kısım: Yönlendirme mesajı */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-blue-800 text-sm font-medium flex-1">
                      {getCurrentInstruction()}
                    </div>
                  </div>

                  {/* Alt kısım: İleri/Geri butonları - sadece çok katlı rotalarda */}
                  {Object.keys(routeByFloor).length > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        Kat {currentFloor} -{' '}
                        {(() => {
                          // DÜZELTME: Başlangıç katına göre sırala
                          const startRoom = rooms.find(
                            r => r.id === selectedStartRoom
                          );
                          const endRoom = rooms.find(
                            r => r.id === selectedEndRoom
                          );
                          const isGoingUp = endRoom?.floor > startRoom?.floor;

                          const floors = Object.keys(routeByFloor)
                            .map(Number)
                            .sort((a, b) => (isGoingUp ? a - b : b - a)); // Rota yönüne göre sırala

                          const currentIndex = floors.indexOf(currentFloor);
                          return `${currentIndex + 1}/${floors.length}`;
                        })()}
                      </div>

                      <div className="flex gap-2">
                        {/* Geri butonu */}
                        <button
                          onClick={handlePreviousFloor}
                          disabled={(() => {
                            const startRoom = rooms.find(
                              r => r.id === selectedStartRoom
                            );
                            const endRoom = rooms.find(
                              r => r.id === selectedEndRoom
                            );
                            const isGoingUp = endRoom?.floor > startRoom?.floor;

                            const floors = Object.keys(routeByFloor)
                              .map(Number)
                              .sort((a, b) => (isGoingUp ? a - b : b - a));

                            const currentIndex = floors.indexOf(currentFloor);
                            return currentIndex <= 0;
                          })()}
                          className={`text-white text-xs px-2 py-1 rounded transition ${
                            (() => {
                              const startRoom = rooms.find(
                                r => r.id === selectedStartRoom
                              );
                              const endRoom = rooms.find(
                                r => r.id === selectedEndRoom
                              );
                              const isGoingUp =
                                endRoom?.floor > startRoom?.floor;

                              const floors = Object.keys(routeByFloor)
                                .map(Number)
                                .sort((a, b) => (isGoingUp ? a - b : b - a));

                              const currentIndex = floors.indexOf(currentFloor);
                              return currentIndex <= 0;
                            })()
                              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                              : 'bg-gray-500 hover:bg-gray-600'
                          }`}
                        >
                          Geri
                        </button>

                        {/* İleri butonu */}
                        <button
                          onClick={handleNextFloor}
                          disabled={(() => {
                            const startRoom = rooms.find(
                              r => r.id === selectedStartRoom
                            );
                            const endRoom = rooms.find(
                              r => r.id === selectedEndRoom
                            );
                            const isGoingUp = endRoom?.floor > startRoom?.floor;

                            const floors = Object.keys(routeByFloor)
                              .map(Number)
                              .sort((a, b) => (isGoingUp ? a - b : b - a));

                            const currentIndex = floors.indexOf(currentFloor);
                            return currentIndex >= floors.length - 1;
                          })()}
                          className={`text-white text-xs px-2 py-1 rounded transition ${
                            (() => {
                              const startRoom = rooms.find(
                                r => r.id === selectedStartRoom
                              );
                              const endRoom = rooms.find(
                                r => r.id === selectedEndRoom
                              );
                              const isGoingUp =
                                endRoom?.floor > startRoom?.floor;

                              const floors = Object.keys(routeByFloor)
                                .map(Number)
                                .sort((a, b) => (isGoingUp ? a - b : b - a));

                              const currentIndex = floors.indexOf(currentFloor);
                              return currentIndex >= floors.length - 1;
                            })()
                              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          İlerle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : selectedEndRoom ? (
            // Desktop'ta oda seçilmiş durumu - Haritanın sol altında
            <div className="hidden md:block absolute bottom-4 left-16 max-w-sm min-w-[380px] z-40">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4 min-h-[190px]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-800">
                      {rooms.find(r => r.id === selectedEndRoom)?.name ||
                        'Seçili Oda'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Kat{' '}
                      {rooms.find(r => r.id === selectedEndRoom)?.floor ?? '?'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEndRoom('');
                      setSelectedStartRoom('');
                      setIsSelectingStartRoom(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                  >
                    ✕
                  </button>
                </div>

                <button
                  onClick={() => {
                    // Yol tarifi al moduna geç - başlangıç ve bitiş seçim ekranı
                    setIsSelectingStartRoom(true);
                    setSelectedStartRoom(''); // Başlangıcı temizle
                    // selectedEndRoom zaten seçili, onu koru
                    setEndQuery(
                      rooms.find(r => r.id === selectedEndRoom)?.name || ''
                    );
                    setStartQuery('');
                  }}
                  className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition mt-4"
                >
                  {isSelectingStartRoom ? 'Konumunuzu Seçin' : 'Yol Tarifi Al'}
                </button>
              </div>
            </div>
          ) : (
            // Desktop'ta oda seçilmedi durumu - Haritanın sol altında
            <div className="hidden md:block absolute bottom-4 left-16 max-w-sm min-w-[380px] z-40">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4 min-h-[190px]">
                <div className="text-center py-4">
                  <div className="text-gray-400 mb-3">
                    <svg
                      className="w-12 h-12 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3v13l-6 3-6-3z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    Henüz bir oda seçilmedi
                  </p>
                  <p className="text-xs text-gray-400">
                    Yukarıdaki arama kısmından oda seçebilirsiniz
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Google Maps tarzı arama çubuğu - Harita üzerinde */}
          <div className="absolute top-4 left-4 right-4 md:left-16 md:max-w-xl z-50">
            <div className="flex items-center gap-3">
              {/* Hamburger Menu -> İLeride ihtiyaca göre aktif edilebilir
              <button className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button> */}
              {/* Arama Çubuğu - Normal modda tek input, Rota modunda çift input */}
              <div className="flex-1 relative">
                {!isSelectingStartRoom && !routeSteps.length ? (
                  // Normal arama modu
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={'Mağaza Ara'}
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => {
                        setIsSearchFocused(true);
                        setShowSearchDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setIsSearchFocused(false);
                          setShowSearchDropdown(false);
                        }, 200);
                      }}
                      className="w-full px-4 py-3 pr-12 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg"
                    />

                    {/* Ses Butonu */}
                    <button
                      onClick={handleVoiceButtonClick}
                      disabled={isVoiceProcessing}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  // Rota seçim modu - çift input (tek input görünümünde)
                  <div className="relative">
                    <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg">
                      {/* Başlangıç Noktası */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-400 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        </div>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Başlangıç noktası seçin"
                            value={startQuery}
                            onChange={e => {
                              setStartQuery(e.target.value);
                              setShowStartDropdown(true);
                            }}
                            onFocus={() => setShowStartDropdown(true)}
                            onBlur={() => {
                              setTimeout(
                                () => setShowStartDropdown(false),
                                200
                              );
                            }}
                            className="w-full bg-transparent text-sm focus:outline-none placeholder-gray-500"
                          />

                          {/* Başlangıç Dropdown */}
                          {showStartDropdown && startQuery && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-[60]">
                              {rooms
                                .filter(r =>
                                  r.name
                                    .toLowerCase()
                                    .includes(startQuery.toLowerCase())
                                )
                                .slice(0, 5)
                                .map(r => (
                                  <div
                                    key={r.id}
                                    onClick={() => {
                                      setSelectedStartRoom(r.id);
                                      setStartQuery(r.name);
                                      setShowStartDropdown(false);
                                      // Rota panelini aç
                                      setActiveNavItem(0);
                                      setIsCardMinimized(false);
                                    }}
                                    className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                                  >
                                    {r.name}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleFinish}
                          className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Bitiş Noktası */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                          </svg>
                        </div>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Hedef noktası seçin"
                            value={endQuery}
                            onChange={e => {
                              setEndQuery(e.target.value);
                              setShowEndDropdown(true);
                            }}
                            onFocus={() => setShowEndDropdown(true)}
                            onBlur={() => {
                              setTimeout(() => setShowEndDropdown(false), 200);
                            }}
                            className="w-full bg-transparent text-sm focus:outline-none placeholder-gray-500"
                          />

                          {/* Bitiş Dropdown */}
                          {showEndDropdown && endQuery && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-[60]">
                              {rooms
                                .filter(r =>
                                  r.name
                                    .toLowerCase()
                                    .includes(endQuery.toLowerCase())
                                )
                                .slice(0, 5)
                                .map(r => (
                                  <div
                                    key={r.id}
                                    onClick={() => {
                                      setSelectedEndRoom(r.id);
                                      setEndQuery(r.name);
                                      setShowEndDropdown(false);
                                      // Rota panelini aç
                                      setActiveNavItem(0);
                                      setIsCardMinimized(false);
                                    }}
                                    className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                                  >
                                    {r.name}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            // Başlangıç ve bitiş noktalarını değiştir
                            const tempStartRoom = selectedStartRoom;
                            const tempStartQuery = startQuery;
                            setSelectedStartRoom(selectedEndRoom);
                            setStartQuery(endQuery);
                            setSelectedEndRoom(tempStartRoom);
                            setEndQuery(tempStartQuery);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Arama Sonuçları Dropdown - Sadece normal modda */}
                {!isSelectingStartRoom &&
                  showSearchDropdown &&
                  searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                      {searchResults.slice(0, 10).map(room => (
                        <div
                          key={room.id}
                          onClick={() => handleSearchResultSelect(room)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900 text-sm">
                                {room.name}
                              </div>
                              {room.is_special && (
                                <div className="text-xs text-blue-600 mt-1">
                                  {room.special_type === 'wc-male' &&
                                    '🚹 Erkek Tuvaleti'}
                                  {room.special_type === 'wc-female' &&
                                    '🚺 Kadın Tuvaleti'}
                                  {room.special_type === 'wc-disabled' &&
                                    '♿ Engelli Tuvaleti'}
                                  {room.special_type === 'atm' && '🏧 ATM'}
                                  {room.special_type === 'pharmacy' &&
                                    '💊 Eczane'}
                                  {room.special_type === 'emergency-exit' &&
                                    '🚪 Acil Çıkış'}
                                  {room.special_type === 'fire-exit' &&
                                    '🔥 Yangın Merdiveni'}
                                  {room.special_type === 'baby-care' &&
                                    '👶 Bebek Bakım'}
                                  {room.special_type === 'first-aid' &&
                                    '🏥 İlk Yardım'}
                                  {room.special_type === 'info-desk' &&
                                    'ℹ️ Bilgi Masası'}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              Kat {room.floor}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Sonuç yok mesajı - Sadece normal modda */}
                {!isSelectingStartRoom &&
                  showSearchDropdown &&
                  searchQuery &&
                  searchResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        "{searchQuery}" için sonuç bulunamadı
                      </div>
                    </div>
                  )}
              </div>

              {/* Sağdaki İkonlar */}
              <div className="flex items-center gap-2">
                {/* Ulaşım Tercihi Toggle */}
                <button
                  onClick={() =>
                    setPreferredTransport(
                      preferredTransport === 'escalator'
                        ? 'elevator'
                        : 'escalator'
                    )
                  }
                  className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg text-gray-600 hover:text-gray-800 transition-colors"
                  title={`Ulaşım: ${
                    preferredTransport === 'escalator'
                      ? 'Yürüyen Merdiven'
                      : 'Asansör'
                  }`}
                >
                  {preferredTransport === 'escalator' ? (
                    <span className="text-lg">🔄</span>
                  ) : (
                    <span className="text-lg">🛗</span>
                  )}
                </button>

                {/* Profil Fotoğrafı */}
                <button className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </button>
              </div>

              {/* Kat Seçimi Butonları - Profil butonunun altında */}
              <div className="absolute top-full left-0 mt-2">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 py-2 px-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold text-gray-500 tracking-wide">
                      KAT
                    </div>
                    <div className="w-6 h-px bg-gray-300"></div>
                    {Object.keys(geojsonURLS)
                      .map(Number)
                      .sort((a, b) => b - a)
                      .map(floor => (
                        <button
                          key={floor}
                          onClick={() => changeFloor(parseInt(floor))}
                          className={`
                            w-8 h-8 rounded-full font-bold text-sm
                            min-w-8 min-h-8 transition-all 
                            duration-300 hover:scale-110
                            ${
                              currentFloor == floor
                                ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                                : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                            }
                          `}
                          style={{
                            minWidth: '32px',
                            minHeight: '32px',
                          }}
                        >
                          {floor}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Hızlı Erişim Butonları - Google Maps tarzı - Rota varsa gizle */}
            {!routeSteps.length && (
              <div className="mt-2 relative">
                <div className="flex items-center gap-2">
                  {/* Sol Ok */}
                  <button
                    onClick={() => {
                      const container = document.getElementById(
                        'quick-access-container'
                      );
                      if (container) {
                        const buttons = container.querySelectorAll('button');
                        if (buttons.length > 0) {
                          const buttonWidth = buttons[0].offsetWidth + 6; // gap-1.5 = 6px
                          const scrollAmount = buttonWidth * 3; // 3 buton genişliği
                          container.scrollLeft -= scrollAmount;
                        }
                      }
                    }}
                    className="p-1 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  {/* Butonlar Container */}
                  <div
                    id="quick-access-container"
                    className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 transition-all duration-300 ease-in-out"
                  >
                    {quickAccessList.map(location => (
                      <button
                        key={location.key}
                        onClick={() => handleQuickAccessItemClick(location.key)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                          selectedQuickAccess === location.key
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{location.icon}</span>
                          <span>{location.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Sağ Ok */}
                  <button
                    onClick={() => {
                      const container = document.getElementById(
                        'quick-access-container'
                      );
                      if (container) {
                        const buttons = container.querySelectorAll('button');
                        if (buttons.length > 0) {
                          const buttonWidth = buttons[0].offsetWidth + 6; // gap-1.5 = 6px
                          const scrollAmount = buttonWidth * 3; // 3 buton genişliği
                          container.scrollLeft += scrollAmount;
                        }
                      }
                    }}
                    className="p-1 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navbar - Mobilde sabit */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
          <div className="flex items-center justify-around py-2">
            {/* Asistan */}
            <button
              onClick={() => {
                console.log('🔵 Asistan navbar button clicked!');
                console.log('Current activeNavItem:', activeNavItem);
                console.log('Current isCardMinimized:', isCardMinimized);

                if (activeNavItem === 1 && !isCardMinimized) {
                  // Aynı navbar öğesine tekrar basıldığında paneli kapat
                  console.log('🔵 Closing chat panel');
                  setIsCardMinimized(true);
                } else {
                  // Farklı navbar öğesine basıldığında veya panel kapalıysa aç
                  console.log('🔵 Opening chat panel');
                  setActiveNavItem(1);
                  setIsCardMinimized(false);
                }
              }}
              className="flex flex-col items-center py-2 px-3"
            >
              <svg
                className={`w-6 h-6 mb-1 ${
                  activeNavItem === 1 ? 'text-blue-600' : 'text-gray-500'
                }`}
                fill={activeNavItem === 1 ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span
                className={`text-xs ${
                  activeNavItem === 1
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500'
                }`}
              >
                Asistan
              </span>
            </button>

            {/* Rota */}
            <button
              onClick={() => {
                console.log('🟢 Rota navbar button clicked!');
                console.log('selectedEndRoom:', selectedEndRoom);
                console.log('routeSteps.length:', routeSteps.length);
                console.log('Current activeNavItem:', activeNavItem);
                console.log('Current isCardMinimized:', isCardMinimized);

                // Sadece seçili oda veya rota varsa çalışsın
                if (selectedEndRoom || routeSteps.length > 0) {
                  if (activeNavItem === 0 && !isCardMinimized) {
                    // Aynı navbar öğesine tekrar basıldığında paneli kapat
                    console.log('🟢 Closing route panel');
                    setIsCardMinimized(true);
                  } else {
                    // Farklı navbar öğesine basıldığında veya panel kapalıysa aç
                    console.log('🟢 Opening route panel');
                    setActiveNavItem(0);
                    setIsCardMinimized(false);
                  }
                } else {
                  console.log('🟢 No room/route selected, button disabled');
                }
              }}
              className={`flex flex-col items-center py-2 px-3 ${
                !selectedEndRoom && routeSteps.length === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              <svg
                className={`w-6 h-6 mb-1 ${
                  activeNavItem === 0 ? 'text-blue-600' : 'text-gray-500'
                }`}
                fill={activeNavItem === 0 ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3v13l-6 3-6-3z"
                />
              </svg>
              <span
                className={`text-xs ${
                  activeNavItem === 0
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500'
                }`}
              >
                Rota
              </span>
            </button>

            {/* Keşfet */}
            <button
              onClick={() => {
                if (activeNavItem === 2 && !isCardMinimized) {
                  // Aynı navbar öğesine tekrar basıldığında paneli kapat
                  setIsCardMinimized(true);
                } else {
                  // Farklı navbar öğesine basıldığında veya panel kapalıysa aç
                  setActiveNavItem(2);
                  setIsCardMinimized(false);
                }
              }}
              className="flex flex-col items-center py-2 px-3"
            >
              <svg
                className={`w-6 h-6 mb-1 ${
                  activeNavItem === 2 ? 'text-blue-600' : 'text-gray-500'
                }`}
                fill={activeNavItem === 2 ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span
                className={`text-xs ${
                  activeNavItem === 2
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500'
                }`}
              >
                Keşfet
              </span>
            </button>

            {/* Boş 2 */}
            <button
              onClick={() => {
                if (activeNavItem === 3 && !isCardMinimized) {
                  // Aynı navbar öğesine tekrar basıldığında paneli kapat
                  setIsCardMinimized(true);
                } else {
                  // Farklı navbar öğesine basıldığında veya panel kapalıysa aç
                  setActiveNavItem(3);
                  setIsCardMinimized(false);
                }
              }}
              className="flex flex-col items-center py-2 px-3"
            >
              <svg
                className={`w-6 h-6 mb-1 ${
                  activeNavItem === 3 ? 'text-blue-600' : 'text-gray-500'
                }`}
                fill={activeNavItem === 3 ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span
                className={`text-xs ${
                  activeNavItem === 3
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500'
                }`}
              >
                Boş
              </span>
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="hidden md:flex flex-col h-1/3 bg-gray-50">
          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages
              .filter(m => m.role !== 'system')
              .map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`px-4 py-2 rounded-2xl max-w-[75%] text-[15px] leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-white text-gray-900'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Input alanı - Desktop */}
          <div className="bg-white p-4">
            <div className="flex items-center gap-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Mesajınızı yazın..."
                className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-4 text-sm placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isVoiceProcessing}
              />

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isVoiceProcessing}
                className={`rounded-full text-white transition-colors shadow-sm p-4 ${
                  input.trim() && !isVoiceProcessing
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                ➤
              </button>

              {/* Voice Button - GÜNCELLENMIŞ */}
              <button
                onClick={handleVoiceButtonClick}
                disabled={isVoiceProcessing}
                className={`rounded-full text-white transition-all duration-200 shadow-sm p-4 relative ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                    : isVoiceProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title={
                  isRecording
                    ? 'Kaydı durdur'
                    : isVoiceProcessing
                    ? 'Ses işleniyor...'
                    : 'Sesli mesaj gönder'
                }
              >
                {/* Voice State Indicator */}
                {isVoiceProcessing ? (
                  <SVGVoiceProcessing />
                ) : isRecording ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <SVGMicrophone />
                )}

                {/* Recording Pulse Effect */}
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

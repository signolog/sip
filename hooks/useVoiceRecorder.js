// hooks/useVoiceChat.js
import { useState, useRef, useCallback } from "react";

export const useVoiceRecorder = (options = {}) => {
  const {
    positiveSpeechThreshold = 0.8,
    negativeSpeechThreshold = 0.6,
    redemptionFrames = 20,
    frameSamples = 1536,
    preSpeechPadFrames = 5,
    minSpeechFrames = 3,
    enableFallback = false,
    requireDepsTimeoutMs = 8000,
    onTranscription = null,
  } = options;

  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [vadInitialized, setVadInitialized] = useState(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [microphoneReleased, setMicrophoneReleased] = useState(false);

  // Refs
  const globalVADInstance = useRef(null);
  const audioStream = useRef(null);
  const vadAudioBuffer = useRef(null);
  const deviceId = useRef(null);
  const onTranscribedRef = useRef(null);

  // Fallback recorder refs
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const fallbackChunksRef = useRef([]);
  const isFallbackModeRef = useRef(false);
  const startAbortRef = useRef(null);

  const [depsReady, setDepsReady] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState(null);
  const [lastErrorMessage, setLastErrorMessage] = useState(null);

  const updateError = useCallback((code, message) => {
    setLastErrorCode(code);
    setLastErrorMessage(message);
    setError(message);
  }, []);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const ensureDependenciesReady = useCallback(
    async (timeoutMs = requireDepsTimeoutMs) => {
      if (typeof window === "undefined") {
        throw new Error("Window not available");
      }

      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        try {
          if (!window.ort) {
            console.log("⏳ Waiting for window.ort...");
            await wait(200);
            continue;
          }

          if (!window.ort.env) {
            console.log("⏳ Waiting for window.ort.env...");
            await wait(200);
            continue;
          }

          if (!window.ort.env.wasm) {
            console.log("🔧 Creating WASM environment manually...");
            window.ort.env.wasm = {};
          }

          if (!window.vad) {
            console.log("⏳ Waiting for window.vad...");
            await wait(200);
            continue;
          }

          console.log("✅ All dependencies ready!");
          setDepsReady(true);
          return true;
        } catch (error) {
          console.warn("Dependency check error:", error);
          await wait(200);
        }
      }

      const missingDeps = [];
      if (!window.ort) missingDeps.push("ort");
      if (!window.ort?.env) missingDeps.push("ort.env");
      if (!window.ort?.env?.wasm) missingDeps.push("ort.env.wasm");
      if (!window.vad) missingDeps.push("vad");

      throw new Error(`Dependencies timeout. Missing: ${missingDeps.join(", ")}`);
    },
    [requireDepsTimeoutMs]
  );

  const generateDeviceId = () => {
    if (!deviceId.current) {
      let stored = localStorage.getItem("chat_device_id");
      if (!stored) {
        stored =
          "device_" +
          Date.now() +
          "_" +
          Math.random()
            .toString(36)
            .substr(2, 9);
        localStorage.setItem("chat_device_id", stored);
      }
      deviceId.current = stored;
    }
    return deviceId.current;
  };

  const checkMicrophonePermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: "microphone" });
      const granted = result.state === "granted";
      setMicPermissionGranted(granted);
      return granted;
    } catch (error) {
      console.log("Permissions API desteklenmiyor");
      setMicPermissionGranted(false);
      return false;
    }
  }, []);

  const convertFloat32ToWav = useCallback((float32Array, sampleRate = 16000) => {
    const length = float32Array.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, "WAVE");

    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    writeString(36, "data");
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  }, []);

  // ÖNEMLİ DEĞİŞİKLİK: VAD'ı her seferinde yeniden başlat
  const initializeVAD = useCallback(
    async (stream) => {
      console.log("🔍 VAD initialization attempt");

      try {
        await ensureDependenciesReady();

        // Mevcut VAD instance'ını temizle
        if (globalVADInstance.current) {
          try {
            globalVADInstance.current.destroy();
            globalVADInstance.current = null;
            console.log("🗑️ Eski VAD instance temizlendi");
          } catch (e) {
            console.warn("VAD destroy hatası (göz ardı edildi):", e);
          }
        }

        // Yeni VAD instance oluştur ve stream'i doğrudan ver
        globalVADInstance.current = await window.vad.MicVAD.new({
          stream: stream, // ÖNEMLİ: Stream'i direkt olarak VAD'a ver
          onSpeechStart: () => {
            console.log("🎤 Konuşma başladı");
            setIsSpeechActive(true);
          },
          onSpeechEnd: (audio) => {
            console.log("🔇 Konuşma bitti");
            setIsSpeechActive(false);
            vadAudioBuffer.current = audio;

            // Mikrofonu hemen serbest bırak
            try {
              if (globalVADInstance.current) {
                globalVADInstance.current.pause();
              }
              if (audioStream.current) {
                audioStream.current.getTracks().forEach((t) => t.stop());
                audioStream.current = null;
              }
              setIsRecording(false);
              setMicrophoneReleased(true);
              console.log("🔒 Mikrofon serbest bırakıldı");
            } catch (_) {}

            handleSpeechEnd();
          },
          onVADMisfire: () => {
            console.log("⚠️ VAD misfire");
            setIsSpeechActive(false);
          },
          positiveSpeechThreshold,
          negativeSpeechThreshold,
          redemptionFrames,
          frameSamples,
          preSpeechPadFrames,
          minSpeechFrames,
        });

        setVadInitialized(true);
        setMicPermissionGranted(true);
        console.log("✅ VAD başarıyla başlatıldı");
        return true;
      } catch (error) {
        console.error("❌ VAD başlatma hatası:", error);
        setVadInitialized(false);
        updateError("VAD_INIT", error.message || String(error));
        throw error;
      }
    },
    [
      ensureDependenciesReady,
      positiveSpeechThreshold,
      negativeSpeechThreshold,
      redemptionFrames,
      frameSamples,
      preSpeechPadFrames,
      minSpeechFrames,
      updateError,
    ]
  );

  const sendVoiceToAPI = useCallback(async (wavBlob) => {
    try {
      const formData = new FormData();
      formData.append("audio", wavBlob, "voice.wav");
      formData.append("device_id", generateDeviceId());

      const response = await fetch("https://www.signolog.com/chat-speechToText/", {
        method: "POST",
        body: formData,
        redirect: "follow",
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`API hatası: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.text) {
        console.log("✅ Ses metne dönüştürüldü:", data.text);
        return data.text;
      } else {
        throw new Error(data.error || "Ses çevrilemedi");
      }
    } catch (error) {
      console.error("❌ Speech-to-Text API hatası:", error);
      throw error;
    }
  }, []);

  const sendMessageToChat = useCallback(async (messageText, chatMessages, functions) => {
    try {
      const newMessages = [...chatMessages, { role: "user", content: messageText }];
      const response = await callOpenAI(newMessages, functions);
      const reply = response.choices[0].message;

      return {
        success: true,
        reply,
        functionCall: reply?.function_call,
      };
    } catch (error) {
      console.error("❌ Chat API hatası:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }, []);

  // ÖNEMLİ DEĞİŞİKLİK: Her seferinde yeni stream al ve VAD'ı yeniden başlat
  const startVoiceRecording = useCallback(
    async (onTranscribed) => {
      try {
        console.log("[VAD] 🎙️ Kayıt başlatılıyor...");

        const supportsAudioWorklet = typeof AudioWorklet !== "undefined";
        const canUseVAD =
          !!window.vad && supportsAudioWorklet && !!(window.ort && window.ort.env && window.ort.env.wasm);

        if (!canUseVAD) {
          console.error("[VAD] ❌ VAD veya AudioWorklet hazır değil");
          setError("Ses sistemi hazır değil (VAD/AudioWorklet)");
          return false;
        }

        onTranscribedRef.current = typeof onTranscribed === "function" ? onTranscribed : null;

        console.log("[VAD] 🎤 Mikrofon stream'i alınıyor...");

        // HER SEFERINDE YENİ STREAM AL
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        console.log("[VAD] ✅ Stream alındı");
        audioStream.current = stream;

        // VAD'ı YENİ STREAM ile başlat
        console.log("[VAD] 🔄 VAD yeniden başlatılıyor...");
        const success = await initializeVAD(stream);

        if (!success) {
          console.error("[VAD] ❌ VAD başlatılamadı");
          stream.getTracks().forEach((t) => t.stop());
          return false;
        }

        // VAD'ı başlat
        console.log("[VAD] ▶️ VAD.start() çağrılıyor...");
        globalVADInstance.current.start();
        isFallbackModeRef.current = false;

        setIsRecording(true);
        setMicrophoneReleased(false);
        setError(null);

        console.log("[VAD] ✅ Kayıt başarıyla başladı");
        return true;
      } catch (err) {
        console.error("[VAD] ❌ Kayıt başlatma hatası:", err);
        setError("Mikrofon erişimi reddedildi: " + err.message);

        // Hata durumunda stream'i temizle
        if (audioStream.current) {
          audioStream.current.getTracks().forEach((t) => t.stop());
          audioStream.current = null;
        }

        return false;
      }
    },
    [initializeVAD]
  );

  const stopVoiceRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      console.log("[VAD] ⏹️ Kayıt durduruluyor...");
      setIsRecording(false);

      if (isFallbackModeRef.current) {
        try {
          if (processorNodeRef.current) processorNodeRef.current.disconnect();
          if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
          if (audioContextRef.current) await audioContextRef.current.close();
        } catch (_) {}

        const chunks = fallbackChunksRef.current || [];
        let totalLen = 0;
        for (const c of chunks) totalLen += c.length;
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        const sampleRate = (audioContextRef.current && audioContextRef.current.sampleRate) || 44100;
        const wavBlob = convertFloat32ToWav(merged, sampleRate);

        try {
          const transcribedText = await sendVoiceToAPI(wavBlob);
          if (onTranscribedRef.current) onTranscribedRef.current(transcribedText);
        } catch (e) {
          console.error("[Fallback] STT hatası:", e);
        }

        audioContextRef.current = null;
        sourceNodeRef.current = null;
        processorNodeRef.current = null;
        fallbackChunksRef.current = [];
        isFallbackModeRef.current = false;
      } else if (globalVADInstance.current) {
        globalVADInstance.current.pause();
        console.log("[VAD] ⏸️ VAD pause edildi");
      }

      if (audioStream.current) {
        audioStream.current.getTracks().forEach((track) => track.stop());
        audioStream.current = null;
        console.log("[VAD] 🔒 Stream kapatıldı");
      }
    } catch (error) {
      console.error("[VAD] ❌ Durdurma hatası:", error);
    }
  }, [isRecording, convertFloat32ToWav, sendVoiceToAPI]);

  const destroyVAD = useCallback(async () => {
    try {
      console.log("[VAD] 🗑️ VAD tamamen temizleniyor...");

      setIsRecording(false);
      setVadInitialized(false);
      setIsSpeechActive(false);

      if (globalVADInstance.current) {
        globalVADInstance.current.destroy();
        globalVADInstance.current = null;
      }

      if (audioStream.current) {
        audioStream.current.getTracks().forEach((track) => track.stop());
        audioStream.current = null;
      }

      try {
        if (processorNodeRef.current) processorNodeRef.current.disconnect();
        if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
        if (audioContextRef.current) await audioContextRef.current.close();
      } catch (_) {}

      audioContextRef.current = null;
      sourceNodeRef.current = null;
      processorNodeRef.current = null;
      fallbackChunksRef.current = [];
      isFallbackModeRef.current = false;
      vadAudioBuffer.current = null;

      console.log("[VAD] ✅ VAD tamamen temizlendi");
    } catch (error) {
      console.error("[VAD] ❌ Destroy hatası:", error);
    }
  }, []);

  const handleSpeechEnd = useCallback(async () => {
    if (!vadAudioBuffer.current) return;

    try {
      setIsProcessing(true);
      console.log("[VAD] 🔄 Ses işleniyor...");

      const wavBlob = convertFloat32ToWav(vadAudioBuffer.current);
      const transcribedText = await sendVoiceToAPI(wavBlob);

      if (onTranscribedRef.current) {
        try {
          onTranscribedRef.current(transcribedText);
        } catch (cbErr) {
          console.error("❌ Transkripsiyon callback hatası:", cbErr);
        }
      }

      return transcribedText;
    } catch (error) {
      console.error("❌ Ses işleme hatası:", error);
      throw error;
    } finally {
      setIsProcessing(false);
      vadAudioBuffer.current = null;
      onTranscribedRef.current = null;

      try {
        if (audioStream.current) {
          audioStream.current.getTracks().forEach((track) => track.stop());
          audioStream.current = null;
        }
        if (globalVADInstance.current) {
          globalVADInstance.current.pause();
        }
        setMicrophoneReleased(true);
        console.log("[VAD] 🔒 Mikrofon stream temizlendi");
      } catch (_) {}
    }
  }, [convertFloat32ToWav, sendVoiceToAPI]);

  return {
    isRecording,
    isProcessing,
    error,
    micPermissionGranted,
    vadInitialized,
    isSpeechActive,
    microphoneReleased,
    checkMicrophonePermission,
    generateDeviceId,
    initializeVAD,
    startVoiceRecording,
    stopVoiceRecording,
    destroyVAD,
    sendMessageToChat,
    handleSpeechEnd,
  };
};

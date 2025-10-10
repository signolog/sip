/**
 * Chat Yönetimi Hook'u
 * ChatGPT entegrasyonu ve mesaj yönetimi için hook
 */

import { useState, useEffect, useCallback } from "react";
import callOpenAI from "../utils/callOpenAI";

/**
 * Chat yönetimi hook'u
 * @param {Object} config - Konfigürasyon objesi
 * @param {Array} config.functions - OpenAI function'ları
 * @param {Function} config.onFunctionCall - Function call handler'ı
 * @param {string} config.initialMessage - İlk sistem mesajı
 * @returns {Object} Chat state'leri ve fonksiyonları
 */
export function useChatManagement({ functions, onFunctionCall, initialMessage }) {
  // Chat state'leri
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);

  // İlk sistem mesajını ayarla
  useEffect(() => {
    if (initialMessage) {
      setChatMessages([{ role: "assistant", content: initialMessage }]);
    }
  }, [initialMessage]);

  // Mesaj gönderme fonksiyonu
  const sendMessage = useCallback(
    async (messageText = null) => {
      const message = messageText || input.trim();
      if (!message) return;

      // Mesajı chat'e ekle
      const newMessages = [...chatMessages, { role: "user", content: message }];
      setChatMessages(newMessages);
      setInput("");

      try {
        // Assistant typing'i başlat
        setIsAssistantTyping(true);

        // OpenAI'ye gönder
        const response = await callOpenAI(newMessages, functions);
        const reply = response.choices[0].message;

        // Yanıtı chat'e ekle
        setChatMessages((prev) => [...prev, reply]);

        // Function call kontrolü
        const functionCall = reply?.function_call;
        if (functionCall && onFunctionCall) {
          console.log(`Fonksiyon çağrısı: ${functionCall.name}`, functionCall.arguments);
          await onFunctionCall(functionCall);
        }
      } catch (error) {
        console.error("Chat API hatası:", error);
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Mesaj gönderilirken hata oluştu. Tekrar dener misiniz?" },
        ]);
      } finally {
        setIsAssistantTyping(false);
      }
    },
    [chatMessages, input, functions, onFunctionCall]
  );

  // Mesaj ekleme fonksiyonu (ses işleme için)
  const addMessage = useCallback((role, content) => {
    setChatMessages((prev) => [...prev, { role, content }]);
  }, []);

  // Chat'i temizleme fonksiyonu
  const clearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Mesajları güncelleme fonksiyonu
  const updateMessages = useCallback((newMessages) => {
    setChatMessages(newMessages);
  }, []);

  return {
    // State'ler
    chatMessages,
    input,
    setInput,
    isAssistantTyping,

    // Fonksiyonlar
    sendMessage,
    addMessage,
    clearChat,
    updateMessages,
    setChatMessages,
  };
}

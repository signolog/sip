// components/ScriptLoader.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export default function ScriptLoader() {
  const loadingRef = useRef(false);

  useEffect(() => {
    // Sadece bir kez çalışsın
    if (loadingRef.current) return;
    loadingRef.current = true;

    const loadScript = (src: string, name: string) => {
      return new Promise<void>((resolve, reject) => {
        // Zaten yüklü mü kontrol et
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          console.log(`✅ ${name} zaten yüklü`);
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Sıralı yüklensin

        script.onload = () => {
          console.log(`✅ ${name} yüklendi`);
          resolve();
        };

        script.onerror = e => {
          console.error(`❌ ${name} yüklenemedi:`, e);
          reject(new Error(`${name} yüklenemedi`));
        };

        document.head.appendChild(script);
      });
    };

    // Scriptleri sırayla yükle
    const loadAllScripts = async () => {
      try {
        await loadScript('/js/ort.js', 'ONNX Runtime');
        await loadScript('/js/bundle.min.js', 'VAD Library');
      } catch (error) {
        console.error('❌ Script yükleme hatası:', error);
      }
    };

    loadAllScripts();
  }, []);

  return null; // Hiçbir şey render etme
}

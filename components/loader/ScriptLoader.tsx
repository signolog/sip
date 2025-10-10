// components/ScriptLoader.tsx
'use client'
import { useEffect, useRef, useState } from 'react'

export default function ScriptLoader() {
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    // Sadece bir kez çalışsın
    if (loadingRef.current) return
    loadingRef.current = true

    const loadScript = (src: string, name: string) => {
      return new Promise<void>((resolve, reject) => {
        // Zaten yüklü mü kontrol et
        const existingScript = document.querySelector(`script[src="${src}"]`)
        if (existingScript) {
          console.log(`✅ ${name} zaten yüklü`)
          resolve()
          return
        }

        const script = document.createElement('script')
        script.src = src
        script.async = false // Sıralı yüklensin
        
        script.onload = () => {
          console.log(`✅ ${name} başarıyla yüklendi`)
          resolve()
        }
        
        script.onerror = (e) => {
          console.error(`❌ ${name} yüklenemedi:`, e)
          reject(new Error(`${name} yüklenemedi`))
        }
        
        document.head.appendChild(script)
      })
    }

    // Scriptleri sırayla yükle
    const loadAllScripts = async () => {
      try {
        await loadScript('/js/ort.js', 'ONNX Runtime')
        await loadScript('/js/bundle.min.js', 'VAD Library')
        await loadScript(
          'https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js',
          'jQuery'
        )
        
        console.log('✅ Tüm scriptler yüklendi!')
        setScriptsLoaded(true)
      } catch (error) {
        console.error('❌ Script yükleme hatası:', error)
      }
    }

    loadAllScripts()
  }, [])

  // Debug için - opsiyonel
  useEffect(() => {
    if (scriptsLoaded) {
      console.log('ORT var mı?', typeof (window as any).ort !== 'undefined')
      console.log('VAD var mı?', typeof (window as any).vad !== 'undefined')
      console.log('jQuery var mı?', typeof (window as any).$ !== 'undefined')
    }
  }, [scriptsLoaded])

  return null // Hiçbir şey render etme
}
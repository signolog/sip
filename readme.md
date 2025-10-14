# Toponus

Toponus, kapalı mekanlarda navigasyon sağlayan akıllı bir web uygulamasıdır. Kullanıcıların AVM, hastane, okul gibi büyük yapılarda kolayca yön bulmasını sağlar.

## Özellikler

### 🗺️ Akıllı Navigasyon

- **Sesli Asistan**: OpenAI entegrasyonu ile doğal dil işleme
- **Çok Katlı Haritalar**: Farklı katlarda gezinme desteği
- **Rota Optimizasyonu**: Dijkstra algoritması ile en kısa yol hesaplama
- **Özel Lokasyonlar**: Tuvalet, ATM, acil çıkış gibi önemli noktalar

### 🎤 Sesli Etkileşim

- **Ses Tanıma**: Mikrofon ile komut verme
- **Gerçek Zamanlı İşleme**: VAD (Voice Activity Detection) teknolojisi

### 🏢 Mekan Yönetimi

- **Admin Paneli**: Mekan ve mağaza yönetimi
- **İçerik Yönetimi**: Logo, görsel ve bilgi güncelleme
- **Kullanıcı Rolleri**: Admin, mekan sahibi, mağaza sahibi

### 🗄️ Veri Yönetimi

- **MongoDB**: NoSQL veritabanı
- **GeoJSON**: Harita verileri için standart format
- **MapLibre GL**: Açık kaynak harita görselleştirme

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Üretim build'i
npm run build
npm start
```

## Environment Değişkenleri

Uygulamanın çalışması için `.env.local` dosyanızda aşağıdaki değişkenlerin tanımlı olması gerekir:

### 🔐 Zorunlu Değişkenler

- **`JWT_SECRET`**: JWT token imzalama için güvenli secret (en az 16 karakter)
- **`MONGODB_URI`**: MongoDB veritabanı bağlantı string'i
- **`OPENAI_API_KEY`**: OpenAI API anahtarı

### 📝 Örnek .env.local

```bash
# JWT Secret - Güvenlik için zorunlu
JWT_SECRET=your_super_secure_jwt_secret_key_here

# MongoDB Connection String
MONGODB_URI=mongodb://localhost:27017/toponus

# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Güvenlik

⚠️ **ÖNEMLİ**:

- `JWT_SECRET` en az 16 karakter uzunluğunda güçlü bir secret olmalıdır
- `OPENAI_API_KEY` geçerli bir OpenAI API anahtarı olmalıdır
- `.env.local` dosyası asla git'e commit edilmemelidir

## Kullanım

1. **Navigasyon**: "Starbucks'a nasıl giderim?" gibi sorular sorun
2. **Özel Lokasyonlar**: "En yakın tuvalet nerede?" diye sorun
3. **Kat Değiştirme**: "Alt kata indim" gibi komutlar verin

Toponus ile kapalı mekanlarda kaybolmak artık geçmişte kalacak! 🚀

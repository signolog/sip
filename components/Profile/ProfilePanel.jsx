'use client';

import { useState, useEffect } from 'react';

export default function ProfilePanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  // Upgrade form state
  const [upgradeData, setUpgradeData] = useState({
    email: '',
    phone: '',
  });

  // Component mount olduğunda token kontrolü yap
  useEffect(() => {
    const token = localStorage.getItem('user_token');
    const userData = localStorage.getItem('user_data');

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setIsLoggedIn(true);
      } catch (error) {
        console.error('User data parse error:', error);
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_data');
      }
    }
  }, []);

  // Kayıt ol
  const handleSignup = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      console.log('Signup response:', data);

      if (data.success) {
        // Token ve kullanıcı bilgilerini kaydet
        localStorage.setItem('user_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));

        setUser(data.user);
        setIsLoggedIn(true);
        setFormData({ username: '', password: '' });
      } else {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error;
        setError(errorMsg || 'Kayıt başarısız');
        console.error('Signup failed:', data);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Giriş yap
  const handleSignin = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Token ve kullanıcı bilgilerini kaydet
        localStorage.setItem('user_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));

        setUser(data.user);
        setIsLoggedIn(true);
        setFormData({ username: '', password: '' });
      } else {
        setError(data.error || 'Giriş başarısız');
      }
    } catch (error) {
      console.error('Signin error:', error);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Çıkış yap
  const handleLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setIsLoggedIn(false);
    setFormData({ username: '', password: '' });
  };

  // Profil yükseltme (advanced_user)
  const handleUpgrade = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('user_token');
      const response = await fetch('/api/auth/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(upgradeData),
      });

      const data = await response.json();

      if (data.success) {
        // Token ve kullanıcı bilgilerini güncelle
        localStorage.setItem('user_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));

        setUser(data.user);
        setSuccess('Profiliniz başarıyla güncellendi!');
        setUpgradeData({ email: '', phone: '' });
      } else {
        setError(data.error || 'Güncelleme başarısız');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Giriş yapmış kullanıcı görünümü
  if (isLoggedIn && user) {
    return (
      <div className="h-full flex flex-col bg-white overflow-y-auto p-4">
        {/* Hoş Geldin */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Hoş geldin, {user.username}!
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {user.role === 'basic_user'
              ? 'Temel Kullanıcı'
              : 'Gelişmiş Kullanıcı'}
          </p>
        </div>

        {/* Başarı/Hata Mesajları */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Basic User - Email ve Telefon Ekleme Formu */}
        {user.role === 'basic_user' && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-4 text-center">
              Gelişmiş özelliklere erişmek için e-posta ve telefon numaranızı
              ekleyin
            </p>
            <form onSubmit={handleUpgrade} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-posta
                </label>
                <input
                  type="email"
                  value={upgradeData.email}
                  onChange={e =>
                    setUpgradeData({ ...upgradeData, email: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={upgradeData.phone}
                  onChange={e =>
                    setUpgradeData({ ...upgradeData, phone: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="05419675256"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm"
              >
                {loading ? 'İşleniyor...' : 'Bilgileri Ekle'}
              </button>
            </form>
          </div>
        )}

        {/* Advanced User - Bilgileri Göster */}
        {user.role === 'advanced_user' && (
          <div className="space-y-3 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">E-posta</p>
              <p className="text-sm text-gray-900">{user.email || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Telefon</p>
              <p className="text-sm text-gray-900">{user.phone || '-'}</p>
            </div>
          </div>
        )}

        {/* Çıkış Butonu */}
        <button
          onClick={handleLogout}
          className="w-full py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
        >
          Çıkış Yap
        </button>
      </div>
    );
  }

  // Giriş/Kayıt formu
  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="p-4">
        {/* Logo ve Açıklama */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <img
              src="/images/toponus-logo.jpeg"
              alt="Toponus Logo"
              className="h-10"
              onError={e => {
                e.target.style.display = 'none';
              }}
            />
            <p className="text-sm text-gray-600">
              AVM içinde konum bulmanıza yardımcı oluyoruz
            </p>
          </div>
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={showSignup ? handleSignup : handleSignin}
          className="space-y-3"
        >
          {/* Kullanıcı Adı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={e =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Şifre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Şifre
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={e =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              minLength={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {showSignup && (
              <p className="text-xs text-gray-500 mt-1">
                En az 4 karakter olmalıdır
              </p>
            )}
          </div>

          {/* Submit Butonu */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? 'İşleniyor...' : showSignup ? 'Üye Ol' : 'Giriş Yap'}
          </button>
        </form>

        {/* Üye Değil Misiniz? Linki */}
        {!showSignup && (
          <div className="text-center mt-4">
            <p className="text-xs text-gray-600">
              Henüz üye değil misiniz?{' '}
              <button
                onClick={() => {
                  setShowSignup(true);
                  setError('');
                  setFormData({ username: '', password: '' });
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Üye Ol
              </button>
            </p>
          </div>
        )}

        {/* Zaten Üye Misiniz? Linki */}
        {showSignup && (
          <div className="text-center mt-4">
            <p className="text-xs text-gray-600">
              Zaten üye misiniz?{' '}
              <button
                onClick={() => {
                  setShowSignup(false);
                  setError('');
                  setFormData({ username: '', password: '' });
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Giriş Yap
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

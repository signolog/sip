/**
 * Admin Dashboard Komponenti
 * Admin paneli ana dashboard'u
 */

export default function AdminDashboard() {
  const stats = [
    { label: "Toplam Kullanıcı", value: "1,234", icon: "👥", color: "bg-blue-500" },
    { label: "Aktif Navigasyon", value: "89", icon: "🗺️", color: "bg-green-500" },
    { label: "Toplam Lokasyon", value: "156", icon: "📍", color: "bg-purple-500" },
    { label: "Bugünkü Ziyaret", value: "45", icon: "📊", color: "bg-orange-500" },
  ];

  const recentActivities = [
    { user: "Ahmet Yılmaz", action: "Starbucks'a navigasyon", time: "2 dakika önce" },
    { user: "Fatma Demir", action: "Tuvalet arama", time: "5 dakika önce" },
    { user: "Mehmet Kaya", action: "H&M mağazası' navigasyon", time: "8 dakika önce" },
    { user: "Ayşe Özkan", action: "ATM araması ", time: "12 dakika önce" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <span className="text-white text-xl">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Son Aktiviteler</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"></div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">{activity.action}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Hızlı İşlemler</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-medium text-gray-900"></h4>
              <p className="text-sm text-gray-600"></p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

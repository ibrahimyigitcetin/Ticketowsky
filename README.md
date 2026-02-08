# 🚀 TICKETOWSKY - Industrial Ticket Engine

**Modern-Endüstriyel Ticket Yönetim Sistemi**  
ServiceNow ve JIRA benzeri profesyonel destek ve görev takibi için tasarlanmış, tamamen istemci tabanlı bir uygulamadır.

## ✨ Özellikler

| Özellik                        | Açıklama                                                                                   |
|-------------------------------|--------------------------------------------------------------------------------------------|
| Dual Theme                    | Karanlık (Industrial Dark) ve Açık (High-Tech Lab) tema seçenekleri. Molten orange vurgu renkleri ile tutarlı görünüm. |
| Kanban & Liste Görünümü       | Sürükle-bırak Kanban panosu ve detaylı tablo görünümü.                                     |
| SLA Takibi                    | Öncelik seviyesine göre otomatik SLA hesaplaması, kalan süre geri sayımı ve aşıldığında görsel uyarı. |
| Digital Twin Sandbox          | Gerçek sisteme dokunmadan çözüm simülasyonu. Etki analizi (Chaos Prevention) ve alternatif çözüm önerileri. |
| Shadow IT Radar               | Sistemde şüpheli aktivitelerin tespiti ve raporlanması.                                    |
| Predictive Hardware Health    | Donanım bileşenlerinin sağlık durumu tahmini ve kritik parçalar için otomatik yedek parça rezervasyonu. |
| Ghostwriter (Tercüman)        | Teknik terimleri kullanıcı dostu dile çevirme özelliği.                                    |
| Güvenlik Katmanı              | XSS önleme, CSRF benzeri token doğrulaması ve Security Audit Log (Fortress Mode).          |
| Spotlight & Glassmorphism     | Fare hareketine duyarlı spotlight efekti ve modern glassmorphism tasarım öğeleri.         |

## ⚙️ Kurulum ve Çalıştırma

Proje tamamen istemci tabanlıdır. Sunucu veya veritabanı gerektirmez; veriler LocalStorage'da saklanır.

1. Repoyu klonlayın veya ZIP olarak indirin:
   ```bash
   git clone https://github.com/username/ticketowsky.git
   ```

2. Klasöre girin ve `index.html` dosyasını tarayıcıda açın:
   ```bash
   cd ticketowsky
   # Tarayıcıda index.html dosyasını açın
   ```

3. Uygulama ilk açılışta örnek verilerle (50+ ticket) birlikte gelir.

> Filtre bölümündeki "Hard Reset" butonu ile tüm verileri sıfırlayabilirsiniz.

## 🔧 Kullanılan Teknolojiler

- HTML5 ve CSS3 (Özel değişkenler, glassmorphism ve spotlight efektleri)
- Vanilla JavaScript
- Chart.js (Durum ve öncelik dağılımı grafikleri)
- Google Fonts: Black Ops One, Teko, JetBrains Mono
- LocalStorage (Veri kalıcılığı)

## 🎨 Tasarım Yaklaşımı

- Endüstriyel tema: Çelik grileri, molten orange vurgular, karanlık arka plan ve grid desenleri
- Akıcı animasyonlar: Kart giriş efektleri, hover glow ve uyarı pulse'ları
- Kullanıcı odaklı deneyim: Hızlı erişim, minimum etkileşim adımı

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

Detaylar için [CONTRIBUTING.md](CONTRIBUTING.md) ve [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) dosyasını inceleyiniz.

## 📄 Lisans

Bu proje MIT lisansı altında dağıtılmaktadır. Detaylar için [LICENSE](LICENSE) dosyasını inceleyiniz.
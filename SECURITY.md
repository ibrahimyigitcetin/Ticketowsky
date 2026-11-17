# Güvenlik Politikası (Security Policy)

## 🛡️ Proje Doğası ve Kapsam (Scope)

**Ticketowsky**, ServiceNow ve JIRA'dan ilham alan, tamamen tarayıcıda çalışan (Vanilla JS), sunucu veya veritabanı bağımlılığı olmayan bir ticket yönetim sistemidir. Tüm veriler istemcinin `localStorage` alanında saklanır.

Araştırmacıların zamanını verimli kullanabilmesi adına, zafiyet bildirimlerinin kapsamını aşağıdaki gibi belirlemiş bulunuyoruz:

### ✅ Kapsam Dahilinde Olan Zafiyetler
Aşağıdaki alanlarda bulacağınız zafiyetleri bildirmenizi memnuniyetle karşılıyoruz:
* **XSS (Cross-Site Scripting):** `escapeHtml()` ve `sanitize*()` fonksiyonlarının atlatılması (bypass), DOM tabanlı XSS açıkları veya `innerHTML` / `textContent` kullanımındaki mantık hataları.
* **Prototype Pollution (Prototip Kirliliği):** `app.js` üzerindeki durum yönetimi (state management) ve nesne birleştirme işlemlerindeki zafiyetler.
* **Veri Sızıntısı ve Maskeleme:** `SecurityGuardian` modülündeki PII (Kişisel Tanımlayıcı Bilgiler), API anahtarı ve şifre maskeleme regex mantıklarının atlatılması.
* **localStorage Manipülasyonu:** Zararlı veri enjeksiyonu aracılığıyla uygulama açılışında tetiklenen kalıcı (stored) açıklar.
* **Bağımlılık Zafiyetleri:** Kullanılan 3. parti kütüphanelerdeki (örn. Chart.js) bilinen kritik (CVE) güvenlik açıkları.

### ❌ Kapsam Dışı Olanlar (Lütfen Raporlamayın)
* **Simüle Edilmiş Güvenlik Mekanizmaları:** `README.md` dosyasında da belirtildiği üzere; CSRF Token doğrulaması, IDOR koruması ve Mass Assignment kontrolleri **eğitim/demo amaçlı simülasyonlardır**. Gerçek bir backend olmadığı için bu mekanizmalardaki mantıksal atlatmalar zafiyet olarak kabul edilmeyecektir.
* **Backend Zafiyetleri:** Proje bir sunucu barındırmadığı için SQL Injection, RCE, Backend yetkilendirme hataları gibi zafiyetler geçerli değildir.
* **Fiziksel Erişim:** Kullanıcının kendi cihazında `localStorage`'ı manuel olarak değiştirmesi.

---

## 📅 Desteklenen Sürümler (Supported Versions)

Güvenlik güncellemeleri yalnızca projenin güncel geliştirme dalına yansıtılmaktadır.

| Sürüm / Branch | Destekleniyor mu? |
| :--- | :---: |
| `main` | ✅ Evet |
| Eski Commits / Tags | ❌ Hayır |

---

## 📢 Zafiyet Bildirimi (Reporting a Vulnerability)

Eğer yukarıdaki kapsam dahilinde bir güvenlik zafiyeti bulduğunuzu düşünüyorsanız, lütfen **asla herkese açık bir GitHub Issue (Sorun) oluşturmayın.** Bunun yerine aşağıdaki adımları izleyin:

1. **GitHub Security Advisories (Güvenlik Tavsiyeleri):**
   Bu reponun sağ üst köşesindeki **Security** sekmesine gidip **"Report a vulnerability"** butonunu kullanarak gizli bir rapor oluşturun. Bu, iletişimimizin şifreli ve GitHub'ın güvenli ortamında kalmasını sağlar.

2. **Alternatif İletişim (E-posta):**
   Security Advisories kullanamıyorsanız, bulgularınızı detaylı bir şekilde **[ibrahimyigitctn@gmail.com]** adresine gönderebilirsiniz.

### Raporunuzda Bulunması Gerekenler:
* **Özet:** Zafiyetin ne olduğu ve potansiyel etkisi.
* **Etkilenen Kod:** Dosya adı ve ilgili satır aralığı (Örn: `app.js:1402 - renderDetailPanel()`).
* **PoC (Proof of Concept):** Zafiyeti kanıtlayan adım adım yeniden üretme adımları, kullanıldığınız payload'lar veya tarayıcı konsolunda çalıştırılabilir JavaScript snippet'leri.
* **Ortam:** Testlerinizi gerçekleştirdiğiniz Tarayıcı ve İşletim Sistemi sürümleri.

---

## ⏱️ Yanıt ve Çözüm Süresi (Response Time)

* **İlk Yanıt:** Raporunuz iletildikten sonra en geç **48 saat** içinde tarafımızdan bir "alındı" ve "değerlendiriliyor" onayı alacaksınız.
* **Triage (Sınıflandırma):** Zafiyetin geçerliliği ve ciddiyeti en geç **7 gün** içinde değerlendirilerek size geri bildirim verilecektir.
* **Yama (Patch):** Geçerli bulunan zafiyetler için en kısa sürede bir yama hazırlanacak ve `main` branch'e yansıtılacaktır.

---

## 🤝 Sorumlu İfşa ve Teşekkür (Responsible Disclosure)

Güvenlik araştırmacılarının emeğine ve etiğine saygı duyuyoruz.
* Bildirdiğiniz zafiyet geçerli kabul edilip düzeltildiğinde, isteğiniz doğrultusunda isminizi/profilinizi projemizin **Teşekkürler (Acknowledgments)** bölümünde belirtmekten mutluluk duyarız.
* Zafiyetin kötüye kullanılmasını önlemek adına, yama yayınlanana kadar bulgularınızı üçüncü şahıslarla veya sosyal medyada paylaşmamanızı rica ederiz.

Ticketowsky'nin güvenliğini sağlamlaştırmamıza yardımcı olduğunuz için şimdiden teşekkür ederiz! 🛡️

/* Oturum sona erdiğinde arayüzü uyarma köprüsü.
 *
 * Sorun şuydu: checkAuth() localStorage'daki kullanıcıya güvenip sunucuya
 * hiç sormuyordu. Sunucudaki oturum düşünce uygulama "giriş yapılmış" gibi
 * açılıyor, kenar çubuğunda ad soyad görünüyor, ama her API çağrısı 401
 * dönüyordu. Sayfalar hatayı yutup boş liste gösterdiği için ekranda
 * "0 müşteri" yazıyordu — sanki veri silinmiş gibi. Tek çözüm çıkıp
 * yeniden girmekti ama bunu kimse tahmin edemez.
 *
 * Bu modül React ağacının dışındaki axios kesicisiyle içerideki uyarı
 * penceresi arasında durur.
 */

// Oturum düşünce aynı anda uçan 10-15 istek 401 döner; uyarı bir kez
// gösterilmeli.
let bildirildi = false;
let dinleyici = null;

/** Uyarı penceresi kendini kaydeder. */
export function onSessionExpired(fn) {
  dinleyici = fn;
  return () => {
    if (dinleyici === fn) dinleyici = null;
  };
}

/** Kesici çağırır. Tekrarlananlar yutulur. */
export function notifySessionExpired() {
  if (bildirildi) return;
  bildirildi = true;
  dinleyici?.();
}

/** Girişten sonra bayrağı sıfırla, yoksa ikinci kez uyarı çıkmaz. */
export function resetSessionExpired() {
  bildirildi = false;
}

/* Kendi 401'ini kendi yöneten uçlar.
 *
 * /auth/login burada olmazsa yanlış şifre girmek "oturumunuz sona erdi"
 * uyarısı çıkarır — kullanıcı için tamamen yanıltıcı olurdu.
 * /auth/me ise zaten oturumu YOKLAMAK için çağrılıyor; 401 beklenen yanıt. */
const MUAF = ["/api/auth/login", "/api/auth/register", "/api/auth/me",
              "/api/auth/logout", "/api/auth/session"];

export function oturumHatasiMi(status, url) {
  if (status !== 401) return false;
  const yol = String(url || "");
  return !MUAF.some((m) => yol.includes(m));
}

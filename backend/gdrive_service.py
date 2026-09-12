"""Google Drive'a yedek yükleme.

Neden google-api-python-client değil de düz REST:
Gereken üç çağrı var (belirteç tazele, dosya yükle, dosya sil) ve httpx zaten
bağımlılık listesinde. Google'ın istemci kütüphanesi yanında ~10 paket daha
getiriyor; Render'ın ücretsiz katmanında derleme süresi ve bellek bedava değil.

KİMLİK DOĞRULAMA — yenileme anahtarı (refresh token) yöntemi:
Servis hesabı kullanılamıyor, çünkü servis hesaplarının kendi Drive alanı yok;
kişisel bir Gmail hesabının "Drive'ım" klasörüne yükleme yapamıyorlar (Ortak
Drive gerekir, o da Workspace'e özel). Bu yüzden hesabın kendi yetkisiyle
tek seferlik alınan bir yenileme anahtarı kullanılıyor.

Kapsam bilerek "drive.file" — uygulama YALNIZCA kendi oluşturduğu dosyaları
görebiliyor ve silebiliyor. Drive'ın geri kalanına erişimi yok; bir hata ya da
kötü niyetli bir istek başka dosyalara dokunamaz. Ayrıca bu kapsam Google'ın
"hassas" listesinde olmadığı için uygulamayı yayına almak doğrulama süreci
gerektirmiyor.

Ortam değişkenleri (Render → Environment):
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_REFRESH_TOKEN
  GDRIVE_FOLDER_NAME  (isteğe bağlı, varsayılan "CRMaster Yedekleri")

DİKKAT: OAuth istemcisi Google Cloud Console'da "Testing" durumundaysa
yenileme anahtarı 7 GÜN sonra sessizce geçersiz oluyor ve yedekleme durur.
Uygulamayı "Production"a almak şart. Bu, bu tür kurulumların en sık sessiz
kalma sebebi.
"""
import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import httpx

logger = logging.getLogger("gdrive_service")

TOKEN_URL = "https://oauth2.googleapis.com/token"
FILES_URL = "https://www.googleapis.com/drive/v3/files"
UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
FOLDER_MIME = "application/vnd.google-apps.folder"

_TIMEOUT = httpx.Timeout(120.0, connect=30.0)


def _cfg(ad: str, varsayilan: str = "") -> str:
    return (os.environ.get(ad) or varsayilan).strip()


def is_configured() -> bool:
    """Üç anahtar da yerinde mi. Eksikse yükleme hiç denenmiyor."""
    return all(_cfg(a) for a in
               ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"))


def folder_name() -> str:
    return _cfg("GDRIVE_FOLDER_NAME", "CRMaster Yedekleri")


class GDriveError(RuntimeError):
    pass


def _access_token() -> str:
    """Yenileme anahtarını kısa ömürlü erişim belirtecine çevirir.

    Önbelleğe alınmıyor: yedekleme günde bir çalışıyor, belirteç bir saat
    yaşıyor. Süreçler arası önbellek tutmak kazanç sağlamadan hata kaynağı
    olurdu.
    """
    veri = {
        "client_id": _cfg("GOOGLE_CLIENT_ID"),
        "client_secret": _cfg("GOOGLE_CLIENT_SECRET"),
        "refresh_token": _cfg("GOOGLE_REFRESH_TOKEN"),
        "grant_type": "refresh_token",
    }
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.post(TOKEN_URL, data=veri)
    if r.status_code != 200:
        # invalid_grant = anahtar iptal edilmiş ya da süresi dolmuş. En sık
        # sebebi OAuth istemcisinin "Testing" durumunda bırakılması.
        detay = r.text[:300]
        if "invalid_grant" in detay:
            raise GDriveError(
                "Google yenileme anahtarı geçersiz. Genellikle OAuth istemcisi "
                "Google Cloud Console'da 'Testing' durumunda bırakıldığında olur "
                "(anahtar 7 günde ölür) — 'Production'a alıp anahtarı yenile."
            )
        raise GDriveError(f"Google belirteç alınamadı (HTTP {r.status_code}): {detay}")
    return r.json()["access_token"]


def _baslik(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ensure_folder(token: str) -> str:
    """Yedek klasörünü bulur, yoksa oluşturur; kimliğini döndürür.

    drive.file kapsamında arama zaten yalnızca uygulamanın kendi oluşturduğu
    dosyaları görüyor, dolayısıyla bu sorgu kullanıcının başka klasörlerini
    okumuyor.
    """
    ad = folder_name().replace("'", "\\'")
    sorgu = (f"name = '{ad}' and mimeType = '{FOLDER_MIME}' and trashed = false")
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.get(FILES_URL, headers=_baslik(token),
                  params={"q": sorgu, "fields": "files(id,name)", "pageSize": 1})
        if r.status_code == 200 and r.json().get("files"):
            return r.json()["files"][0]["id"]
        r = c.post(FILES_URL, headers=_baslik(token),
                   json={"name": folder_name(), "mimeType": FOLDER_MIME})
    if r.status_code not in (200, 201):
        raise GDriveError(f"Drive klasörü oluşturulamadı (HTTP {r.status_code}): {r.text[:200]}")
    return r.json()["id"]


def upload(dosya_adi: str, icerik: bytes, mime: str,
           klasor_id: Optional[str] = None) -> Dict[str, Any]:
    """Tek dosyayı Drive'a yükler. Klasör kimliği verilmezse bulunur/oluşturulur."""
    if not is_configured():
        raise GDriveError("Google Drive ayarlanmamış (ortam değişkenleri eksik)")
    token = _access_token()
    klasor_id = klasor_id or _ensure_folder(token)

    ustveri = {"name": dosya_adi, "parents": [klasor_id]}
    # multipart/related: tek istekte hem üstveri hem içerik. Yedek dosyaları
    # birkaç MB; devam ettirilebilir (resumable) yükleme gerektirecek boyutta
    # değil ve tek istek daha az hata yüzeyi demek.
    sinir = "crmasterbackupboundary"
    govde = (
        f"--{sinir}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(ustveri, ensure_ascii=False)}\r\n"
        f"--{sinir}\r\nContent-Type: {mime}\r\n\r\n"
    ).encode("utf-8") + icerik + f"\r\n--{sinir}--\r\n".encode("utf-8")

    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.post(
            UPLOAD_URL,
            headers={**_baslik(token),
                     "Content-Type": f"multipart/related; boundary={sinir}"},
            params={"uploadType": "multipart", "fields": "id,name,size,webViewLink"},
            content=govde,
        )
    if r.status_code not in (200, 201):
        raise GDriveError(f"Drive yüklemesi başarısız (HTTP {r.status_code}): {r.text[:300]}")
    sonuc = r.json()
    logger.info("Drive'a yüklendi: %s (%s)", sonuc.get("name"), sonuc.get("id"))
    return {"id": sonuc.get("id"), "name": sonuc.get("name"),
            "link": sonuc.get("webViewLink"), "folder_id": klasor_id}


def prune(retention_days: int, klasor_id: Optional[str] = None) -> int:
    """Saklama süresini aşan yedekleri Drive'dan siler. Silinen sayısını döndürür.

    drive.file kapsamı sayesinde yalnızca bu uygulamanın yüklediği dosyalara
    erişim var; kullanıcının elle koyduğu bir dosya yanlışlıkla silinemez.
    """
    if retention_days <= 0 or not is_configured():
        return 0
    token = _access_token()
    klasor_id = klasor_id or _ensure_folder(token)
    sinir = (datetime.now(timezone.utc) - timedelta(days=retention_days))
    silinen = 0
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.get(FILES_URL, headers=_baslik(token), params={
            "q": f"'{klasor_id}' in parents and trashed = false",
            "fields": "files(id,name,createdTime)",
            "pageSize": 1000,
        })
        if r.status_code != 200:
            logger.warning("Drive listelenemedi: %s", r.text[:200])
            return 0
        for f in r.json().get("files", []):
            try:
                olusturma = datetime.fromisoformat(
                    f["createdTime"].replace("Z", "+00:00"))
            except Exception:
                continue
            if olusturma >= sinir:
                continue
            d = c.delete(f"{FILES_URL}/{f['id']}", headers=_baslik(token))
            if d.status_code in (200, 204):
                silinen += 1
            else:
                logger.warning("Drive silme başarısız (%s): %s", f["name"], d.text[:150])
    return silinen


def check() -> Dict[str, Any]:
    """Arayüzdeki 'Bağlantıyı sına' için: ayar tam mı, anahtar geçerli mi."""
    if not is_configured():
        eksik = [a for a in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
                             "GOOGLE_REFRESH_TOKEN") if not _cfg(a)]
        return {"ok": False, "configured": False,
                "error": "Eksik ortam değişkeni: " + ", ".join(eksik)}
    try:
        klasor_id = _ensure_folder(_access_token())
        return {"ok": True, "configured": True,
                "folder_name": folder_name(), "folder_id": klasor_id}
    except GDriveError as e:
        return {"ok": False, "configured": True, "error": str(e)}
    except Exception as e:
        return {"ok": False, "configured": True, "error": f"Beklenmeyen hata: {e}"}

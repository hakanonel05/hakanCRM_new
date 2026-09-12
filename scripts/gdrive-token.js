#!/usr/bin/env node
/**
 * Google Drive yedeklemesi için TEK SEFERLİK yenileme anahtarı (refresh token)
 * alır. Sunucuda değil, kendi bilgisayarında çalışır.
 *
 * Kullanım:
 *   node scripts/gdrive-token.js <CLIENT_ID> <CLIENT_SECRET>
 *
 * Betik yerelde küçük bir sunucu açıp tarayıcıda Google'ın izin ekranını
 * gösterir; onay verince anahtarı ekrana yazar. Anahtarı Render'da
 * GOOGLE_REFRESH_TOKEN ortam değişkenine koy.
 *
 * ÖNEMLİ: Anahtar bir paroladır. Ekrana yazılır, hiçbir yere gönderilmez ve
 * bu dosya onu diske kaydetmez. Terminal geçmişini paylaşma.
 *
 * Kapsam bilerek "drive.file": uygulama yalnızca KENDİ oluşturduğu dosyaları
 * görür ve siler, Drive'ının geri kalanına erişemez.
 */
const http = require("http");
const crypto = require("crypto");
const { exec } = require("child_process");

const [, , CLIENT_ID, CLIENT_SECRET] = process.argv;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Kullanım: node scripts/gdrive-token.js <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const PORT = 53682; // OAuth istemcisinde yönlendirme adresi olarak tanımlanacak
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
// state: yerel sunucuya gelen isteğin gerçekten bizim başlattığımız akıştan
// geldiğini doğrular (CSRF).
const STATE = crypto.randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // ikisi birlikte olmazsa Google yenileme anahtarını YALNIZCA ilk onayda
    // döndürür; ikinci çalıştırmada elin boş kalır.
    access_type: "offline",
    prompt: "consent",
    state: STATE,
  });

const sayfa = (baslik, mesaj) =>
  `<!doctype html><meta charset="utf-8"><title>${baslik}</title>` +
  `<body style="font-family:system-ui;padding:40px;max-width:520px">` +
  `<h2>${baslik}</h2><p>${mesaj}</p></body>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== "/") return res.writeHead(404).end();

  const hata = url.searchParams.get("error");
  if (hata) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(sayfa("İzin verilmedi", `Google şunu döndürdü: ${hata}`));
    console.error("\n✗ İzin verilmedi:", hata);
    server.close();
    process.exit(1);
  }

  if (url.searchParams.get("state") !== STATE) {
    res.writeHead(400).end("state uyuşmadı");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) return res.writeHead(400).end("kod yok");

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const veri = await r.json();
    if (!veri.refresh_token) {
      throw new Error(
        "Yanıtta refresh_token yok. Genellikle bu hesaba daha önce izin " +
        "verilmiş demektir. https://myaccount.google.com/permissions " +
        "adresinden uygulamanın erişimini kaldırıp tekrar dene.\n" +
        JSON.stringify(veri, null, 2)
      );
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(sayfa("Tamam", "Anahtar alındı. Terminale dönebilirsin."));

    console.log("\n" + "=".repeat(64));
    console.log("GOOGLE_REFRESH_TOKEN=" + veri.refresh_token);
    console.log("=".repeat(64));
    console.log("\nBunu Render → crmmaster-api → Environment altına ekle.");
    console.log("Yanına GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET de gerekiyor.");
    console.log("\nUNUTMA: OAuth istemcisi Google Cloud Console'da 'Testing'");
    console.log("durumundaysa bu anahtar 7 GÜN sonra ölür. 'Production'a al.\n");
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" })
      .end(sayfa("Hata", String(e.message || e)));
    console.error("\n✗", e.message || e);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("\nOAuth istemcinde yönlendirme adresi (redirect URI) olarak");
  console.log("şunun tanımlı olduğundan emin ol:  " + REDIRECT + "\n");
  console.log("Tarayıcı açılıyor. Açılmazsa şu adrese git:\n" + authUrl + "\n");
  const komut = process.platform === "win32" ? "start \"\""
    : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${komut} "${authUrl}"`, () => {});
});

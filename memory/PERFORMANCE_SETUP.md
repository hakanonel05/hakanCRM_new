# Backend Always-On Setup (Render Free Tier)

Render free tier 15 dakika trafik almazsa container'ı uyutur. İlk açılışta 30-60 saniye
"cold start" yaşanır. Bunu önlemek için yeni eklenen `/api/health` endpoint'ini
ücretsiz bir cron servisi üzerinden 10 dakikada bir ping atın.

## Health endpoint

```
GET https://<YOUR-RENDER-URL>/api/health
```

Örnek cevap (sub-100ms):
```json
{ "status": "ok", "service": "crmaster-backend", "ts": 1779525156 }
```

## UptimeRobot (önerilen, ücretsiz)

1. https://uptimerobot.com → Free Sign Up
2. **+ Add New Monitor**
3. Ayarlar:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `CRMaster Backend`
   - URL: `https://<YOUR-RENDER-URL>/api/health`
   - Monitoring Interval: **5 minutes** (free tier max)
4. **Create Monitor**

Tek monitor 5 dakikada bir ping atar → container hiç uyumaz → ilk açılış <2sn.

## Alternatifler

- **cron-job.org** (ücretsiz, 1 dk'ya kadar): https://cron-job.org → "Create cronjob"
- **GitHub Actions** (ücretsiz, repository içinde): `.github/workflows/keepalive.yml`
  ```yaml
  on:
    schedule:
      - cron: '*/10 * * * *'
  jobs:
    ping:
      runs-on: ubuntu-latest
      steps:
        - run: curl -fsS https://<YOUR-RENDER-URL>/api/health
  ```

## Notlar

- UptimeRobot free hesap aynı zamanda **e-posta uyarısı** verir; uygulama düşerse
  haberin olur (bonus özellik).
- Render production paid plan ($7/ay) zaten always-on'dur; o durumda bu kuruluma
  gerek yoktur.

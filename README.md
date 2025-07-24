# Doctolib Webhook Scraper

Această aplicație Node.js primește webhook-uri și execută scripturi de scraping pe Doctolib folosind Playwright.

## Structura Proiectului

- `webhook_server.js` - Serverul Express care primește webhook-uri
- `scrapeDoctolib.js` - Scriptul de scraping Playwright
- `Dockerfile` - Configurarea containerului Docker
- `.github/workflows/deploy.yml` - Deploy automat cu GitHub Actions

## Instalare și Rulare

### Local
```bash
npm install
npm start
```

### Docker
```bash
docker build -t doctolib-app .
docker run -p 8080:3000 doctolib-app
```

## Configurare GitHub Actions

Pentru deploy automat, configurează următoarele secrete în repozitoriul GitHub:

- `VPS_HOST` - Adresa IP a serverului VPS
- `VPS_USERNAME` - Username-ul pentru SSH (de obicei 'root')
- `VPS_SSH_KEY` - Cheia privată SSH pentru conectare

## Utilizare

Trimite un POST request la `/run-scrape` pentru a declanșa scriptul de scraping:

```bash
curl -X POST http://localhost:8080/run-scrape
```

Pentru verificarea stării aplicației:

```bash
curl http://localhost:8080/health
```
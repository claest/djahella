# Spotify Dashboard Setup Guide

## Steg-för-steg guide för att konfigurera Spotify-appen

### 1. Gå till Spotify Developer Dashboard
- Öppna [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Logga in med ditt Spotify-konto

### 2. Skapa en ny app (eller redigera befintlig)
- Klicka "Create App" (eller öppna din befintliga app)
- Fyll i app-information:
  - **App name**: Spotify Playlist Creator
  - **App description**: En webbapp för att skapa spellistor
  - **Website**: `http://127.0.0.1:3000`
  - **Redirect URIs**: `http://127.0.0.1:3000`
  - **API/SDKs**: Web API

### 3. Konfigurera Redirect URIs
- I din app, klicka "Edit Settings"
- Under "Redirect URIs", lägg till:
  ```
  http://127.0.0.1:3000
  ```
- **VIKTIGT**: Klicka "Save" för att spara ändringarna

### 4. Kopiera credentials
- Kopiera **Client ID** och **Client Secret**
- Skapa `.env.local` fil i projektroten med:
  ```env
  SPOTIFY_CLIENT_ID=din_client_id_här
  SPOTIFY_CLIENT_SECRET=din_client_secret_här
  NEXT_PUBLIC_SPOTIFY_CLIENT_ID=din_client_id_här
  ```

### 5. Testa konfigurationen
- Starta utvecklingsservern: `npm run dev`
- Öppna `http://127.0.0.1:3000`
- Klicka "Logga in med Spotify"
- Du borde nu kunna logga in utan fel

## Felsökning

### "INVALID_CLIENT: Invalid redirect URI"
- Kontrollera att `http://127.0.0.1:3000` är exakt som det står i Spotify Dashboard
- Se till att du har sparat ändringarna
- Vänta 1-2 minuter för att ändringarna ska träda i kraft

### "Spotify Dashboard kräver HTTPS"
- För utveckling på 127.0.0.1 fungerar HTTP
- HTTPS krävs endast för produktion
- Om du får detta fel, kontrollera att du använder `http://127.0.0.1:3000` (inte https)

### Antivirus blockerar ngrok
- Om du vill använda HTTPS för utveckling, kan du:
  1. Temporärt inaktivera antivirus
  2. Använda en annan tunnel-tjänst
  3. Använda HTTP på localhost (rekommenderat för utveckling)

## Produktion

För produktion behöver du:
1. En HTTPS-domain
2. Uppdatera `config/spotify.ts` med din produktions-URL
3. Lägga till produktions-URL:en i Spotify Dashboard

## Alternativ för HTTPS-utveckling

Om du verkligen behöver HTTPS för utveckling:

### Alternativ 1: Använd localhost.run
```bash
# Installera localhost.run
npm install -g localhost-run

# Starta tunnel
localhost-run --port 3000
```

### Alternativ 2: Använd serveo.net
```bash
# Använd SSH-tunnel
ssh -R 80:localhost:3000 serveo.net
```

### Alternativ 3: Använd Cloudflare Tunnel
```bash
# Installera cloudflared
# Skapa tunnel via Cloudflare Dashboard
```

## Tips

- **Använd HTTP för 127.0.0.1-utveckling** - Det är enklast och fungerar bra
- **Spara alltid ändringar** i Spotify Dashboard
- **Vänta på att ändringar träder i kraft** - kan ta 1-2 minuter
- **Kontrollera webbläsarens konsol** för debug-information
- **Använd samma Client ID** för både backend och frontend 
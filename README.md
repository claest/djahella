# Spotify Playlist Creator

En webbapplikation för att skapa och spela Spotify-spellistor med fullständig uppspelning via Spotify Web Playback SDK.

## Funktioner

- 🔍 **Realtidssökning** - Sök låtar direkt medan du skriver
- 🎵 **Fullständig uppspelning** - Spela hela låtar via Spotify Web Playback SDK
- 📝 **Spellista-hantering** - Skapa och hantera dina egna spellistor
- 🎮 **Spelarkontroller** - Play/pause, next/previous, shuffle, repeat
- ⏱️ **Starttid** - Ange anpassad starttid för varje låt
- 📱 **Responsiv design** - Fungerar på alla enheter

## Installation

1. **Klona projektet**
   ```bash
   git clone <repository-url>
   cd spotify-playlist-creator
   ```

2. **Installera beroenden**
   ```bash
   npm install
   ```

3. **Konfigurera Spotify-appen**
   
   ### Steg 1: Skapa Spotify-app
   - Gå till [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Klicka "Create App"
   - Fyll i app-information:
     - **App name**: Spotify Playlist Creator
     - **App description**: En webbapp för att skapa spellistor
     - **Website**: `http://localhost:3000`
     - **Redirect URIs**: `http://localhost:3000/callback`
     - **API/SDKs**: Web API

   ### Steg 2: Konfigurera Redirect URIs
   - I din Spotify-app, gå till "Edit Settings"
   - Under "Redirect URIs", lägg till:
     ```
     http://localhost:3000/callback
     ```
   - **VIKTIGT**: Spara ändringarna

   ### Steg 3: Kopiera credentials
   - Kopiera **Client ID** och **Client Secret**
   - Skapa `.env.local` fil i projektroten:

4. **Konfigurera miljövariabler**
   
   Skapa en `.env.local` fil i projektroten:
   ```env
   # Spotify API Credentials
   SPOTIFY_CLIENT_ID=din_spotify_client_id_här
   SPOTIFY_CLIENT_SECRET=din_spotify_client_secret_här
   
   # Frontend Spotify Client ID (samma som ovan)
   NEXT_PUBLIC_SPOTIFY_CLIENT_ID=din_spotify_client_id_här
   ```

5. **Starta utvecklingsservern**
   ```bash
   npm run dev
   ```

6. **Öppna appen**
   - Gå till `http://localhost:3000`
   - Klicka "Logga in med Spotify"
   - Godkänn behörigheter

## Krav

- **Spotify Premium** - Krävs för Web Playback SDK
- **Node.js 18+** - För utveckling
- **Modern webbläsare** - Chrome, Firefox, Safari, Edge

## Användning

### Sökning
- Skriv i sökrutan för att söka låtar i realtid
- Resultaten uppdateras automatiskt medan du skriver

### Spellista
- Klicka "Lägg till" för att lägga till låtar i din spellista
- Ange valfri starttid i format MM:SS
- Klicka på låtar i spellistan för att spela dem direkt

### Uppspelning
- **Play/Pause** - Spela eller pausa aktuell låt
- **Next/Previous** - Hoppa mellan låtar
- **Shuffle** - Blanda spellistan
- **Repeat** - Upprepa: Av/En låt/Alla låtar
- **Volym** - Justera volym
- **Progressbar** - Se uppspelningsframsteg och hoppa i låten

## Teknisk information

### Arkitektur
- **Next.js 14** - React-framework med App Router
- **TypeScript** - Typade JavaScript
- **Tailwind CSS** - Utility-first CSS
- **Spotify Web API** - För sökning och metadata
- **Spotify Web Playback SDK** - För fullständig uppspelning

### Komponenter
- `SearchBar` - Realtidssökning med debouncing
- `TrackList` - Visar sökresultat med förhandsvisning
- `PlaylistManager` - Spellista-hantering med fullständig spelare
- `SpotifyAuth` - OAuth-autentisering
- `useSpotifyPlayer` - Custom hook för Web Playback SDK

### API:er
- `/api/search` - Söker låtar via Spotify Web API
- OAuth-flöde för användarautentisering
- Web Playback SDK för uppspelning

## Felsökning

### "INVALID_CLIENT: Invalid redirect URI"
- Kontrollera att `http://localhost:3000/callback` är lagt till i Spotify-appen
- Se till att du har sparat ändringarna i Spotify Dashboard

### "Du behöver Spotify Premium"
- Web Playback SDK kräver Spotify Premium
- Uppgradera ditt konto för fullständig funktionalitet

### Uppspelning fungerar inte
- Kontrollera att du är inloggad på Spotify
- Se till att Spotify-appen är öppen på en annan enhet
- Kontrollera webbläsarens autoplay-inställningar

## Utveckling

### Struktur
```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── callback/          # OAuth callback
│   └── page.tsx           # Huvudsida
├── components/            # React-komponenter
├── hooks/                 # Custom hooks
├── types/                 # TypeScript-typer
└── env.example           # Miljövariabler exempel
```

### Skript
- `npm run dev` - Starta utvecklingsserver
- `npm run build` - Bygg för produktion
- `npm run start` - Starta produktionsserver
- `npm run lint` - Kör ESLint

## Licens

MIT License - se LICENSE-fil för detaljer.

## Bidrag

1. Fork projektet
2. Skapa en feature branch
3. Commit dina ändringar
4. Push till branchen
5. Öppna en Pull Request

## Support

För support eller frågor, öppna en issue på GitHub. 
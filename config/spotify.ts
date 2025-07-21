export const spotifyConfig = {
  // Redirect URI för olika miljöer
  redirectUri: process.env.NODE_ENV === 'production' 
    ? 'https://djahella.vercel.app/'  // Uppdaterad till korrekt produktions-URL
    : 'http://127.0.0.1:3000',  // Använd IP-adress istället för localhost
  
  // Scopes som behövs för appen
  scopes: [
    'user-read-private',
    'user-read-email',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private'
  ]
} 
import { NextRequest, NextResponse } from 'next/server'
import SpotifyWebApi from 'spotify-web-api-node'

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
})

async function getAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant()
    spotifyApi.setAccessToken(data.body.access_token)
    return data.body.access_token
  } catch (error) {
    console.error('Fel vid hämtning av access token:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Sökfråga krävs' }, { status: 400 })
  }

  try {
    await getAccessToken()
    
    const response = await spotifyApi.searchTracks(query, {
      limit: 20,
      offset: 0,
    })

    const tracks = response.body.tracks?.items.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(artist => ({
        id: artist.id,
        name: artist.name,
      })),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images,
      },
      duration_ms: track.duration_ms,
      external_urls: track.external_urls,
      preview_url: track.preview_url, // URL för 30-sekunders förhandsvisning
      uri: track.uri, // Spotify URI för fullständig uppspelning
    })) || []

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error('Sökfel:', error)
    return NextResponse.json(
      { error: 'Kunde inte söka låtar' },
      { status: 500 }
    )
  }
} 
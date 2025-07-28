import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token krävs' },
        { status: 400 }
      )
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Missing credentials for token refresh')
      return NextResponse.json(
        { error: 'Spotify credentials saknas' },
        { status: 500 }
      )
    }

    console.log('Refreshing token...')

    // Förnya access token med refresh token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    const responseText = await tokenResponse.text()
    console.log('Spotify refresh response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      console.error('Spotify refresh error:', responseText)
      
      try {
        const errorData = JSON.parse(responseText)
        return NextResponse.json(errorData, { status: 400 })
      } catch {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Kunde inte förnya access token' },
          { status: 400 }
        )
      }
    }

    const tokenData = JSON.parse(responseText)
    console.log('Token refresh successful')

    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken, // Spotify returnerar bara ny refresh_token ibland
      expires_in: tokenData.expires_in
    })

  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Internt serverfel vid token-förnyelse' },
      { status: 500 }
    )
  }
} 
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = await request.json()

    if (!code || !redirectUri) {
      return NextResponse.json(
        { error: 'Kod och redirect URI krävs' },
        { status: 400 }
      )
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Missing credentials:', { 
        hasClientId: !!clientId, 
        hasClientSecret: !!clientSecret 
      })
      return NextResponse.json(
        { error: 'Spotify credentials saknas. Kontrollera .env.local filen.' },
        { status: 500 }
      )
    }

    console.log('Token exchange request:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri,
      codeLength: code.length
    })

    // Byta authorization code mot access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    const responseText = await tokenResponse.text()
    console.log('Spotify API response status:', tokenResponse.status)
    console.log('Spotify API response:', responseText)

    if (!tokenResponse.ok) {
      console.error('Spotify token error:', responseText)
      
      // Returnera Spotify's felmeddelande direkt
      try {
        const errorData = JSON.parse(responseText)
        
        // Ge mer specifik feedback för vanliga fel
        if (errorData.error === 'invalid_grant') {
          if (errorData.error_description?.includes('expired')) {
            return NextResponse.json({
              error: 'authorization_code_expired',
              error_description: 'Inloggningskoden har gått ut. Försök logga in igen.'
            }, { status: 400 })
          } else if (errorData.error_description?.includes('Invalid authorization code')) {
            return NextResponse.json({
              error: 'invalid_authorization_code',
              error_description: 'Ogiltig inloggningskod. Försök logga in igen.'
            }, { status: 400 })
          }
        }
        
        return NextResponse.json(errorData, { status: 400 })
      } catch {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Kunde inte hämta access token från Spotify' },
          { status: 400 }
        )
      }
    }

    const tokenData = JSON.parse(responseText)
    console.log('Token exchange successful')

    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in
    })

  } catch (error) {
    console.error('Token exchange error:', error)
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Internt serverfel' },
      { status: 500 }
    )
  }
} 
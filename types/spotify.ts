export interface Track {
  id: string
  name: string
  artists: Artist[]
  album: Album
  duration_ms: number
  external_urls: {
    spotify: string
  }
  preview_url?: string // URL för 30-sekunders förhandsvisning
  uri?: string // Spotify URI för fullständig uppspelning
  startTime?: number // Anpassad starttid i millisekunder
}

export interface Artist {
  id: string
  name: string
}

export interface Album {
  id: string
  name: string
  images: Image[]
}

export interface Image {
  url: string
  height: number
  width: number
}

export interface Playlist {
  id: string
  name: string
  tracks: Track[]
  description?: string
}

export interface SearchResponse {
  tracks: Track[]
}

// Spotify Web Playback SDK typer
export interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  getCurrentState(): Promise<SpotifyPlaybackState | null>
  setName(name: string): Promise<void>
  getVolume(): Promise<number>
  setVolume(volume: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  previousTrack(): Promise<void>
  nextTrack(): Promise<void>
  seek(position_ms: number): Promise<void>
  activateElement(): Promise<void>
  addListener(event: string, callback: (data: any) => void): void
  removeListener(event: string): void
}

export interface SpotifyPlaybackState {
  context: {
    uri: string
    metadata: any
  }
  disallows: {
    pausing: boolean
    peeking_next: boolean
    peeking_prev: boolean
    resuming: boolean
    seeking: boolean
    skipping_next: boolean
    skipping_prev: boolean
  }
  duration: number
  paused: boolean
  position: number
  repeat_mode: number
  shuffle: boolean
  track_window: {
    current_track: SpotifyTrack
    previous_tracks: SpotifyTrack[]
    next_tracks: SpotifyTrack[]
  }
}

export interface SpotifyTrack {
  id: string
  uri: string
  type: string
  media_type: string
  name: string
  is_playable: boolean
  album: {
    uri: string
    name: string
    images: Image[]
  }
  artists: {
    uri: string
    name: string
  }[]
  duration_ms: number
}

export interface SpotifyError {
  message: string
  status: number
}

// Typ för Spotify Device (enhet)
export interface SpotifyDevice {
  id: string
  is_active: boolean
  is_restricted: boolean
  name: string
  type: string // t.ex. 'Computer', 'Smartphone', 'Speaker'
  volume_percent: number
} 
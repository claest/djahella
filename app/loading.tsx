export default function Loading() {
  return (
    <div className="min-h-screen bg-spotify-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-spotify-green mx-auto mb-4"></div>
        <h2 className="text-xl font-bold text-white mb-2">
          Laddar Spotify Playlist Creator
        </h2>
        <p className="text-gray-400">
          Vänta medan applikationen startar...
        </p>
      </div>
    </div>
  )
} 
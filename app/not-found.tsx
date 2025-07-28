import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-spotify-black flex items-center justify-center p-4">
      <div className="bg-spotify-dark rounded-lg p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Sida hittades inte
        </h2>
        <p className="text-gray-300 mb-6">
          Sidan du letar efter finns inte. Den kan ha flyttats eller tagits bort.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-spotify-green text-white rounded hover:bg-green-600 transition-colors"
        >
          Gå tillbaka till startsidan
        </Link>
      </div>
    </div>
  )
} 
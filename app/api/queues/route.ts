import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'queues-data.json')

// Hjälpfunktion för att läsa filen
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

// Hjälpfunktion för att skriva filen
async function writeData(data: any) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// GET: Hämta köer, startpunkter och useStartTimes för en användare
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId krävs' }, { status: 400 })
  }
  const data = await readData()
  return NextResponse.json(data[userId] || { queues: [], startPoints: {}, useStartTimes: {} })
}

// POST: Spara köer, startpunkter och useStartTimes för en användare
export async function POST(request: NextRequest) {
  const { userId, queues, startPoints, useStartTimes } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId krävs' }, { status: 400 })
  }
  const data = await readData()
  data[userId] = { queues: queues || [], startPoints: startPoints || {}, useStartTimes: useStartTimes || {} }
  await writeData(data)
  return NextResponse.json({ ok: true })
} 
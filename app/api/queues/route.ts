import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { promises as fs } from 'fs'
import path from 'path'

// Skapa en connection pool för bättre prestanda
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: 3306,
  connectTimeout: 60000,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Skapa tabellen om den inte finns
async function ensureTableExists() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id VARCHAR(255) PRIMARY KEY,
        queues JSON,
        start_points JSON,
        use_start_times JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  } catch (error) {
    console.error('Fel vid skapande av tabell:', error)
  }
}

// Migrera data från fil till databas
async function migrateFromFile(userId: string) {
  try {
    const dataFile = path.join(process.cwd(), 'queues-data.json')
    const fileExists = await fs.access(dataFile).then(() => true).catch(() => false)
    
    if (!fileExists) return false
    
    const fileData = await fs.readFile(dataFile, 'utf-8')
    const data = JSON.parse(fileData)
    
    if (data[userId]) {
      console.log('Migrerar data för användare:', userId)
      const userData = data[userId]
      
      await pool.execute(
        `INSERT INTO user_data (user_id, queues, start_points, use_start_times) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
           queues = VALUES(queues), 
           start_points = VALUES(start_points), 
           use_start_times = VALUES(use_start_times)`,
        [
          userId, 
          JSON.stringify(userData.queues || []),
          JSON.stringify(userData.startPoints || {}),
          JSON.stringify(userData.useStartTimes || {})
        ]
      )
      
      console.log('Migrering slutförd för användare:', userId)
      return true
    }
    
    return false
  } catch (error) {
    console.error('Fel vid migrering från fil:', error)
    return false
  }
}

// GET: Hämta köer, startpunkter och useStartTimes för en användare
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId krävs' }, { status: 400 })
    }

    await ensureTableExists()

    const [rows] = await pool.execute(
      'SELECT queues, start_points, use_start_times FROM user_data WHERE user_id = ?',
      [userId]
    )

    // Om ingen data finns i databasen, försök migrera från fil
    if (Array.isArray(rows) && rows.length === 0) {
      const migrated = await migrateFromFile(userId)
      if (migrated) {
        // Hämta data igen efter migrering
        const [newRows] = await pool.execute(
          'SELECT queues, start_points, use_start_times FROM user_data WHERE user_id = ?',
          [userId]
        ) as [any[], any]
        if (Array.isArray(newRows) && newRows.length > 0) {
          rows.push(...newRows)
        }
      }
    }

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0] as any
      console.log('Raw row from database:', row)
      
      // Hantera olika format från MySQL
      let queues = []
      let startPoints = {}
      let useStartTimes = {}
      
      try {
        if (row.queues) {
          queues = typeof row.queues === 'string' ? JSON.parse(row.queues) : row.queues
        }
        if (row.start_points) {
          startPoints = typeof row.start_points === 'string' ? JSON.parse(row.start_points) : row.start_points
        }
        if (row.use_start_times) {
          useStartTimes = typeof row.use_start_times === 'string' ? JSON.parse(row.use_start_times) : row.use_start_times
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        console.log('Problematic data:', { queues: row.queues, startPoints: row.start_points, useStartTimes: row.use_start_times })
      }
      
      return NextResponse.json({ queues, startPoints, useStartTimes })
    } else {
      return NextResponse.json({ queues: [], startPoints: {}, useStartTimes: {} })
    }
  } catch (error) {
    console.error('Fel vid GET /api/queues:', error)
    return NextResponse.json({ error: 'Databasfel' }, { status: 500 })
  }
}

// POST: Spara köer, startpunkter och useStartTimes för en användare
export async function POST(request: NextRequest) {
  try {
    const { userId, queues, startPoints, useStartTimes } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId krävs' }, { status: 400 })
    }

    await ensureTableExists()

    const queuesJson = JSON.stringify(queues || [])
    const startPointsJson = JSON.stringify(startPoints || {})
    const useStartTimesJson = JSON.stringify(useStartTimes || {})

    await pool.execute(
      `INSERT INTO user_data (user_id, queues, start_points, use_start_times) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         queues = VALUES(queues), 
         start_points = VALUES(start_points), 
         use_start_times = VALUES(use_start_times)`,
      [userId, queuesJson, startPointsJson, useStartTimesJson]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Fel vid POST /api/queues:', error)
    return NextResponse.json({ error: 'Databasfel' }, { status: 500 })
  }
} 
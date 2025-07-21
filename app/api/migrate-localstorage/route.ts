import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

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

export async function POST(request: NextRequest) {
  try {
    const { userId, queues, startPoints, useStartTimes } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'userId krävs' }, { status: 400 })
    }

    await ensureTableExists()

    // Om queues är en array av tracks (inte SavedQueue-objekt), konvertera till rätt format
    let formattedQueues = queues
    if (Array.isArray(queues) && queues.length > 0 && !queues[0].id?.startsWith('queue_')) {
      // Detta är en array av tracks, konvertera till SavedQueue-format
      formattedQueues = [{
        id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId,
        name: 'Milonga lördag 26 juli',
        tracks: queues,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
      console.log('Konverterade tracks till SavedQueue-format:', formattedQueues)
    }

    const queuesJson = JSON.stringify(formattedQueues || [])
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

    console.log('Manuell migrering slutförd för användare:', userId)
    console.log('Migrerade köer:', formattedQueues.length)
    return NextResponse.json({ 
      success: true, 
      message: 'Migrering slutförd',
      queuesCount: formattedQueues.length
    })
    
  } catch (error) {
    console.error('Fel vid manuell migrering:', error)
    return NextResponse.json({ error: 'Migreringsfel' }, { status: 500 })
  }
} 
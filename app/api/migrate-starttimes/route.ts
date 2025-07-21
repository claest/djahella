import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, startPoints, useStartTimes } = body

    if (!userId || !startPoints || !useStartTimes) {
      return NextResponse.json(
        { error: 'userId, startPoints och useStartTimes krävs' },
        { status: 400 }
      )
    }

    console.log(`Migrerar starttider för användare: ${userId}`)
    console.log('Starttider:', Object.keys(startPoints).length, 'st')
    console.log('UseStartTimes:', Object.keys(useStartTimes).length, 'st')

    const connection = await pool.getConnection()

    try {
      // Kontrollera om användaren redan finns
      const [existingRows] = await connection.execute(
        'SELECT * FROM user_data WHERE user_id = ?',
        [userId]
      ) as [any[], any]

      if (existingRows.length > 0) {
        // Uppdatera befintlig användare
        await connection.execute(
          `UPDATE user_data 
           SET start_points = ?, use_start_times = ?, updated_at = NOW()
           WHERE user_id = ?`,
          [JSON.stringify(startPoints), JSON.stringify(useStartTimes), userId]
        )
        console.log('Uppdaterade befintlig användare')
      } else {
        // Skapa ny användare
        await connection.execute(
          `INSERT INTO user_data (user_id, queues, start_points, use_start_times, created_at, updated_at)
           VALUES (?, '[]', ?, ?, NOW(), NOW())`,
          [userId, JSON.stringify(startPoints), JSON.stringify(useStartTimes)]
        )
        console.log('Skapade ny användare')
      }

      return NextResponse.json({
        success: true,
        message: 'Starttider migrerade framgångsrikt',
        startPointsCount: Object.keys(startPoints).length,
        useStartTimesCount: Object.keys(useStartTimes).length
      })

    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('Fel vid migrering av starttider:', error)
    return NextResponse.json(
      { error: 'Fel vid migrering av starttider' },
      { status: 500 }
    )
  }
} 
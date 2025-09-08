import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Starting mobile activities migration...')

    // Check if user_id column already exists
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'mobile_activities' AND column_name = 'user_id'
    `)

    if (columnCheck.rows.length === 0) {
      // Add user_id column
      await query(`
        ALTER TABLE mobile_activities 
        ADD COLUMN user_id INTEGER REFERENCES users(id)
      `)
      console.log('Added user_id column to mobile_activities table')
    }

    // Check if there's any data to migrate
    const dataCheck = await query(`
      SELECT COUNT(*) as count FROM mobile_activities WHERE mobile_user_id IS NOT NULL
    `)

    if (parseInt(dataCheck.rows[0].count) > 0) {
      // For existing data, we'll map mobile_user_id to the admin user (id=1)
      // since we're switching to use the main users table
      await query(`
        UPDATE mobile_activities 
        SET user_id = 1 
        WHERE mobile_user_id IS NOT NULL AND user_id IS NULL
      `)
      console.log('Migrated existing mobile activities to admin user')
    }

    // Update the table to make user_id NOT NULL for new records
    await query(`
      ALTER TABLE mobile_activities 
      ALTER COLUMN user_id SET NOT NULL
    `)

    res.status(200).json({ 
      message: 'Mobile activities migration completed successfully',
      migrated: true
    })
  } catch (error) {
    console.error('Migration error:', error)
    
    // If user_id column doesn't exist, create it
    if (error.message.includes('column "user_id" of relation "mobile_activities" does not exist')) {
      try {
        await query(`
          ALTER TABLE mobile_activities 
          ADD COLUMN user_id INTEGER REFERENCES users(id)
        `)
        
        await query(`
          UPDATE mobile_activities 
          SET user_id = 1 
          WHERE user_id IS NULL
        `)
        
        res.status(200).json({ 
          message: 'Mobile activities migration completed successfully',
          migrated: true
        })
      } catch (retryError) {
        console.error('Retry migration error:', retryError)
        res.status(500).json({ 
          message: 'Migration failed', 
          error: retryError.message 
        })
      }
    } else {
      res.status(500).json({ 
        message: 'Migration failed', 
        error: error.message 
      })
    }
  }
}

require('dotenv').config()

const dbService = require('../services/db.service')
const bcrypt = require('bcrypt')

async function run() {
  try {
    const collection = await dbService.getCollection('user')
    const hashedPassword = await bcrypt.hash('1234', 10)

    const user = {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      // any other fields your code expects
    }

    await collection.insertOne(user)

    console.log('User seeded:', user)
  } catch (err) {
    console.error('Error seeding user:', err)
  } finally {
    process.exit(0)
  }
}

run()

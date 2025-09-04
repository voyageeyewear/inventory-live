import { MongoClient } from 'mongodb'

// Use MongoDB Atlas for production, local for development
const uri = process.env.MONGODB_URI || 'mongodb+srv://inventory:inventory123@cluster0.mongodb.net/inventory_system?retryWrites=true&w=majority'

const options = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}

let client
let clientPromise

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

export async function connectToDatabase() {
  try {
    console.log('Attempting to connect to MongoDB...')
    const client = await clientPromise
    const db = client.db('inventory_system')
    console.log('MongoDB connected successfully')
    return { client, db }
  } catch (error) {
    console.error('MongoDB connection error:', error)
    console.error('Connection URI:', uri.replace(/\/\/.*@/, '//***:***@'))
    throw new Error(`Database connection failed: ${error.message}`)
  }
}
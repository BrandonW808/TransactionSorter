// MongoDB initialization script
// This script creates the database and collections with proper indexes

db = db.getSiblingDB('transaction_categorizer');

// Create users collection with indexes
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ name: 'text' });

// Create categoryLists collection with indexes
db.createCollection('categorylists');
db.categorylists.createIndex({ name: 1 }, { unique: true });
db.categorylists.createIndex({ isDefault: 1 });

// Insert sample data (optional)
db.users.insertOne({
  name: 'Sample User',
  email: 'sample@example.com',
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Database initialized successfully');

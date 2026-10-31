require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

const port = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure it.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  app.listen(port, () => console.log(`Perfume Store API listening on port ${port}`));
}

start().catch((error) => {
  console.error('Unable to start the API:', error.message);
  process.exit(1);
});
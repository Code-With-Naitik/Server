// Force Google DNS to bypass ISP DNS blocks on MongoDB SRV records
require('dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dns').setDefaultResultOrder('ipv4first');

const mongoose = require('mongoose');
require('dotenv').config();

const URI = process.env.MONGO_URI;
console.log('Testing URI:', URI?.replace(/:([^@]+)@/, ':****@'));
console.log('DNS Servers set to: 8.8.8.8, 8.8.4.4, 1.1.1.1\n');

mongoose.connect(URI, {
  family: 4,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
})
.then(conn => {
  console.log('✅ MongoDB CONNECTED:', conn.connection.host);
  console.log('Database:', conn.connection.name);
  process.exit(0);
})
.catch(err => {
  console.log('❌ STILL FAILED:', err.message);
  process.exit(1);
});

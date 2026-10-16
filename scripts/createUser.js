// Usage: npm run create-user -- <username> <password> "<Full Name>" [role]
// Example: npm run create-user -- frontdesk1 "StrongPass#123" "Ali Raza" frontdesk
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const [username, password, fullName, role = 'frontdesk'] = process.argv.slice(2);

  if (!username || !password || !fullName) {
    console.log('Usage: npm run create-user -- <username> <password> "<Full Name>" [frontdesk|doctor|admin]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.log('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!['frontdesk', 'doctor', 'admin'].includes(role)) {
    console.log('Role must be frontdesk, doctor or admin.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hms');
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ username, passwordHash, fullName, role });
  console.log(`User "${username}" created with role "${role}".`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.code === 11000 ? 'That username already exists.' : err.message);
  process.exit(1);
});

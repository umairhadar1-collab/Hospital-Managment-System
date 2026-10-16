// Usage:
//   npm run set-role                       -> shows all users and their roles
//   npm run set-role -- <username> admin   -> changes the role of a user
// Roles: frontdesk, doctor, admin
// After changing a role, that user must log out and log in again.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ROLES = ['frontdesk', 'doctor', 'admin'];

async function main() {
  const [usernameArg, role] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hms');

  const users = await User.find().sort({ username: 1 }).select('username fullName role').lean();

  if (!usernameArg) {
    console.log('Users in the database:');
    if (!users.length) console.log('  (none yet - create one with: npm run create-user)');
    users.forEach(u => console.log(`  ${u.username.padEnd(20)} ${u.role.padEnd(10)} ${u.fullName}`));
    console.log('\nTo change a role: npm run set-role -- <username> admin');
    return;
  }

  if (!ROLES.includes(role)) {
    console.log('Role must be one of: ' + ROLES.join(', '));
    process.exitCode = 1;
    return;
  }

  const user = await User.findOneAndUpdate(
    { username: usernameArg.trim().toLowerCase() },
    { role },
    { new: true }
  );

  if (!user) {
    console.log(`No user named "${usernameArg}". Existing users: ${users.map(u => u.username).join(', ') || '(none)'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Done. "${user.username}" is now "${user.role}".`);
  console.log('Log out and log in again on the website so the new role is used.');
}

main()
  .catch(err => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());

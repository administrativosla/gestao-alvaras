import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('Step 1: Altering role enum to include all values temporarily...');
  // Expand enum to include both old and new values so UPDATE can work
  await conn.execute(`ALTER TABLE users MODIFY COLUMN role enum('user','admin','operator','gestor','master') NOT NULL DEFAULT 'operator'`);
  console.log('  Done.');

  console.log('Step 2: Updating existing admin → master...');
  await conn.execute(`UPDATE users SET role = 'master' WHERE role = 'admin'`);
  console.log('  Done.');

  console.log('Step 3: Updating existing user → operator...');
  await conn.execute(`UPDATE users SET role = 'operator' WHERE role = 'user'`);
  console.log('  Done.');

  console.log("Step 4: Narrowing role enum to ('operator','gestor','master')...");
  await conn.execute(`ALTER TABLE users MODIFY COLUMN role enum('operator','gestor','master') NOT NULL DEFAULT 'operator'`);
  console.log('  Done.');

  console.log("Step 4: Adding userStatus column if not exists...");
  // Check if column already exists
  const [cols] = await conn.execute(`SHOW COLUMNS FROM users LIKE 'userStatus'`);
  if (cols.length === 0) {
    await conn.execute(`ALTER TABLE users ADD COLUMN userStatus enum('pending','active','blocked') DEFAULT 'pending' NOT NULL`);
    console.log('  Column added.');
  } else {
    console.log('  Column already exists, skipping.');
  }

  console.log("Step 5: Setting existing users to active (they were already using the system)...");
  await conn.execute(`UPDATE users SET userStatus = 'active' WHERE userStatus = 'pending'`);
  console.log('  Done.');

  console.log('\n✅ Migration complete!');
  const [rows] = await conn.execute('SELECT id, name, email, role, userStatus FROM users');
  console.table(rows);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await conn.end();
}

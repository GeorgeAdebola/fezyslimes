/**
 * FezySlimes — Firestore Admin Document Creator (standalone)
 * Uses the Firebase client SDK directly with the real credentials.
 * 
 * Run: node scripts/init-admin-firestore.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB8Uarm1Wfr9gfCGhohvSBNpT3zBpzAyYQ',
  authDomain: 'slime-business.firebaseapp.com',
  projectId: 'slime-business',
  storageBucket: 'slime-business.firebasestorage.app',
  messagingSenderId: '1056410131791',
  appId: '1:1056410131791:web:dbee93e059d2900d10b93a',
};

const ADMIN_UID   = 'dvtOCLNvBndjSZzPkvG8kkfI6Zn2';  // Created by create-admin.cjs
const ADMIN_EMAIL = 'admin@fezyslimes.com';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

try {
  await setDoc(doc(db, 'users', ADMIN_UID), {
    role: 'admin',
    fullName: 'Fezy Slimes Admin',
    email: ADMIN_EMAIL,
    otpVerified: true,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  console.log('✅ Firestore admin document created successfully!');
  console.log(`   Collection : users`);
  console.log(`   Document   : ${ADMIN_UID}`);
  console.log(`   Role       : admin`);
} catch (err) {
  console.error('❌ Error writing Firestore document:', err.message);
  console.log('\nAlternative: Add the document manually in the Firebase Console:');
  console.log('  Collection : users');
  console.log(`  Document ID: ${ADMIN_UID}`);
  console.log('  Fields:');
  console.log('    role       : "admin"');
  console.log('    fullName   : "Fezy Slimes Admin"');
  console.log(`    email      : "${ADMIN_EMAIL}"`);
  console.log('    otpVerified: true');
}

process.exit(0);

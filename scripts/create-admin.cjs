/**
 * FezySlimes — One-Time Admin Account Setup Script
 * 
 * Run ONCE from the project root:
 *   node scripts/create-admin.cjs
 *
 * This creates the Firebase Auth account and the Firestore user document
 * for the default FezySlimes admin.
 *
 * DELETE this file after running it.
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

// ─── Firebase config (matches src/firebase.js) ────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyB8Uarm1Wfr9gfCGhohvSBNpT3zBpzAyYQ',
  authDomain: 'slime-business.firebaseapp.com',
  projectId: 'slime-business',
  storageBucket: 'slime-business.firebasestorage.app',
  messagingSenderId: '1056410131791',
  appId: '1:1056410131791:web:dbee93e059d2900d10b93a',
};

// ─── Admin credentials ─────────────────────────────────────────────────────────
const ADMIN_EMAIL    = 'admin@fezyslimes.com';
const ADMIN_PASSWORD = 'Admin@12345';

async function main() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  console.log('🔐 FezySlimes Admin Account Setup\n');

  let uid;

  // 1. Try to create the Firebase Auth account
  try {
    const credential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = credential.user.uid;
    console.log(`✅ Firebase Auth account created.`);
    console.log(`   UID : ${uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('⚠️  Firebase Auth account already exists. Signing in to get UID...');
      const credential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      uid = credential.user.uid;
      console.log(`   UID : ${uid}`);
    } else {
      console.error('❌ Failed to create Firebase Auth account:', err.message);
      process.exit(1);
    }
  }

  // 2. Create / overwrite the Firestore user document
  const userRef  = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  if (existing.exists() && existing.data().role === 'admin') {
    console.log('✅ Firestore admin document already exists. No changes made.');
  } else {
    await setDoc(userRef, {
      role: 'admin',
      fullName: 'Fezy Slimes Admin',
      email: ADMIN_EMAIL,
      otpVerified: true,    // skip OTP gate for admin account
      createdAt: new Date().toISOString(),
    }, { merge: true });
    console.log('✅ Firestore user document created with role: "admin".');
  }

  console.log('\n════════════════════════════════════════');
  console.log('  Admin Account Ready');
  console.log('════════════════════════════════════════');
  console.log(`  Login URL : http://localhost:5174/login`);
  console.log(`  Email     : ${ADMIN_EMAIL}`);
  console.log(`  Password  : ${ADMIN_PASSWORD}`);
  console.log(`  Dashboard : http://localhost:5174/admin`);
  console.log('════════════════════════════════════════');
  console.log('\n⚠️  Delete scripts/create-admin.cjs after use.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

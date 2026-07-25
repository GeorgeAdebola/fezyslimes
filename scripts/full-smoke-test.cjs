const axios = require('axios');
const { initializeApp: initializeAdminApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp: initializeClientApp } = require('firebase/app');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

// 1. Initialize Firebase Admin (for reading OTP docs in test)
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (e) {
  console.error('[FATAL] FIREBASE_SERVICE_ACCOUNT_JSON invalid:', e.message);
  process.exit(1);
}
initializeAdminApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// 2. Initialize Firebase Client (for signInWithCustomToken)
const firebaseConfig = {
  apiKey: "AIzaSyB8Uarm1Wfr9gfCGhohvSBNpT3zBpzAyYQ",
  authDomain: "slime-business.firebaseapp.com",
  projectId: "slime-business",
  storageBucket: "slime-business.appspot.com",
  messagingSenderId: "1056410131791",
  appId: "1:1056410131791:web:dbee93e059d2900d10b93a"
};
const clientApp = initializeClientApp(firebaseConfig);
const clientAuth = getAuth(clientApp);

const TEST_EMAIL = 'autotest_' + Date.now() + '@example.com';
const API_BASE = 'http://localhost:5000';

// Admin credentials come from the same env vars the server uses
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('[FATAL] ADMIN_USERNAME or ADMIN_PASSWORD not set in environment.');
  process.exit(1);
}

async function runTests() {
  const results = [];
  try {
    // --- OTP SMOKE TEST ---
    console.log('[STEP 1] Triggering OTP request...');
    const sendRes = await axios.post(`${API_BASE}/api/otp/send-login`, { email: TEST_EMAIL });
    if (sendRes.data.success) {
      results.push('1. Trigger OTP request: PASS');
    } else throw new Error('API did not return success');

    console.log('[STEP 2] Fetching OTP from database...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for db write
    const otpDoc = await db.collection('otps').doc(`${TEST_EMAIL.toLowerCase()}_login`).get();
    if (!otpDoc.exists) throw new Error('OTP document not found in Firestore');
    const otpCode = otpDoc.data().code;
    if (!otpCode) throw new Error('OTP code missing in document');
    results.push(`2. Confirm OTP generated and retrievable (Code: ${otpCode}): PASS`);

    console.log('[STEP 3] Submitting OTP verification...');
    const verifyRes = await axios.post(`${API_BASE}/api/otp/verify-login`, { email: TEST_EMAIL, code: otpCode });
    if (verifyRes.data.success) {
      results.push('3. Submit OTP code: PASS');
    } else throw new Error('Verification API failed');

    console.log('[STEP 4] Checking for Custom Token...');
    const customToken = verifyRes.data.customToken;
    if (!customToken) throw new Error('No custom token returned in response');
    results.push('4. Response includes Custom Token: PASS');

    console.log('[STEP 5] Signing in with Custom Token...');
    const userCredential = await signInWithCustomToken(clientAuth, customToken);
    if (userCredential.user && userCredential.user.uid) {
      results.push(`5. Custom Token sign-in (UID: ${userCredential.user.uid}): PASS`);
    } else throw new Error('Sign in succeeded but user object missing');

    // --- ADMIN TESTS ---
    console.log('[STEP 6] Testing Admin Login...');
    const adminRes = await axios.post(`${API_BASE}/api/admin/login`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });
    const adminToken = adminRes.data.token;
    if (adminToken) {
      results.push('6. Admin login: PASS');
    } else throw new Error('Admin login failed — no token returned');

    console.log('[STEP 7] Creating Product in Admin...');
    const prodName = `Smoke Test Slime ${Date.now()}`;
    const createRes = await axios.post(`${API_BASE}/api/admin/products`, {
      name: prodName,
      price: 15000,
      category: 'clear',
      stock: 10
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (createRes.data.success) {
      results.push('7. Product creation via Admin API: PASS');
    } else throw new Error('Failed to create product');

    console.log('[STEP 8] Confirming Product Appears on Storefront...');
    const productsRes = await axios.get(`${API_BASE}/api/products`);
    const found = productsRes.data.find(p => p.name === prodName);
    if (found) {
      results.push('8. Product visible on storefront API: PASS');
    } else throw new Error('Created product not found in public products list');

    console.log('\n--- TEST RESULTS ---');
    results.forEach(r => console.log(r));
    console.log('OVERALL: ALL PASS ✅');
    process.exit(0);
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('\n--- TEST RESULTS ---');
    results.forEach(r => console.log(r));
    console.error(`FAILED AT CURRENT STEP: ${errorMsg}`);
    console.error('OVERALL: FAIL ❌');
    process.exit(1);
  }
}

runTests();

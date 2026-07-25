const axios = require('axios');
const fs = require('fs');
const { initializeApp: initializeAdminApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp: initializeClientApp } = require('firebase/app');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

// Load environment variables manually
require('dotenv').config({ path: '.env.local' });

// 1. Initialize Firebase Admin to read OTP from DB directly
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeAdminApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// 2. Initialize Firebase Client
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

async function runTests() {
  const results = [];
  try {
    // Step 1: Trigger OTP
    console.log('[STEP 1] Triggering OTP request...');
    const sendRes = await axios.post(`${API_BASE}/api/otp/send-login`, { email: TEST_EMAIL });
    if (sendRes.data.success) {
      results.push('1. Trigger OTP request: PASS');
    } else {
      throw new Error('API did not return success');
    }

    // Step 2: Confirm OTP generated
    console.log('[STEP 2] Fetching OTP from database...');
    // Wait for DB write (though it should be sync on the backend API before returning)
    await new Promise(resolve => setTimeout(resolve, 1000));
    const otpDoc = await db.collection('otps').doc(`${TEST_EMAIL.toLowerCase()}_login`).get();
    
    if (!otpDoc.exists) {
      throw new Error('OTP document not found in Firestore');
    }
    const otpData = otpDoc.data();
    const otpCode = otpData.code;
    if (!otpCode) throw new Error('OTP code missing in document');
    results.push(`2. Confirm OTP generated and retrievable (Code: ${otpCode}): PASS`);

    // Step 3: Submit OTP
    console.log('[STEP 3] Submitting OTP verification...');
    const verifyRes = await axios.post(`${API_BASE}/api/otp/verify-login`, { email: TEST_EMAIL, code: otpCode });
    if (verifyRes.data.success) {
      results.push('3. Submit OTP code: PASS');
    } else {
      throw new Error('Verification API failed');
    }

    // Step 4: Confirm Token
    console.log('[STEP 4] Checking for Custom Token...');
    const customToken = verifyRes.data.customToken;
    if (!customToken || typeof customToken !== 'string') {
      throw new Error('No custom token returned in response');
    }
    results.push('4. Response includes Custom Token: PASS');

    // Step 5: signInWithCustomToken
    console.log('[STEP 5] Signing in with Custom Token...');
    const userCredential = await signInWithCustomToken(clientAuth, customToken);
    if (userCredential.user && userCredential.user.uid) {
      results.push(`5. Custom Token sign-in (UID: ${userCredential.user.uid}): PASS`);
    } else {
      throw new Error('Sign in succeeded but user object missing');
    }

    console.log('\n--- TEST RESULTS ---');
    results.forEach(r => console.log(r));
    console.log('OVERALL: ALL PASS');
    process.exit(0);
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('\n--- TEST RESULTS ---');
    results.forEach(r => console.log(r));
    console.error(`FAILED AT CURRENT STEP: ${errorMsg}`);
    console.error('OVERALL: FAIL');
    process.exit(1);
  }
}

runTests();

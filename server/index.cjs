const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { initializeApp: initializeAdminApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const shippingService = require('./shippingService.cjs');
// Local credentials live in the ignored .env.local file; deployed platforms
// provide the same values through their environment.
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config();

// Fail closed: privileged access must never use shared fallback credentials.
const REQUIRED_ENV_VARS = [
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'JWT_SECRET',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'RECAPTCHA_SECRET_KEY'
];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
if (missingEnvVars.length > 0) {
  console.error(`[FATAL] Missing required environment variable(s): ${missingEnvVars.join(', ')}.`);
  console.error('[FATAL] Refusing to start because secure admin and Firebase Custom Token authentication are not configured.');
  process.exit(1);
}

let firebaseServiceAccount;
try {
  firebaseServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (firebaseServiceAccount.private_key) {
    firebaseServiceAccount.private_key = firebaseServiceAccount.private_key.replace(/\\n/g, '\n');
  }
  initializeAdminApp({ credential: cert(firebaseServiceAccount) });
} catch (error) {
  console.error('[FATAL] FIREBASE_SERVICE_ACCOUNT_JSON is invalid or could not initialize Firebase Admin.', error.message);
  process.exit(1);
}

const adminAuth = getAuth();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const app = express();

// Configure CORS from deployment configuration while preserving local Vite dev.
const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...localOrigins, ...configuredOrigins]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed by CORS.' });
  }
  return next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));

app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Admin configuration
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin@fezyslimes.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const JWT_SECRET = process.env.JWT_SECRET || 'fezyslimes-secret-jwt-key-2026';

// JWT admin validation middleware
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Authorization header required' });
  
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Invalid or unauthorized token' });
    }
    req.admin = decoded;
    next();
  });
}

// Customer identity always comes from a verified Firebase ID token, never a
// client-supplied email address.
async function verifyCustomerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Firebase authentication is required.' });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken.email) {
      return res.status(403).json({ error: 'The authenticated account has no email address.' });
    }
    req.customer = { uid: decodedToken.uid, email: decodedToken.email.toLowerCase() };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
  }
}

// Nodemailer SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'placeholder@example.com',
    pass: process.env.SMTP_PASS || 'placeholderpass'
  }
});

// Reusable email sending utility
async function sendEmail({ to, subject, html }) {
  try {
    // If no real SMTP keys are provided, fall back to console logging OTPs for easy developer workflow
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'placeholder@example.com') {
      console.warn(`\n=== [EMAIL FALLBACK] ===\nTo: ${to}\nSubject: ${subject}\nHTML: ${html}\n========================\n`);
      return { messageId: 'fallback-id' };
    }
    const info = await transporter.sendMail({
      from: `"FezySlimes" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    console.log(`[Email] Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[Email] Failed to send email to ${to}:`, error.message);
    throw error;
  }
}

// OTP Helpers
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveOTP(email, code, type) {
  const otpRef = db.collection('otps').doc(`${email.toLowerCase()}_${type}`);
  await otpRef.set({
    email: email.toLowerCase(),
    code,
    type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
    verified: false,
    createdAt: new Date()
  });
}

async function verifyOTP(email, code, type) {
  const otpRef = db.collection('otps').doc(`${email.toLowerCase()}_${type}`);
  const otpSnap = await otpRef.get();
  
  if (!otpSnap.exists) {
    return { success: false, message: 'No OTP code requested.' };
  }
  
  const data = otpSnap.data();
  if (data.verified) {
    return { success: false, message: 'This OTP has already been verified.' };
  }
  
  const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (new Date() > expiresAt) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }
  
  if (data.code !== code) {
    return { success: false, message: 'Incorrect OTP code.' };
  }
  
  await otpRef.update({ verified: true });
  return { success: true };
}

// reCAPTCHA verification endpoint
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
app.post('/api/verify-recaptcha', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'reCAPTCHA token is required.' });
  }
  try {
    const googleResponse = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      { params: { secret: RECAPTCHA_SECRET_KEY, response: token } }
    );
    const { success } = googleResponse.data;
    if (success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: 'reCAPTCHA verification failed.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal reCAPTCHA verification error.' });
  }
});

// Paystack Key configurations
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Paystack payment verification endpoint (Feature 1)
app.post('/api/verify-payment', async (req, res) => {
  const { 
    reference, 
    customerName, 
    email, 
    phone, 
    address, 
    landmark, 
    notes, 
    total, 
    items,
    selectedZone,
    selectedCourier,
    deliveryFee
  } = req.body;
  if (!reference) {
    return res.status(400).json({ error: 'Transaction reference is required.' });
  }
  try {
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const transactionData = paystackResponse.data.data;
    
    if (transactionData.status !== 'success') {
      return res.status(400).json({ error: 'Paystack transaction was not successful.' });
    }
    
    const expectedAmountKobo = Math.round(total * 100);
    if (transactionData.amount !== expectedAmountKobo) {
      return res.status(400).json({ error: 'Payment amount mismatch.' });
    }

    const orderDocRef = db.collection('orders').doc(reference);
    const result = await db.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(orderDocRef);
      if (docSnapshot.exists()) {
        const existingData = docSnapshot.data();
        return { orderId: existingData.orderId, trackingId: existingData.trackingId };
      }

      const generatedOrderId = 'FS-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);

      // Book via modular shipping interface (returns null/empty tracking initially)
      const shipment = await shippingService.createShipment(selectedCourier, {
        orderId: generatedOrderId,
        customer: { name: customerName, address }
      });

      const newOrder = {
        orderId: generatedOrderId,
        trackingId: shipment.trackingId || null,
        customer: {
          name: customerName,
          email: email.toLowerCase(),
          phone,
          address,
          landmark: landmark || '',
          notes: notes || ''
        },
        selectedZone: selectedZone || null,
        selectedCourier: selectedCourier || null,
        deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : 0,
        amount: total,
        paymentReference: reference,
        paymentStatus: 'Paid',
        trackingStatus: 'Processing',
        deliveryStatus: 'Processing',
        confirmed: false, // will require post-payment confirmation via OTP (Feature 2B)
        items,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.set(orderDocRef, newOrder);
      return { orderId: generatedOrderId, trackingId: shipment.trackingId || null };
    });

    // Send post-checkout Order Confirmation OTP (Feature 2B)
    const confirmationOTP = generateOTP();
    await saveOTP(email, confirmationOTP, 'order_' + reference);
    await sendEmail({
      to: email,
      subject: `Verify Your FezySlimes Order - Code: ${confirmationOTP}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #06b6d4; text-align: center;">Confirm Your FezySlimes Order 🤍</h2>
          <p>Thank you for your payment! To finalize and confirm your order (Order ID: <b>${result.orderId}</b>), please enter the following 6-digit OTP code on the order status confirmation screen:</p>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #ec4899; margin: 20px 0;">
            ${confirmationOTP}
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">This code will expire in 10 minutes. If you do not verify, your order is still recorded as Paid, but confirming helps us track and package your order faster!</p>
        </div>
      `
    });

    return res.status(200).json({ 
      success: true, 
      orderId: result.orderId, 
      trackingId: result.trackingId 
    });
  } catch (error) {
    const errorDetails = error.response?.data?.message || error.message;
    return res.status(500).json({ error: 'Backend payment verification failed.', details: errorDetails });
  }
});

// Paystack webhook listener
app.post('/api/paystack-webhook', async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Unauthorized webhook signature.');
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const data = event.data;
      const paystackReference = data.reference;
      const metadata = data.metadata || {};
      const orderDocRef = db.collection('orders').doc(paystackReference);

      await db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(orderDocRef);
        if (docSnapshot.exists()) return;

        const generatedOrderId = metadata.orderId || `FS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

        const newOrder = {
          orderId: generatedOrderId,
          trackingId: null, // Initial trackingId is null for manual fulfillment
          customer: {
            name: metadata.customerName || data.customer.first_name + ' ' + data.customer.last_name,
            email: data.customer.email.toLowerCase(),
            phone: data.customer.phone || metadata.phone || '',
            address: metadata.address || 'No Address Provided',
            landmark: metadata.landmark || '',
            notes: metadata.notes || ''
          },
          selectedZone: metadata.selectedZone || null,
          selectedCourier: metadata.selectedCourier || null,
          deliveryFee: metadata.deliveryFee !== undefined ? parseFloat(metadata.deliveryFee) : 0,
          amount: data.amount / 100,
          paymentReference: paystackReference,
          paymentStatus: 'Paid',
          trackingStatus: 'Processing',
          deliveryStatus: 'Processing',
          confirmed: false,
          items: metadata.items || [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        transaction.set(orderDocRef, newOrder);
      });
    }
    res.status(200).send('Webhook processed');
  } catch (error) {
    res.status(500).send('Internal Webhook Error');
  }
});

// SIGNUP OTP Endpoints (Feature 2A)
app.post('/api/otp/send-signup', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  
  const otp = generateOTP();
  try {
    await saveOTP(email, otp, 'signup');
    await sendEmail({
      to: email,
      subject: `Verify Your FezySlimes Account - Code: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #06b6d4; text-align: center;">Welcome to FezySlimes! 🤍</h2>
          <p>Please use the following 6-digit OTP code to verify and activate your account:</p>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #ec4899; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `
    });
    return res.status(200).json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send OTP email.' });
  }
});

app.post('/api/otp/verify-signup', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and OTP code are required.' });
  
  try {
    const result = await verifyOTP(email, code, 'signup');
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    // Update isVerified flag in Firestore users collection
    const userQuery = db.collection('users').where('email', '==', email.toLowerCase());
    const querySnapshot = await userQuery.get();
    if (!querySnapshot.empty) {
      const userDocRef = querySnapshot.docs[0].ref;
      await userDocRef.update({ isVerified: true });
    }

    return res.status(200).json({ success: true, message: 'Account successfully verified!' });
  } catch (err) {
    console.error('[Verify Signup] Error:', err);
    return res.status(500).json({ error: 'OTP verification failed.' });
  }
});

// ORDER CONFIRMATION OTP Endpoints (Feature 2B)
app.post('/api/otp/send-order-confirmation', async (req, res) => {
  const { email, reference } = req.body;
  if (!email || !reference) return res.status(400).json({ error: 'Email and reference are required.' });
  
  const otp = generateOTP();
  try {
    await saveOTP(email, otp, 'order_' + reference);
    await sendEmail({
      to: email,
      subject: `Confirm Your FezySlimes Order - Code: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #06b6d4; text-align: center;">Confirm Your Order 🤍</h2>
          <p>Please enter the 6-digit OTP code below to finalize your order confirmation:</p>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #ec4899; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    });
    return res.status(200).json({ success: true, message: 'Order verification OTP sent.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

app.post('/api/otp/confirm-order', async (req, res) => {
  const { email, reference, code } = req.body;
  if (!email || !reference || !code) {
    return res.status(400).json({ error: 'Email, payment reference, and OTP code are required.' });
  }
  
  try {
    const otpResult = await verifyOTP(email, code, 'order_' + reference);
    if (!otpResult.success) {
      return res.status(400).json({ error: otpResult.message });
    }
    
    // Update order confirmed status in Firestore
    const orderDocRef = db.collection('orders').doc(reference);
    const orderSnap = await orderDocRef.get();
    if (!orderSnap.exists()) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    
    await orderDocRef.update({
      confirmed: true,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    const orderData = orderSnap.data();
    
    // Send final receipt email (Feature 2B)
    const itemsListHtml = orderData.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${item.name} (x${item.quantity})</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('');
    
    await sendEmail({
      to: email,
      subject: `Order Confirmed: ${orderData.orderId} 💖`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #10b981; text-align: center;">Order Confirmed! 💖</h2>
          <p>Thank you for choosing FezySlimes. Your order is confirmed and is now being processed.</p>
          <h3>Order Details:</h3>
          <p><b>Order ID:</b> ${orderData.orderId}<br/><b>Tracking ID:</b> ${orderData.trackingId || 'Awaiting shipment (will be added once shipped)'}<br/><b>Payment Reference:</b> ${reference}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #e2e8f0;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
            </tbody>
            <tfoot>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Total Amount</td>
                <td style="padding: 8px; font-weight: bold; text-align: right;">₦${orderData.amount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          <p style="margin-top: 20px; font-size: 14px;">You can track your package progress on our store using your Order ID or Tracking ID at any time!</p>
        </div>
      `
    });
    
    return res.status(200).json({ success: true, message: 'Order finalized and confirmed receipt sent!' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to confirm order.' });
  }
});

// LOGIN OTP Endpoints (Passwordless Auth)
app.post('/api/otp/send-login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    // Rate Limiting: Max 3 requests per 10 mins
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const otpsRef = db.collection('otps');
    const q = otpsRef
      .where('email', '==', email.toLowerCase())
      .where('type', '==', 'login')
      .where('createdAt', '>', tenMinsAgo);
    const snap = await q.get();
    
    if (snap.size >= 3) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait 10 minutes.' });
    }

    const otp = generateOTP();
    await saveOTP(email, otp, 'login');
    
    await sendEmail({
      to: email,
      subject: `Your FezySlimes Login Code: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #06b6d4; text-align: center;">Login to FezySlimes 🤍</h2>
          <p>Please use the following 6-digit OTP code to log in to your account securely:</p>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #ec4899; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    });
    return res.status(200).json({ success: true, message: 'Login OTP sent.' });
  } catch (err) {
    console.error('[Send Login OTP] Error:', err);
    return res.status(500).json({ error: 'Failed to send login OTP.' });
  }
});

app.post('/api/otp/verify-login', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and OTP code are required.' });
  
  try {
    const result = await verifyOTP(email, code, 'login');
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    const normalizedEmail = email.toLowerCase();
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(normalizedEmail);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      // OTP ownership is the verification step for this passwordless flow.
      firebaseUser = await adminAuth.createUser({ email: normalizedEmail, emailVerified: true });
    }
    const customToken = await adminAuth.createCustomToken(firebaseUser.uid);

    return res.status(200).json({ 
      success: true, 
      message: 'OTP verified successfully.',
      customToken
    });
  } catch (err) {
    console.error('[Verify Login OTP] Error:', err);
    return res.status(500).json({ error: 'Login OTP verification failed.' });
  }
});

// NEWSLETTER SUBSCRIBE Endpoint
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  
  try {
    const subRef = db.collection('subscribers').doc(email.toLowerCase());
    const snap = await subRef.get();
    if (!snap.exists()) {
      await subRef.set({
        email: email.toLowerCase(),
        subscribedAt: FieldValue.serverTimestamp()
      });
    }
    return res.status(200).json({ success: true, message: 'Successfully subscribed to the newsletter!' });
  } catch (err) {
    console.error('[Subscribe] Error:', err);
    return res.status(500).json({ error: 'Failed to subscribe.' });
  }
});


// ADMIN ENDPOINTS (Feature 3)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin', user: username }, JWT_SECRET, { expiresIn: '8h' });
    return res.status(200).json({ success: true, token });
  }
  return res.status(401).json({ error: 'Invalid admin credentials' });
});

// Admin Product CRUD and Public Get
app.get('/api/products', async (req, res) => {
  try {
    const productsRef = db.collection('products');
    const snap = await productsRef.get();
    const list = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return res.status(200).json(list);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Single product by ID (used by storefront quick-view / detail pages)
app.get('/api/products/:id', async (req, res) => {
  try {
    const prodRef = db.collection('products').doc(req.params.id);
    const snap = await prodRef.get();
    if (!snap.exists()) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json({ id: snap.id, ...snap.data() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Helper to add timeout to Promises that might hang (like Firebase gRPC connections)
const withTimeout = (promise, ms, errorMsg) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg || 'Operation timed out')), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise
  ]);
};

// Admin: Create product
// Images are now uploaded to Firebase Storage by the Admin frontend.
// The frontend sends a plain JSON body containing the Firebase Storage download URL.
app.post('/api/admin/products', verifyAdminToken, async (req, res) => {
  console.log('[Backend POST /api/admin/products] Request received');
  try {
    const { name, description, price, category, texture, scent, stock, image } = req.body;
    console.log(`[Backend] Parsed payload for product: ${name}`);

    const productsRef = db.collection('products');
    const newId = productsRef.doc().id;

    const newProduct = {
      id: newId,
      name,
      description: description || '',
      price: parseFloat(price),
      category,
      texture: texture || '',
      scent: scent || '',
      stock: parseInt(stock || '0'),
      // image is a Firebase Storage download URL sent from the frontend
      image: image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      rating: 5.0,
      reviewsCount: 0,
      createdAt: new Date()
    };

    console.log(`[Backend] Attempting to write document to Firestore with ID: ${newId}...`);
    // Wrapped in a timeout so it never hangs silently if Firestore network is down
    await withTimeout(
      productsRef.doc(newId).set(newProduct),
      10000, 
      "Firestore setDoc timed out after 10 seconds. Check Firebase projectId and network connectivity."
    );
    
    console.log(`[Backend] Document ${newId} saved successfully!`);
    return res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    console.error('[Backend POST /api/admin/products] Fatal Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

// Admin: Update product
app.put('/api/admin/products/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, texture, scent, stock, image } = req.body;

    const prodRef = db.collection('products').doc(id);
    const snap = await prodRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Product not found' });

    const updates = {
      name,
      description,
      price: parseFloat(price),
      category,
      texture: texture || '',
      scent: scent || '',
      stock: parseInt(stock || '0'),
      updatedAt: new Date()
    };
    // Only overwrite image if a new URL was provided
    if (image) updates.image = image;

    await prodRef.update(updates);
    return res.status(200).json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    console.error('[Update Product]', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/admin/products/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('products').doc(id).delete();
    return res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Customer: Get orders by email (Feature 4 - Order History)
app.get('/api/orders/my-orders', verifyCustomerToken, async (req, res) => {
  try {
    const ordersRef = db.collection('orders');
    const q = ordersRef.where('customer.email', '==', req.customer.email);
    const snap = await q.get();
    const list = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    // Sort newest first
    list.sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() || (a.createdAt?.seconds || 0) * 1000;
      const bMs = b.createdAt?.toMillis?.() || (b.createdAt?.seconds || 0) * 1000;
      return bMs - aMs;
    });
    return res.status(200).json(list);
  } catch (err) {
    console.error('[My Orders] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// Admin Orders view and status update
app.get('/api/admin/orders', verifyAdminToken, async (req, res) => {
  try {
    const snap = await db.collection('orders').get();
    const list = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return res.status(200).json(list);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.put('/api/admin/orders/:id/status', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { trackingStatus, deliveryStatus, trackingId } = req.body;
    const orderRef = db.collection('orders').doc(id);
    
    await orderRef.update({
      trackingStatus,
      deliveryStatus,
      trackingId: trackingId !== undefined ? trackingId : null,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    return res.status(200).json({ success: true, message: 'Order status updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// Seed Initial Products
const initialProducts = [
  {
    id: '1',
    name: 'Coquette Marshmallow Cocoa',
    price: 25600,
    category: 'diy-clay',
    texture: 'DIY Clay Kit',
    scent: 'Toasted Marshmallow & Cocoa',
    description: 'A beautiful pastel pink base topped with handmade clay coquette bows, fake cocoa sprinkles, and chocolate drizzle. Satisfying, spreadable, and ultra-cute.',
    image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    reviewsCount: 42,
    stock: 50
  },
  {
    id: '2',
    name: "Snoop's Spa Day Slime",
    price: 24800,
    category: 'clear',
    texture: 'Clear Slime',
    scent: 'Fresh Cucumber & Aloe',
    description: 'Translucent blue base with cucumber slices, bath bomb charms, and premium cosmetic glitters. Offers incredibly crisp ASMR bubble clicks.',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    reviewsCount: 38,
    stock: 40
  },
  {
    id: '3',
    name: 'Pumpkin Patch Pals',
    price: 24500,
    category: 'butter',
    texture: 'Soft Butter Slime',
    scent: 'Pumpkin Spice & Vanilla',
    description: 'Warm orange butter base featuring cute little pumpkin faces, maple leaf charms, and cookie crumbs. Perfectly soft and stretchable.',
    image: 'https://images.unsplash.com/photo-1508885368104-a2176b6b7a9a?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    reviewsCount: 29,
    stock: 35
  },
  {
    id: '4',
    name: 'Trevi Fountain Wishes',
    price: 25100,
    category: 'crunchy',
    texture: 'Bingsu Crunchy',
    scent: 'Oasis Breeze & Ocean Salt',
    description: 'Packed with reflective teal bingsu beads, gold coin charms, and iridescent glitters. Mimics the clear waters of Rome\'s famous fountain.',
    image: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    reviewsCount: 51,
    stock: 30
  },
  {
    id: '5',
    name: 'Mango Ice Cream Slime',
    price: 25800,
    category: 'glossy',
    texture: 'Glossy Slime',
    scent: 'Ripe Mango & Sweet Cream',
    description: 'Thick, glossy yellow slime base topped with an realistic mango ice cream scoop clay and mango syrup drizzle. Extremely clicky.',
    image: 'https://images.unsplash.com/photo-1549396564-3484afb12e9b?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    reviewsCount: 31,
    stock: 25
  },
  {
    id: '6',
    name: 'Krispy Marshmallow Treat',
    price: 25300,
    category: 'foam-bead',
    texture: 'Floam / Foam Bead',
    scent: 'Vanilla Crisps & Marshmallow Fluff',
    description: 'A crunchy white floam base with colorful marshmallow sprinkles and miniature marshmallow charms. Super bubbly.',
    image: 'https://images.unsplash.com/photo-1559738017-ff2e120900c4?auto=format&fit=crop&w=600&q=80',
    rating: 4.7,
    reviewsCount: 24,
    stock: 20
  },
  {
    id: 'slime-activator',
    name: 'Slime Activator (Borax Spray)',
    price: 1500,
    category: 'care',
    texture: 'Liquid',
    scent: 'Unscented',
    description: 'Compulsory for slime maintenance. Reactivates sticky or melted slimes back to their perfect texture.',
    image: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    reviewsCount: 150,
    stock: 500
  }
];

async function seedProductsIfNeeded() {
  try {
    const productsRef = db.collection('products');
    const snapshot = await productsRef.get();
    if (snapshot.empty) {
      console.log('[Seed] Products collection is empty. Seeding initial products...');
      for (const prod of initialProducts) {
        await productsRef.doc(prod.id).set(prod);
      }
      console.log('[Seed] Seeding completed.');
    }
  } catch (error) {
    console.error('[Seed] Error seeding products:', error);
  }
}

const defaultShippingRates = {
  "Lagos-Uber": 3000,
  "Lagos-Gokada": 2500,
  "Ogun-DHL": 3500,
  "Oyo-DHL": 3500,
  "Abuja-DHL": 5000,
  "PH-DHL": 4500
};

async function seedShippingRatesIfNeeded() {
  try {
    const ratesDocRef = db.collection('settings').doc('shipping_rates');
    const snapshot = await ratesDocRef.get();
    if (!snapshot.exists) {
      console.log('[Seed] Shipping rates document is empty. Seeding initial rates...');
      await ratesDocRef.set(defaultShippingRates);
      console.log('[Seed] Shipping rates seeding completed.');
    }
  } catch (error) {
    console.error('[Seed] Error seeding shipping rates:', error);
  }
}

// GET all shipping rates (Public)
app.get('/api/shipping-rates', async (req, res) => {
  try {
    const ratesDocRef = db.collection('settings').doc('shipping_rates');
    const snapshot = await ratesDocRef.get();
    if (snapshot.exists()) {
      return res.status(200).json(snapshot.data());
    } else {
      return res.status(200).json(defaultShippingRates);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch shipping rates' });
  }
});

// PUT update shipping rates (Admin)
app.put('/api/admin/shipping-rates', verifyAdminToken, async (req, res) => {
  try {
    const ratesDocRef = db.collection('settings').doc('shipping_rates');
    await ratesDocRef.set(req.body);
    return res.status(200).json({ success: true, message: 'Shipping rates updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update shipping rates' });
  }
});


// --- NEW SECURE ENDPOINTS FOR FRONTEND ---

app.get('/api/users/profile', verifyCustomerToken, async (req, res) => {
  try {
    const docSnap = await db.collection('users').doc(req.customer.uid).get();
    if (docSnap.exists) {
      return res.status(200).json(docSnap.data());
    }
    return res.status(200).json({
      displayName: '',
      phoneNumber: '',
      notifications: { orderUpdates: true, promotions: false }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/users/profile', verifyCustomerToken, async (req, res) => {
  try {
    await db.collection('users').doc(req.customer.uid).set(req.body, { merge: true });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/users/wishlist', verifyCustomerToken, async (req, res) => {
  try {
    const docSnap = await db.collection('wishlists').doc(req.customer.uid).get();
    if (docSnap.exists) {
      return res.status(200).json(docSnap.data().items || []);
    }
    return res.status(200).json([]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

app.put('/api/users/wishlist', verifyCustomerToken, async (req, res) => {
  try {
    await db.collection('wishlists').doc(req.customer.uid).set({ items: req.body }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update wishlist' });
  }
});

app.get('/api/users/addresses', verifyCustomerToken, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.customer.uid).collection('addresses').get();
    const addresses = [];
    snap.forEach((doc) => addresses.push({ id: doc.id, ...doc.data() }));
    return res.status(200).json(addresses);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

app.post('/api/users/addresses', verifyCustomerToken, async (req, res) => {
  try {
    const address = req.body;
    const colRef = db.collection('users').doc(req.customer.uid).collection('addresses');
    const addressId = address.id || colRef.doc().id;
    const finalAddress = { ...address, id: addressId, isDefault: address.isDefault || false };
    
    if (finalAddress.isDefault) {
      const snap = await colRef.get();
      const batch = db.batch();
      snap.forEach((doc) => {
        if (doc.data().isDefault) batch.update(doc.ref, { isDefault: false });
      });
      await batch.commit();
    }
    
    await colRef.doc(addressId).set(finalAddress, { merge: true });
    return res.status(200).json({ success: true, id: addressId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save address' });
  }
});

app.put('/api/users/addresses/:id/default', verifyCustomerToken, async (req, res) => {
  try {
    const colRef = db.collection('users').doc(req.customer.uid).collection('addresses');
    const snap = await colRef.get();
    const batch = db.batch();
    snap.forEach((doc) => {
      if (doc.data().isDefault) batch.update(doc.ref, { isDefault: false });
    });
    await batch.commit();
    
    await colRef.doc(req.params.id).update({ isDefault: true });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to set default address' });
  }
});

app.delete('/api/users/addresses/:id', verifyCustomerToken, async (req, res) => {
  try {
    await db.collection('users').doc(req.customer.uid).collection('addresses').doc(req.params.id).delete();
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete address' });
  }
});

app.get('/api/orders/search/:id', async (req, res) => {
  try {
    const searchId = req.params.id.trim().toUpperCase();
    const ordersRef = db.collection('orders');
    
    const trackingSnap = await ordersRef.where("trackingId", "==", searchId).get();
    if (!trackingSnap.empty) {
      return res.status(200).json({ id: trackingSnap.docs[0].id, ...trackingSnap.docs[0].data() });
    }
    
    const orderSnap = await ordersRef.where("orderId", "==", searchId).get();
    if (!orderSnap.empty) {
      return res.status(200).json({ id: orderSnap.docs[0].id, ...orderSnap.docs[0].data() });
    }
    
    return res.status(200).json(null);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to search order' });
  }
});

app.post('/api/auth/google-login', verifyCustomerToken, async (req, res) => {
  try {
    const userDocRef = db.collection('users').doc(req.customer.uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      await userDocRef.set({
        email: req.customer.email,
        isVerified: true,
        createdAt: new Date()
      });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to sync Google user' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`FezySlimes Secure Payment Backend running on port ${PORT}`);
  await seedProductsIfNeeded();
  await seedShippingRatesIfNeeded();
});

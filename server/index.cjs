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
const { v2: cloudinary } = require('cloudinary');
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

// Cloudinary — server-side image hosting (persists across redeploys on any platform)
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[Warn] Cloudinary env vars not set. Product image uploads will fail.');
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[Cloudinary] Configured successfully.');
}

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

// Configure Multer for File Uploads (Memory Storage for Serverless Firebase Upload)
const upload = multer({ storage: multer.memoryStorage() });

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

// Admin: Upload product image to Cloudinary
// Images are uploaded server-side using the Admin JWT, keeping API secrets
// off the client. The returned URL is a permanent Cloudinary CDN URL that
// survives redeploys on any hosting platform.
app.post('/api/admin/upload', verifyAdminToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const isVideo = req.file.mimetype.startsWith('video/');
    const uploadOptions = {
      folder: 'fezyslimes/products',
      resource_type: isVideo ? 'video' : 'image',
    };

    if (isVideo) {
      uploadOptions.allowed_formats = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'ogv'];
      uploadOptions.transformation = [
        { quality: 'auto', fetch_format: 'auto' }
      ];
    } else {
      uploadOptions.allowed_formats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      uploadOptions.transformation = [
        { width: 800, height: 800, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
      ];
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    console.log(`[Cloudinary] Uploaded: ${uploadResult.secure_url}`);
    res.status(200).json({ url: uploadResult.secure_url });
  } catch (error) {
    console.error('[Cloudinary Upload Error]:', error.message);
    res.status(500).json({ error: 'Failed to upload file to Cloudinary. Check CLOUDINARY_* env vars.' });
  }
});

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

// ---------------------------------------------------------------------------
// BANK TRANSFER ORDER PLACEMENT (replaces Paystack)
// ---------------------------------------------------------------------------

// GET bank details (public — shown to customer on checkout)
app.get('/api/bank-details', async (req, res) => {
  try {
    const docRef = db.collection('settings').doc('bank_details');
    const snap = await docRef.get();
    if (snap.exists) {
      return res.status(200).json(snap.data());
    }
    // Return empty defaults so frontend always gets a valid shape
    return res.status(200).json({ bankName: '', accountNumber: '', accountName: '' });
  } catch (err) {
    console.error('[bank-details GET]', err.message);
    return res.status(500).json({ error: 'Failed to fetch bank details.' });
  }
});

// PUT bank details (admin only)
app.put('/api/admin/settings/bank-details', verifyAdminToken, async (req, res) => {
  const { bankName, accountNumber, accountName } = req.body;
  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ error: 'bankName, accountNumber, and accountName are all required.' });
  }
  try {
    const docRef = db.collection('settings').doc('bank_details');
    await docRef.set({ bankName, accountNumber, accountName });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update bank details.' });
  }
});

// ---------------------------------------------------------------------------
// SHIPPING RATES (public read, admin write)
// Stored in Firestore as settings/shipping_rates → { zones: [{key, label, rate}] }
// ---------------------------------------------------------------------------

const SHIPPING_RATES_DEFAULT = [
  { key: 'Lagos-Uber',   label: 'Lagos (Uber Courier)',              rate: 3000, courier: 'Uber',   state: 'Lagos' },
  { key: 'Lagos-Gokada', label: 'Lagos (Gokada Bike)',               rate: 2500, courier: 'Gokada', state: 'Lagos' },
  { key: 'Ogun-DHL',     label: 'Ogun State (DHL)',                  rate: 3500, courier: 'DHL',    state: 'Ogun State' },
  { key: 'Oyo-DHL',      label: 'Oyo State (DHL)',                   rate: 3500, courier: 'DHL',    state: 'Oyo State' },
  { key: 'Abuja-DHL',    label: 'Abuja FCT (DHL)',                   rate: 5000, courier: 'DHL',    state: 'Abuja (FCT)' },
  { key: 'PH-DHL',       label: 'Port Harcourt / Rivers State (DHL)', rate: 4500, courier: 'DHL',   state: 'Port Harcourt / Rivers State' },
];

// GET shipping rates (public — used by Contact page and checkout)
app.get('/api/shipping-rates', async (req, res) => {
  try {
    const docRef = db.collection('settings').doc('shipping_rates');
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      return res.status(200).json(Array.isArray(data.zones) ? data.zones : SHIPPING_RATES_DEFAULT);
    }
    // First-time: return defaults (and seed Firestore)
    await docRef.set({ zones: SHIPPING_RATES_DEFAULT });
    return res.status(200).json(SHIPPING_RATES_DEFAULT);
  } catch (err) {
    console.error('[shipping-rates GET]', err.message);
    return res.status(500).json({ error: 'Failed to fetch shipping rates.' });
  }
});

// PUT shipping rates (admin only) — replaces the full zones array
app.put('/api/admin/shipping-rates', verifyAdminToken, async (req, res) => {
  const { zones } = req.body;
  if (!Array.isArray(zones) || zones.length === 0) {
    return res.status(400).json({ error: 'zones must be a non-empty array.' });
  }
  // Validate each zone has required fields
  for (const z of zones) {
    if (!z.key || !z.label || z.rate === undefined) {
      return res.status(400).json({ error: 'Each zone must have key, label, and rate.' });
    }
  }
  try {
    await db.collection('settings').doc('shipping_rates').set({ zones });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[shipping-rates PUT]', err.message);
    return res.status(500).json({ error: 'Failed to update shipping rates.' });
  }
});

// POST place-order — customer clicks "I've Made Payment"
// Creates the order in Firestore with paymentStatus 'Awaiting Payment Confirmation'.
app.post('/api/place-order', async (req, res) => {
  const {
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

  if (!customerName || !email || !total || !items || !items.length) {
    return res.status(400).json({ error: 'customerName, email, total and items are required.' });
  }

  try {
    const generatedOrderId = 'FS-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
    const orderDocRef = db.collection('orders').doc(generatedOrderId);

    const newOrder = {
      orderId: generatedOrderId,
      trackingId: null,
      customer: {
        name: customerName,
        email: email.toLowerCase(),
        phone: phone || '',
        address: address || '',
        landmark: landmark || '',
        notes: notes || ''
      },
      selectedZone: selectedZone || null,
      selectedCourier: selectedCourier || null,
      deliveryFee: deliveryFee !== undefined ? parseFloat(deliveryFee) : 0,
      amount: parseFloat(total),
      paymentStatus: 'Awaiting Payment Confirmation',
      paymentMethod: 'Bank Transfer',
      trackingStatus: 'Awaiting Payment Confirmation',
      deliveryStatus: 'Awaiting Payment Confirmation',
      confirmed: false,
      items,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await orderDocRef.set(newOrder);

    // Notify customer by email
    await sendEmail({
      to: email,
      subject: `FezySlimes Order Received — ${generatedOrderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #06b6d4; text-align: center;">Order Received! 🤍</h2>
          <p>Hi <strong>${customerName}</strong>, we have received your order <strong>${generatedOrderId}</strong>.</p>
          <p>Your payment is currently <strong>awaiting confirmation</strong>. Once we verify the transfer in our account, your order will be confirmed and processing will begin.</p>
          <p style="color: #64748b; font-size: 12px;">You can track your order using Order ID: <strong>${generatedOrderId}</strong> at any time on our website.</p>
        </div>
      `
    });

    return res.status(201).json({ success: true, orderId: generatedOrderId });
  } catch (error) {
    console.error('[Place Order] Error:', error);
    return res.status(500).json({ error: 'Failed to place order.', details: error.message });
  }
});

// Admin: Confirm payment received — marks order as paid and moves it to processing
app.put('/api/admin/orders/:id/confirm-payment', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    let orderRef = db.collection('orders').doc(id);
    let snap = await orderRef.get();
    if (!snap.exists) {
      const q = await db.collection('orders').where('orderId', '==', id).get();
      if (!q.empty) {
        orderRef = q.docs[0].ref;
        snap = q.docs[0];
      } else {
        return res.status(404).json({ error: 'Order not found.' });
      }
    }

    await orderRef.update({
      paymentStatus: 'Paid',
      trackingStatus: 'Order Confirmed',
      deliveryStatus: 'Order Confirmed',
      confirmed: true,
      updatedAt: FieldValue.serverTimestamp()
    });

    const orderData = snap.data();
    if (orderData?.customer?.email) {
      await sendEmail({
        to: orderData.customer.email,
        subject: `Payment Confirmed — FezySlimes Order ${orderData.orderId || id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #10b981; text-align: center;">Payment Confirmed! 💖</h2>
            <p>Hi <strong>${orderData.customer.name || 'Valued Customer'}</strong>, we have confirmed your bank transfer for order <strong>${orderData.orderId || id}</strong>.</p>
            <p>Your order is now <strong>confirmed and processing</strong>. We will update your tracking status as we prepare your slimes!</p>
          </div>
        `
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Confirm Payment] Error:', err);
    return res.status(500).json({ error: 'Failed to confirm payment.' });
  }
});

// Legacy stub — keep the old Paystack route alive so it doesn't cause hard 404 errors
app.post('/api/verify-payment', (req, res) => {
  return res.status(410).json({ error: 'Paystack integration has been removed. Orders now use manual bank transfer via /api/place-order.' });
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
    const { name, description, price, category, texture, scent, stock, image, images } = req.body;
    console.log(`[Backend] Parsed payload for product: ${name}`);
    // Normalise the images array — accept both the new multi-image field and the
    // legacy single image string so older clients keep working.
    const imagesArray = Array.isArray(images) && images.length > 0
      ? images
      : (image ? [image] : []);
    const primaryImage = image ||
      imagesArray[0] ||
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
    console.log(`[Backend] images array (${imagesArray.length} items):`, imagesArray);

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
      // Legacy single-image field — keeps existing product cards working
      image: primaryImage,
      // Multi-image/video array — the authoritative media list going forward
      images: imagesArray,
      rating: 5.0,
      reviewsCount: 0,
      createdAt: new Date()
    };

    console.log(`[Backend] Attempting to write document to Firestore with ID: ${newId}...`);
    // Wrapped in a timeout so it never hangs silently if Firestore network is down
    await withTimeout(
      productsRef.doc(newId).set(newProduct),
      10000,
      'Firestore setDoc timed out after 10 seconds. Check Firebase projectId and network connectivity.'
    );

    console.log(`[Backend] Document ${newId} saved successfully with ${imagesArray.length} media item(s)!`);
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
    const { name, description, price, category, texture, scent, stock, image, images } = req.body;

    const prodRef = db.collection('products').doc(id);
    const snap = await prodRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Product not found' });

    // Normalise the images array — accept both the new multi-image field and the
    // legacy single image string so older clients keep working.
    const imagesArray = Array.isArray(images) && images.length > 0
      ? images
      : (image ? [image] : null); // null = don't touch existing array if nothing was sent

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

    // Only overwrite image fields when the client actually sent media
    if (image) updates.image = image;
    if (imagesArray !== null) {
      updates.images = imagesArray;
      // Keep the legacy field in sync with the first image/non-video in the array
      if (!image) {
        updates.image = imagesArray[0] ||
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
      }
    }

    console.log(`[Backend PUT /api/admin/products/${id}] Updating with ${imagesArray ? imagesArray.length : 0} media item(s)`);
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
    const { trackingStatus, deliveryStatus, orderStatus, paymentStatus, trackingId } = req.body;
    let orderRef = db.collection('orders').doc(id);
    let snap = await orderRef.get();
    if (!snap.exists) {
      const q = await db.collection('orders').where('orderId', '==', id).get();
      if (!q.empty) {
        orderRef = q.docs[0].ref;
        snap = q.docs[0];
      } else {
        return res.status(404).json({ error: 'Order not found' });
      }
    }
    
    const updates = {
      updatedAt: FieldValue.serverTimestamp()
    };
    if (trackingStatus !== undefined) updates.trackingStatus = trackingStatus;
    if (deliveryStatus !== undefined) updates.deliveryStatus = deliveryStatus;
    else if (trackingStatus !== undefined) updates.deliveryStatus = trackingStatus;
    if (orderStatus !== undefined) updates.orderStatus = orderStatus;
    else if (trackingStatus !== undefined) updates.orderStatus = trackingStatus;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (trackingId !== undefined) updates.trackingId = trackingId || null;
    
    await orderRef.update(updates);
    
    return res.status(200).json({ success: true, message: 'Order status updated' });
  } catch (err) {
    console.error('[Update Order Status] Error:', err);
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

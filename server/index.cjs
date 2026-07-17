const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, runTransaction, serverTimestamp } = require('firebase/firestore');
require('dotenv').config();

// Public Firebase config used to initialize the client SDK on the backend
const firebaseConfig = {
  apiKey: "AIzaSyB8Uarm1Wfr9gfCGhohvSBNpT3zBpzAyYQ",
  authDomain: "slime-business.firebaseapp.com",
  projectId: "slime-business",
  storageBucket: "slime-business.firebasestorage.app",
  messagingSenderId: "1056410131791",
  appId: "1:1056410131791:web:dbee93e059d2900d10b93a"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();

// Configure CORS to allow frontend communication
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6LeIxAcTAAAAAGG-v2bB0aeM67KsFI7y64Cis09y';

/**
 * POST /api/verify-recaptcha
 * Verifies the Google reCAPTCHA v2 token server-side.
 */
app.post('/api/verify-recaptcha', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    console.error('[reCAPTCHA] Missing verification token in request body');
    return res.status(400).json({ success: false, error: 'reCAPTCHA token is required.' });
  }

  try {
    console.log('[reCAPTCHA] Verifying token with Google API...');
    const googleResponse = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET_KEY,
          response: token
        }
      }
    );

    const { success, 'error-codes': errorCodes } = googleResponse.data;
    console.log(`[reCAPTCHA] Google verification success: ${success}`, errorCodes ? `, errors: ${errorCodes}` : '');

    if (success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: 'reCAPTCHA challenge failed. Please try again.' });
    }
  } catch (error) {
    console.error('[reCAPTCHA] Server verification failed: ', error.message);
    return res.status(500).json({ success: false, error: 'Internal server verification error.' });
  }
});

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * POST /api/verify-payment
 * Triggered by frontend callback after payment completion.
 * Calls Paystack API to verify transaction details before creating order.
 */
app.post('/api/verify-payment', async (req, res) => {
  const { reference, customerName, email, phone, address, landmark, notes, total, items } = req.body;

  console.log(`[Verify] Starting payment verification for reference: ${reference}`);

  if (!reference) {
    console.error('[Verify] Mising payment reference in request body');
    return res.status(400).json({ error: 'Transaction reference is required.' });
  }

  try {
    // 1. Query Paystack Transaction Verification Endpoint
    console.log(`[Verify] Contacting Paystack verification endpoint for: ${reference}`);
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const transactionData = paystackResponse.data.data;
    console.log(`[Verify] Paystack returned status: ${transactionData.status}, amount: ${transactionData.amount} kobo`);

    // 2. Validate Payment Integrity
    if (transactionData.status !== 'success') {
      console.error(`[Verify] Paystack payment failed. Status: ${transactionData.status}`);
      return res.status(400).json({ error: 'Paystack payment transaction was not successful.' });
    }

    const expectedAmountKobo = Math.round(total * 100);
    if (transactionData.amount !== expectedAmountKobo) {
      console.error(`[Verify] Payment amount mismatch. Expected: ${expectedAmountKobo} kobo, Got: ${transactionData.amount} kobo`);
      return res.status(400).json({ 
        error: `Payment amount mismatch. Expected: ${expectedAmountKobo} kobo, Paid: ${transactionData.amount} kobo.` 
      });
    }

    // 3. Write Order inside a safe Firestore Transaction to prevent duplication
    console.log(`[Verify] Initializing Firestore transaction for reference: ${reference}`);
    const orderDocRef = doc(db, 'orders', reference);

    const result = await runTransaction(db, async (transaction) => {
      const docSnapshot = await transaction.get(orderDocRef);
      
      if (docSnapshot.exists()) {
        console.log(`[Verify] Order for reference ${reference} already exists. Returning duplicate data.`);
        const existingData = docSnapshot.data();
        return { 
          orderId: existingData.orderId, 
          trackingId: existingData.trackingId 
        };
      }

      const generatedOrderId = 'FS-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
      const generatedTrackingId = 'TRK-FS-' + Math.floor(100000 + Math.random() * 900000);

      const newOrder = {
        orderId: generatedOrderId,
        trackingId: generatedTrackingId,
        customer: {
          name: customerName,
          email: email,
          phone: phone,
          address: address,
          landmark: landmark || '',
          notes: notes || ''
        },
        amount: total,
        paymentReference: reference,
        paymentStatus: 'Paid',
        trackingStatus: 'Order Confirmed',
        deliveryStatus: 'Order Confirmed',
        items: items,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      transaction.set(orderDocRef, newOrder);
      console.log(`[Verify] Transaction set successful. Generated Order ID: ${generatedOrderId}`);
      return { orderId: generatedOrderId, trackingId: generatedTrackingId };
    });

    console.log(`[Verify] Verification and Firestore saving completed successfully for ref: ${reference}`);
    return res.status(200).json({ 
      success: true, 
      orderId: result.orderId, 
      trackingId: result.trackingId 
    });

  } catch (error) {
    const errorDetails = error.response?.data?.message || error.message;
    console.error('[Verify] Verification failed: ', errorDetails);
    return res.status(500).json({ 
      error: 'Backend payment verification failed.', 
      details: errorDetails 
    });
  }
});

/**
 * POST /api/paystack-webhook
 * Paystack background fallback event listener.
 */
app.post('/api/paystack-webhook', async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.error('[Webhook] Unauthorized webhook signature');
      return res.status(401).send('Unauthorized webhook signature.');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const data = event.data;
      const paystackReference = data.reference;
      const metadata = data.metadata || {};

      console.log(`[Webhook] Processing charge.success for ref: ${paystackReference}`);

      const orderDocRef = doc(db, 'orders', paystackReference);

      await runTransaction(db, async (transaction) => {
        const docSnapshot = await transaction.get(orderDocRef);
        
        if (docSnapshot.exists()) {
          console.log(`[Webhook] Reference ${paystackReference} already exists. Skipping duplicate webhook execution.`);
          return; // Already created
        }

        const generatedOrderId = metadata.orderId || `FS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const generatedTrackingId = metadata.trackingId || `TRK-FS-${Math.floor(100000 + Math.random() * 900000)}`;

        const newOrder = {
          orderId: generatedOrderId,
          trackingId: generatedTrackingId,
          customer: {
            name: metadata.customerName || data.customer.first_name + ' ' + data.customer.last_name,
            email: data.customer.email,
            phone: data.customer.phone || metadata.phone || '',
            address: metadata.address || 'No Address Provided',
            landmark: metadata.landmark || '',
            notes: metadata.notes || ''
          },
          amount: data.amount / 100,
          paymentReference: paystackReference,
          paymentStatus: 'Paid',
          trackingStatus: 'Order Confirmed',
          deliveryStatus: 'Order Confirmed',
          items: metadata.items || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        transaction.set(orderDocRef, newOrder);
        console.log(`[Webhook] Reference ${paystackReference} saved successfully.`);
      });
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('[Webhook] Paystack webhook error: ', error);
    res.status(500).send('Internal Webhook Error');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FezySlimes Secure Payment Backend running on port ${PORT}`);
});

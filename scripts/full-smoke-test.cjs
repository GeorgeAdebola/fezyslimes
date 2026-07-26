/**
 * Full smoke test — fezyslimes backend
 * Tests: login, image upload to Cloudinary, product creation,
 *        bank details settings, order placement (manual transfer),
 *        and payment confirmation.
 */
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5000';
const ADMIN_USER = 'admin_live_support@fezyslimes.com';
const ADMIN_PASS = 'DEcGS/QPYRXJ/8jh';

let token = '';
let createdProductId = '';
let createdOrderId = '';

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg, detail) { console.error(`  ❌ ${msg}`, detail || ''); process.exit(1); }
function section(msg) { console.log(`\n── ${msg} ──`); }

async function login() {
  section('1. Admin Login');
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
  });
  if (!res.ok) fail('Login failed', await res.text());
  const data = await res.json();
  token = data.token;
  pass(`Logged in. Token starts with: ${token.slice(0, 30)}...`);
}

async function testImageUpload() {
  section('2. Image Upload → Cloudinary');

  // Minimal valid 1x1 white PNG (67 bytes) — smallest real image Cloudinary accepts
  const pngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
    '890000000a49444154789c6260000000020001e221bc330000000049454e44ae' +
    '426082',
    'hex'
  );
  fs.writeFileSync('smoke-test-image.png', pngBuffer);

  const form = new FormData();
  form.append('image', fs.createReadStream('smoke-test-image.png'), { contentType: 'image/png' });

  const res = await fetch(`${BASE}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, ...form.getHeaders() },
    body: form
  });
  if (!res.ok) fail('Upload failed', await res.text());
  const data = await res.json();
  if (!data.url || !data.url.startsWith('https://res.cloudinary.com')) {
    fail('URL is not a Cloudinary URL', data.url);
  }
  pass(`Uploaded! Cloudinary URL: ${data.url}`);
  fs.unlinkSync('smoke-test-image.png');
  return data.url;
}

async function testCreateProduct(imageUrl) {
  section('3. Create Product');
  const res = await fetch(`${BASE}/api/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      name: `Smoke Test Slime ${Date.now()}`,
      description: 'Automated smoke test product',
      price: '3500',
      category: 'glossy',
      texture: 'stretchy',
      scent: 'vanilla',
      stock: '20',
      image: imageUrl
    })
  });
  if (!res.ok) fail('Product creation failed', await res.text());
  const data = await res.json();
  createdProductId = data.product?.id;
  pass(`Product created. ID: ${createdProductId}`);
}

async function testBankDetails() {
  section('4. Bank Details (Settings)');

  // Save bank details
  const saveRes = await fetch(`${BASE}/api/admin/settings/bank-details`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Fezy Slimes Ltd' })
  });
  if (!saveRes.ok) fail('Save bank details failed', await saveRes.text());
  pass('Bank details saved.');

  // Read back
  const readRes = await fetch(`${BASE}/api/bank-details`);
  if (!readRes.ok) fail('Read bank details failed', await readRes.text());
  const data = await readRes.json();
  if (data.bankName !== 'GTBank') fail('Bank details mismatch', JSON.stringify(data));
  pass(`Bank details confirmed: ${data.bankName} | ${data.accountNumber} | ${data.accountName}`);
}

async function testPlaceOrder() {
  section('5. Place Order (Manual Bank Transfer)');
  const res = await fetch(`${BASE}/api/place-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Test Customer',
      email: 'smoketest@fezyslimes.com',
      phone: '08012345678',
      address: '1 Test Street, Lagos',
      total: 5500,
      deliveryFee: 2000,
      items: [{ id: createdProductId || 'test-id', name: 'Smoke Test Slime', price: 3500, quantity: 1 }]
    })
  });
  if (!res.ok) fail('Place order failed', await res.text());
  const data = await res.json();
  if (!data.success || !data.orderId) fail('Unexpected place-order response', JSON.stringify(data));
  createdOrderId = data.orderId;
  pass(`Order placed. ID: ${data.orderId} | status: Awaiting Payment Confirmation (in Firestore)`);
}

async function testConfirmPayment() {
  section('6. Admin Confirm Payment');

  // First fetch orders to get the internal doc ID
  const ordersRes = await fetch(`${BASE}/api/admin/orders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!ordersRes.ok) fail('Fetch orders failed', await ordersRes.text());
  const orders = await ordersRes.json();
  const pending = orders.find(o => o.paymentStatus === 'Awaiting Payment Confirmation');
  if (!pending) fail('No pending order found to confirm');
  pass(`Found pending order: ${pending.orderId}`);

  const confirmRes = await fetch(`${BASE}/api/admin/orders/${pending.id}/confirm-payment`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!confirmRes.ok) fail('Confirm payment failed', await confirmRes.text());
  const data = await confirmRes.json();
  pass(`Payment confirmed. Response: ${JSON.stringify(data)}`);
}

async function cleanup() {
  section('7. Cleanup (Delete Test Product)');
  if (!createdProductId) { pass('No product to clean up.'); return; }
  const res = await fetch(`${BASE}/api/admin/products/${createdProductId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.ok) pass(`Deleted product ${createdProductId}`);
  else console.warn(`  ⚠️  Cleanup failed (non-critical): ${await res.text()}`);
}

async function run() {
  console.log('\n═══════════════════════════════════════════');
  console.log('   FezySlimes Full Smoke Test');
  console.log('═══════════════════════════════════════════');
  try {
    await login();
    const imageUrl = await testImageUpload();
    await testCreateProduct(imageUrl);
    await testBankDetails();
    await testPlaceOrder();
    await testConfirmPayment();
    await cleanup();

    console.log('\n═══════════════════════════════════════════');
    console.log('   ALL TESTS PASSED ✅ — Ready for launch!');
    console.log('═══════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n[FATAL]', err.message);
    process.exit(1);
  }
}

run();

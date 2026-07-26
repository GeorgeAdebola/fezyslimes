const fetch = require('node-fetch');

async function test() {
  try {
    console.log('Logging in to get JWT...');
    const loginRes = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin_live_support@fezyslimes.com', password: 'DEcGS/QPYRXJ/8jh' })
    });
    
    if (!loginRes.ok) throw new Error('Login failed: ' + await loginRes.text());
    
    const { token } = await loginRes.json();
    console.log('Token:', token);
    
    // Simulate frontend uploading image
    const FormData = require('form-data');
    const fs = require('fs');
    
    const form = new FormData();
    fs.writeFileSync('dummy.jpg', 'fake image content');
    form.append('image', fs.createReadStream('dummy.jpg'));
    
    console.log('Uploading dummy image to backend...');
    const uploadRes = await fetch('http://localhost:5000/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });
    
    if (!uploadRes.ok) throw new Error('Upload failed: ' + await uploadRes.text());
    
    const { url } = await uploadRes.json();
    console.log('Uploaded! URL:', url);
    
    console.log('Creating product...');
    const createRes = await fetch('http://localhost:5000/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test Manual Upload Slime',
        description: 'Testing multer upload',
        price: '2500',
        category: 'clear',
        texture: 'jelly',
        scent: 'grape',
        stock: '15',
        image: url
      })
    });
    
    if (!createRes.ok) throw new Error('Create failed: ' + await createRes.text());
    
    console.log('Product created:', await createRes.json());
  } catch (err) {
    console.error(err);
  }
}

test();

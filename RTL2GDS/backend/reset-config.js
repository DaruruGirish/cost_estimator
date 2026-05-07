/**
 * Script to reset configuration to defaults
 * This will update the database with the latest default-config.ts values
 * 
 * Usage: node reset-config.js
 * 
 * Note: Make sure the backend server is running and you have admin access
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/admin/reset',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Note: You'll need to add a valid JWT token here
    // Get it from the admin login
    'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Configuration reset successfully!');
      console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
    } else {
      console.error('❌ Failed to reset configuration');
      console.error('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();

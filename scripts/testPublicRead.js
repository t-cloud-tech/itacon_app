const https = require('https');

async function testPublicRead() {
  // Test reading from Firestore REST API without any auth token (public)
  const url = 'https://firestore.googleapis.com/v1/projects/itacon-app/databases/(default)/documents/products?pageSize=5';
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('HTTP Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          if (json.documents) {
            console.log('Successfully read public products! Count:', json.documents.length);
            console.log('First doc name:', json.documents[0].name);
          } else {
            console.log('Response body:', JSON.stringify(json, null, 2));
          }
        } catch (e) {
          console.log('Raw data:', data);
        }
        resolve();
      });
    }).on('error', (err) => {
      console.error('Fetch error:', err);
      resolve();
    });
  });
}

testPublicRead();

const key = 'AQ.Ab8RN6LKBRFMCfygB5mXTnPNPg9XGMplRdHDutJDoOrp1Ld-Qw';

const models = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest'
];

async function testModels() {
  for (const model of models) {
    console.log(`\nTesting ${model}...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with a simple hello' }] }]
        })
      });
      
      const status = response.status;
      const data = await response.json();
      
      console.log('Status:', status);
      if (status === 200) {
        console.log('SUCCESS with model:', model);
        console.log('Response:', JSON.stringify(data).substring(0, 200));
        return model;
      } else {
        console.log('Error:', data.error?.message || data.error?.status || data);
      }
    } catch (e) {
      console.log('Fetch exception:', e.message);
    }
  }
  
  console.log('\nAll tests finished.');
}

testModels();

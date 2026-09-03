const key = 'AQ.Ab8RN6KqzUcjxx0uzoZLXY1m9rC4swL8QbnM6lKvSDU78GA0Aw';
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'hello' }] }]
  })
})
.then(res => Promise.all([res.status, res.json()]))
.then(([status, data]) => console.log('Status:', status, 'Data:', JSON.stringify(data, null, 2)))
.catch(err => console.error(err));

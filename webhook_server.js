const express = require('express');
const { exec } = require('child_process');
const { scrapeDoctolib } = require('./scrapeDoctolib');
const app = express();
const PORT = 3000; // Portul intern al containerului

// Middleware pentru a parsa JSON
app.use(express.json());

app.post('/run-scrape', (req, res) => {
  console.log(`[${new Date().toISOString()}] Webhook primit. Se pornește scriptul de scraping...`);

  // Extrage parametrii din request body
  const { email, password, number } = req.body;

  // Validează parametrii obligatorii
  if (!email || !password || !number) {
    return res.status(400).send({ 
      error: 'Parametrii obligatorii lipsesc. Sunt necesari: email, password, number' 
    });
  }

  // Rulează scriptul de scraping cu parametrii
  scrapeDoctolib(email, password, number)
    .then(() => {
      console.log('✅ Scraping process finished successfully');
    })
    .catch((error) => {
      console.error('❌ Scraping process failed:', error);
    });

  res.status(202).send({ message: 'Procesul de scraping a fost acceptat și a început.' });
});

app.get('/health', (req, res) => {
    res.status(200).send({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Serverul pentru webhook ascultă pe portul ${PORT}`);
});
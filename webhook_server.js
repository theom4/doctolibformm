const express = require('express');
const { exec } = require('child_process');
const app = express();
const PORT = 3000; // Portul intern al containerului

app.post('/run-scrape', (req, res) => {
  console.log(`[${new Date().toISOString()}] Webhook primit. Se pornește scriptul de scraping...`);

  exec('node scrapeDoctolib.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`[ERROR] Eroare la execuția scriptului: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`[STDERR] ${stderr}`);
      return;
    }
    console.log(`[STDOUT] Output-ul scriptului:\n${stdout}`);
  });

  res.status(202).send({ message: 'Procesul de scraping a fost acceptat și a început.' });
});

app.get('/health', (req, res) => {
    res.status(200).send({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Serverul pentru webhook ascultă pe portul ${PORT}`);
});
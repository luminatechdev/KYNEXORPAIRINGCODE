// index.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import events from 'events';
import pairRoute from './pair.js';
import validateRoute from './validate.js';
import adminRoute from './admin.js';
import { download } from './github.js'; // 👈 for session download

const app = express();
const PORT = process.env.PORT || 8000;
events.EventEmitter.defaultMaxListeners = 500;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/code', pairRoute);

//admin route 
app.use('/admin', adminRoute);

//validate
app.use('/validate', validateRoute);

// HTML pages
app.get('/pair', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/pair.html'))
);

app.get('/validate', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/validate.html'))
);

app.get('/admin', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/admin.html'))
);

app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, 'public/home.html'))
);

// Download session from GitHub via /download/:id
app.get('/download/:id', async (req, res) => {
  try {
    const data = await download(req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (e) {
    console.error("❌ Download error:", e.message);
    res.status(404).send({ error: 'Session not found or access denied.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

export default app;

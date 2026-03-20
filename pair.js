// pair.js
import express from 'express';
import fs from 'fs-extra';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

import { upload } from './github.js';

const router = express.Router();
const AUTH_DIR = './auth_info_pair';

const MESSAGE = `*YOU HAVE SUCCESSFULLY CONNECTED TO ONE OF KYNEXORTECHNOLOGIES's PROJECTS.* 👑🖤

> 🔴 ⚠️ *THAT IS THE SESSION ID ABOVE 👆!* ⚠️

*🌐 Use this to contact owner:*
➡️ https://wa.me/27751014718

*How to deploy?:*
(_link unavailable_)

🚀 *Deployment Guides Available For:* Panel | Heroku | Render | Koyeb
BOT LINK: (_link unavailable_)

🛠️ *Troubleshooting:*  
❌ Bot connected but not responding?  
Log out → Pair again → Redeploy ✅

📞 *Need help?*  
Contact KynexorTechnologies Team: +27731881979`;

function generateSessionId(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function waitForFile(filePath, timeout = 15000) {
  const start = Date.now();
  while (!fs.existsSync(filePath)) {
    if (Date.now() - start > timeout) throw new Error('creds.json not found within timeout');
    await delay(300);
  }
}

// Normalize to E.164 digits only (no +, no leading 0)
function normalizeNumber(raw) {
  if (!raw) return null;
  let number = raw.trim().replace(/[\s\-().]/g, '');
  if (number.startsWith('+')) number = number.slice(1);
  if (number.startsWith('0')) number = number.slice(1);
  if (!/^\d{7,15}$/.test(number)) return null;
  return number;
}

router.get('/', async (req, res) => {
  const raw = req.query.number;
  const number = normalizeNumber(raw);

  if (!number || number.length < 10) {
    return res.status(400).send({
      error: 'Invalid phone number. Include your country code e.g. 27751014718'
    });
  }

  try {
    if (fs.existsSync(AUTH_DIR)) fs.emptyDirSync(AUTH_DIR);
  } catch (_) {}

  async function launchSocket() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const logger = pino({ level: 'silent' });

    // ✅ Always fetch the latest WA version — avoids version mismatch rejections
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      logger,
      printQRInTerminal: false,
      // ✅ Use a known browser config — custom strings can trigger WA rejections
      browser: Browsers.macOS('Chrome'),
      // ✅ Recommended for pairing code flow
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    // ✅ Request pairing code only when not registered
    if (!sock.authState.creds.registered) {
      await delay(2000);
      try {
        // ✅ requestPairingCode expects a plain digits string — verified E.164
        const code = await sock.requestPairingCode(number);
        console.log(`✅ Pairing code for ${number}: ${code}`);
        if (!res.headersSent) res.send({ code });
      } catch (e) {
        console.error('❌ requestPairingCode error:', e?.message || e);
        if (!res.headersSent) {
          res.status(500).send({ error: 'Failed to generate pairing code. Check the number and try again.' });
        }
      }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log('✅ WhatsApp connected!');
        try {
          await delay(5000);

          const user = sock.user.id.split(':')[0] + '@s.whatsapp.net';
          const sessionId = generateSessionId();
          const credsPath = `${AUTH_DIR}/creds.json`;

          await waitForFile(credsPath);

          await upload(fs.createReadStream(credsPath), `${sessionId}.json`);
          const sessionCode = `KYNEXOR-TECHNOLOGIES=${sessionId}`;

          const msg = await sock.sendMessage(user, { text: sessionCode });
          await sock.sendMessage(user, { text: MESSAGE }, { quoted: msg });

          await sock.groupAcceptInvite('LmZlDca8zur8gSyLnVDRDA').catch(() => {});
          await sock.newsletterFollow('120363403987497624@newsletter').catch(() => {});

          await delay(1000);
          if (fs.existsSync(AUTH_DIR)) fs.emptyDirSync(AUTH_DIR);
        } catch (err) {
          console.error('❌ Error during session save/send:', err);
        }
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        console.log('⚠️ Disconnected, reason:', reason);

        if (reason === DisconnectReason.restartRequired) {
          console.log('♻️ Restarting socket...');
          launchSocket().catch(console.error);
        } else {
          await delay(2000);
          if (fs.existsSync(AUTH_DIR)) fs.emptyDirSync(AUTH_DIR);
        }
      }
    });
  }

  launchSocket().catch((err) => {
    console.error('❌ launchSocket error:', err);
    if (!res.headersSent) res.status(500).send({ error: 'Socket failed to start.' });
  });
});

export default router;
      

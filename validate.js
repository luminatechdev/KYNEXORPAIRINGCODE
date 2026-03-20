// validate.js
import express from 'express';
import fs from 'fs-extra';
import { download } from './github.js';

const router = express.Router();
const TEMP_DIR = './temp_validate';

router.get('/:id', async (req, res) => {
  const sessionId = req.params.id;
  const tempFile = `${TEMP_DIR}/creds.json`;

  try {
    await fs.ensureDir(TEMP_DIR);
    await fs.emptyDir(TEMP_DIR);

    const sessionData = await download(sessionId);
    await fs.writeJson(tempFile, sessionData);

    const data = await fs.readJson(tempFile);
    const creds = data?.creds || data; // ✅ fallback if creds not wrapped

    const hasValidKey =
      creds?.myAppStateKeyId &&
      typeof creds.myAppStateKeyId === 'string' &&
      creds.myAppStateKeyId.length > 3;

    const phone = creds?.me?.id?.split('@')[0];

    await fs.remove(tempFile);

    if (!hasValidKey || !phone) {
      throw new Error('Session is incomplete');
    }

    return res.send({
      status: 'valid',
      phone,
      message: '✅ Session is valid and contains credentials.'
    });

  } catch (err) {
    console.error('❌ Validation failed:', err.message);
    await fs.remove(tempFile);

    return res.status(400).send({
      status: 'invalid',
      message: '❌ Invalid or incomplete session. Please disconnect and pair again.'
    });
  }
});

export default router;

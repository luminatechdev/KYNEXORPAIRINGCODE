//admin.js
import express from 'express';
import axios from 'axios';
import { download } from './github.js';

const router = express.Router();

// ENV config
const GITHUB_TOKEN = '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';
const REPO_OWNER = 'jadewale71-ctrl';
const REPO_NAME = 'Sessionid';
const BRANCH = 'main';
const SESSION_PATH = 'session';

// Set your admin password
const ADMIN_PASSWORD = 'admin-password';

// ✅ Admin login endpoint
router.post('/admin-auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) return res.sendStatus(200);
  res.status(403).send({ error: 'Invalid password' });
});

// ✅ Password middleware for all admin routes after this
router.use((req, res, next) => {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) {
    return res.status(403).send({ error: 'Unauthorized. Wrong admin password.' });
  }
  next();
});

// ✅ Get list of session files
router.get('/sessions', async (req, res) => {
  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SESSION_PATH}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'XyloAdmin'
        }
      }
    );

    const sessions = data
      .filter(file => file.name.endsWith('.json'))
      .map(file => ({
        id: file.name.replace('.json', ''),
        name: file.name
      }));

    res.send(sessions);
  } catch (err) {
    res.status(500).send({ error: 'Failed to fetch session list.' });
  }
});

// ✅ View session content
router.get('/view/:id', async (req, res) => {
  try {
    const data = await download(req.params.id);
    res.send({ status: 'success', data });
  } catch (err) {
    res.status(404).send({ error: 'Session not found.' });
  }
});

// ✅ Delete session
router.delete('/delete/:id', async (req, res) => {
  const sessionFile = `${SESSION_PATH}/${req.params.id}.json`;

  try {
    // Step 1: Get file SHA
    const { data } = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${sessionFile}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'XyloAdmin'
        }
      }
    );

    const sha = data.sha;

    // Step 2: Delete file
    await axios.delete(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${sessionFile}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'XyloAdmin'
        },
        data: {
          message: `Delete session: ${req.params.id}`,
          sha,
          branch: BRANCH
        }
      }
    );

    res.send({ status: 'deleted', session: req.params.id });
  } catch (err) {
    res.status(500).send({ error: 'Failed to delete session.' });
  }
});

// ✅ Edit/update session (frontend-compatible PUT)
router.put('/session/:id', async (req, res) => {
  const sessionFile = `${SESSION_PATH}/${req.params.id}.json`;
  const newContent = Buffer.from(req.body.content).toString('base64');

  try {
    const { data } = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${sessionFile}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'XyloAdmin'
        }
      }
    );

    const sha = data.sha;

    await axios.put(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${sessionFile}`,
      {
        message: `Edit session: ${req.params.id}`,
        content: newContent,
        branch: BRANCH,
        sha
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'XyloAdmin'
        }
      }
    );

    res.send({ status: 'updated', session: req.params.id });
  } catch (err) {
    res.status(500).send({ error: 'Failed to update session.' });
  }
});

export default router;

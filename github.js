// github.js
import fs from 'fs';
import axios from 'axios';

const GITHUB_TOKEN = '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';
const REPO_OWNER = 'cadillaccylee021';
const REPO_NAME = 'KYNEXOR-PAIRING-CODE';
const BRANCH = 'main';
const SESSION_PATH = 'session';    // subfolder in repo

// 🔼 Upload session to GitHub private repo
export const upload = async (stream, filename) => {
  const content = await streamToBase64(stream);

  const { status, data } = await axios.put(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SESSION_PATH}/${filename}`,
    {
      message: `Upload session: ${filename}`,
      content,
      branch: BRANCH
    },
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'SessionUploader'
      }
    }
  );

  if (status !== 201 && status !== 200)
    throw new Error('Upload failed');

  // Return a secure loader code (not public URL)
  return `GITHUB-S*B=${filename.replace('.json', '')}`;
};

// 🔽 Download session file from GitHub private repo
export const download = async (id) => {
  const fileUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SESSION_PATH}/${id}.json`;

  const { data } = await axios.get(fileUrl, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'SessionDownloader',
      Accept: 'application/vnd.github.v3.raw'
    }
  });

  return data; // parsed JSON
};

function streamToBase64(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    stream.on('error', reject);
  });
}

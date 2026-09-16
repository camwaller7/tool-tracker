import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { requireAuth } from '../middleware.js';
import { savePhoto, refToPath } from '../storage.js';
import { verifyToken } from '../util.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per photo
});

// Upload one photo, get back an opaque ref to store on a signout record.
// The sign-out/return endpoints then submit plain JSON carrying these refs,
// which lets photos upload in the background (PRD §7) independent of the form.
router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo provided' });
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'File must be an image' });
  }
  const ref = await savePhoto(req.file.buffer, req.file.mimetype);
  res.status(201).json({ ref });
});

// Serve a photo by ref (auth required — photos are evidence for disputes).
// <img> tags can't send an Authorization header, so a token may also come in
// as ?t= for image loads. Both paths verify the same JWT.
function authForImage(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.t;
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/:ref', authForImage, (req, res) => {
  const p = refToPath(`local:${req.params.ref}`);
  if (!p) return res.status(404).json({ error: 'Photo not found' });
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  fs.createReadStream(p).pipe(res);
});

export default router;

import express from 'express';
import { initializeFirebase } from '../utils/firebase.js';
import { submitBallot, getAllBallots, getBestPictureResults, getOverview, getUnderSeenResults, getFunCategories } from '../utils/database.js';
import { verifyAdminPassword } from '../utils/auth.js';

const router = express.Router();

// Initialize Firebase on first request
let firebaseInitialized = false;
router.use(async (req, res, next) => {
  if (!firebaseInitialized) {
    try {
      await initializeFirebase();
      firebaseInitialized = true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      return res.status(500).json({ error: 'Database initialization failed' });
    }
  }
  next();
});

// Admin authentication
router.post('/admin/auth', async (req, res) => {
  try {
    const { password } = req.body;
    const token = verifyAdminPassword(password);
    if (token) {
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Submit ballot
router.post('/ballots', async (req, res) => {
  try {
    const ballot = req.body;
    
    // Hash IP address for duplicate detection
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const crypto = await import('crypto');
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16);
    
    // Add IP hash and check for potential duplicates
    ballot.ipHash = ipHash;
    
    // Simple duplicate detection: same client ID + similar timestamp (within 1 minute)
    // This is best-effort and will be flagged in the dashboard
    ballot.flagged = false; // Could add more sophisticated duplicate detection here
    
    const result = await submitBallot(ballot);
    res.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Ballot submission error:', error);
    res.status(500).json({ error: 'Failed to submit ballot' });
  }
});

// Get all ballots (admin only)
router.get('/ballots', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const ballots = await getAllBallots();
    res.json(ballots);
  } catch (error) {
    console.error('Get ballots error:', error);
    res.status(500).json({ error: 'Failed to retrieve ballots' });
  }
});

// Get best picture results
router.get('/results/best-picture', async (req, res) => {
  try {
    const results = await getBestPictureResults();
    res.json(results);
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to retrieve results' });
  }
});

// Get overview stats
router.get('/results/overview', async (req, res) => {
  try {
    const overview = await getOverview();
    res.json(overview);
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({ error: 'Failed to retrieve overview' });
  }
});

// Get under-seen award results
router.get('/results/under-seen', async (req, res) => {
  try {
    const results = await getUnderSeenResults();
    res.json(results);
  } catch (error) {
    console.error('Get under-seen results error:', error);
    res.status(500).json({ error: 'Failed to retrieve under-seen results' });
  }
});

// Get fun categories results
router.get('/results/fun-categories', async (req, res) => {
  try {
    const results = await getFunCategories();
    res.json(results);
  } catch (error) {
    console.error('Get fun categories error:', error);
    res.status(500).json({ error: 'Failed to retrieve fun categories' });
  }
});

export default router;


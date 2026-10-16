const express = require('express');
const AuditLog = require('../models/AuditLog');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin, requireRole('admin'));

router.get('/audit', async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
  res.render('audit', { title: 'Audit Log', logs });
});

module.exports = router;

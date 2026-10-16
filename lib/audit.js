const AuditLog = require('../models/AuditLog');

// Saves an audit record. It never throws, so a logging problem cannot block the admin's work.
async function logAudit(req, { action, entity, entityId, label, before, after }) {
  try {
    await AuditLog.create({
      action, entity, entityId, label, before, after,
      by: req.session.user.id,
      byName: req.session.user.fullName
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

module.exports = { logAudit };

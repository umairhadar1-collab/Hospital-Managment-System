const mongoose = require('mongoose');

// One line per admin edit or delete. Matches lib/audit.js (logAudit).
// before / after hold plain copies of the record, so a deleted record can still be seen here.
const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },   // 'update' or 'delete'
  entity: { type: String, required: true },   // 'patient', 'labOrder', 'labTest'
  entityId: { type: String },
  label: { type: String, default: '' },       // e.g. "MR-000001 Umair Haider"
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);

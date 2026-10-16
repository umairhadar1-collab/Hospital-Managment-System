const mongoose = require('mongoose');

// Name and price are copied into the order, so old orders keep their
// original price even if the catalog price changes later.
const orderItemSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true }
}, { _id: false });

const labOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  items: { type: [orderItemSchema], validate: v => v.length > 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LabOrder', labOrderSchema);

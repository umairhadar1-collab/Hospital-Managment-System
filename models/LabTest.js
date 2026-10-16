const mongoose = require('mongoose');

// Catalog of tests the lab offers (name, price). Admin can edit prices.
const labTestSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  category: { type: String, trim: true, default: 'General' },
  price: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LabTest', labTestSchema);

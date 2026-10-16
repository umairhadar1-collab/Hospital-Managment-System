const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  mrNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  fatherOrHusbandName: { type: String, trim: true, default: '' },
  age: { type: Number, required: true, min: 0, max: 120 },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  phone: { type: String, required: true, trim: true },
  cnic: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  department: { type: String, trim: true, default: 'General OPD' },
  doctor: { type: String, trim: true, default: '' },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);

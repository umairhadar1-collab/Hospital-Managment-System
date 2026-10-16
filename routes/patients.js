const express = require('express');
const Patient = require('../models/Patient');
const LabOrder = require('../models/LabOrder');
const { nextSequence } = require('../models/Counter');
const { requireLogin, requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();
router.use(requireLogin);

const GENDERS = ['Male', 'Female', 'Other'];
const FIELDS = ['name', 'fatherOrHusbandName', 'age', 'gender', 'phone', 'cnic', 'address', 'department', 'doctor'];
const isId = id => /^[a-f0-9]{24}$/i.test(String(id));

function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Reads and checks the patient form (used for both new and edit).
function readForm(body) {
  const form = {
    name: clean(body.name),
    fatherOrHusbandName: clean(body.fatherOrHusbandName),
    age: clean(body.age, 3),
    gender: clean(body.gender, 10),
    phone: clean(body.phone, 20),
    cnic: clean(body.cnic, 20),
    address: clean(body.address, 300),
    department: clean(body.department) || 'General OPD',
    doctor: clean(body.doctor)
  };

  const errors = [];
  const age = Number(form.age);
  if (!form.name) errors.push('Patient name is required.');
  if (form.age === '' || !Number.isInteger(age) || age < 0 || age > 120) errors.push('Age must be a whole number from 0 to 120.');
  if (!GENDERS.includes(form.gender)) errors.push('Please select a gender.');
  if (!/^[0-9+\-\s]{7,20}$/.test(form.phone)) errors.push('Enter a valid phone number.');

  return { form, errors, age };
}

function editView(patient, errors, form) {
  return {
    title: 'Edit Patient',
    errors,
    form,
    heading: 'Edit Patient',
    mrNumber: patient.mrNumber,
    action: '/patients/' + patient._id + '/edit',
    submitLabel: 'Save Changes',
    cancelUrl: '/patients/' + patient._id + '/slip'
  };
}

// Registration form
router.get('/new', (req, res) => {
  res.render('register', { title: 'Register Patient', errors: [], form: {} });
});

// Save patient, then show the print slip
router.post('/', async (req, res) => {
  const { form, errors, age } = readForm(req.body);

  if (errors.length) {
    return res.status(400).render('register', { title: 'Register Patient', errors, form });
  }

  try {
    const seq = await nextSequence('mrNumber');
    const mrNumber = 'MR-' + String(seq).padStart(6, '0');
    const patient = await Patient.create({
      ...form,
      age,
      mrNumber,
      registeredBy: req.session.user.id
    });
    res.redirect('/patients/' + patient._id + '/slip');
  } catch (e) {
    console.error(e);
    res.status(500).render('register', { title: 'Register Patient', errors: ['Could not save the patient. Please try again.'], form });
  }
});

// Recent registrations, or search by name / MR number / phone
router.get('/', async (req, res) => {
  const q = clean(req.query.q, 100);
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { mrNumber: rx }, { phone: rx }];
  }
  const patients = await Patient.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.render('list', { title: q ? 'Search Patients' : 'Recent Patients', patients, q });
});

// Print slip
router.get('/:id/slip', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Patient not found');
  const patient = await Patient.findById(req.params.id).populate('registeredBy', 'fullName').lean();
  if (!patient) return res.status(404).send('Patient not found');
  res.render('slip', { title: 'Patient Slip ' + patient.mrNumber, patient });
});

// ---------- Admin only: edit ----------
router.get('/:id/edit', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Patient not found');
  const patient = await Patient.findById(req.params.id).lean();
  if (!patient) return res.status(404).send('Patient not found');

  const form = {};
  FIELDS.forEach(f => { form[f] = patient[f] === undefined || patient[f] === null ? '' : String(patient[f]); });
  res.render('register', editView(patient, [], form));
});

router.post('/:id/edit', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Patient not found');
  const patient = await Patient.findById(req.params.id).lean();
  if (!patient) return res.status(404).send('Patient not found');

  const { form, errors, age } = readForm(req.body);
  if (errors.length) return res.status(400).render('register', editView(patient, errors, form));

  const updates = { ...form, age };
  const before = {};
  const after = {};
  FIELDS.forEach(f => {
    const oldValue = patient[f] === undefined || patient[f] === null ? '' : String(patient[f]);
    const newValue = String(updates[f]);
    if (oldValue !== newValue) { before[f] = oldValue; after[f] = newValue; }
  });

  try {
    if (Object.keys(after).length) {
      await Patient.updateOne({ _id: patient._id }, updates);
      await logAudit(req, {
        action: 'update', entity: 'patient', entityId: String(patient._id),
        label: patient.mrNumber + ' ' + (updates.name || patient.name), before, after
      });
    }
    res.redirect('/patients/' + patient._id + '/slip');
  } catch (e) {
    console.error(e);
    res.status(500).render('register', editView(patient, ['Could not save the changes. Please try again.'], form));
  }
});

// ---------- Admin only: delete ----------
// The browser asks "are you sure?" first (data-confirm on the button).
// A patient who still has lab orders is not deleted: delete those orders first.
router.post('/:id/delete', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Patient not found');
  const patient = await Patient.findById(req.params.id).lean();
  if (!patient) return res.status(404).send('Patient not found');

  try {
    const orderCount = await LabOrder.countDocuments({ patient: patient._id });
    if (orderCount) {
      const patients = await Patient.find().sort({ createdAt: -1 }).limit(50).lean();
      return res.status(409).render('list', {
        title: 'Recent Patients',
        patients,
        q: '',
        error: 'Cannot delete ' + patient.name + ' (' + patient.mrNumber + '): this patient has ' + orderCount +
          ' lab order(s). Delete the lab order(s) first (Lab Orders page), then delete the patient.'
      });
    }

    // Save a copy in the audit log first, then delete.
    await logAudit(req, {
      action: 'delete', entity: 'patient', entityId: String(patient._id),
      label: patient.mrNumber + ' ' + patient.name,
      before: {
        mrNumber: patient.mrNumber, name: patient.name, fatherOrHusbandName: patient.fatherOrHusbandName,
        age: patient.age, gender: patient.gender, phone: patient.phone, cnic: patient.cnic,
        address: patient.address, department: patient.department, doctor: patient.doctor
      }
    });
    await Patient.deleteOne({ _id: patient._id });
    res.redirect('/patients');
  } catch (e) {
    console.error(e);
    res.status(500).send('Could not delete the patient. Please try again.');
  }
});

module.exports = router;

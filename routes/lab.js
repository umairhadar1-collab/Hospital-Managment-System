const express = require('express');
const Patient = require('../models/Patient');
const LabTest = require('../models/LabTest');
const LabOrder = require('../models/LabOrder');
const { nextSequence } = require('../models/Counter');
const { requireLogin, requireRole } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();
router.use(requireLogin);

const isId = id => /^[a-f0-9]{24}$/i.test(String(id));

// ---------- Find a patient by MR number, then order tests ----------
router.get('/new', async (req, res) => {
  const mr = String(req.query.mr || '').trim().toUpperCase();
  if (!mr) return res.render('lab_find', { title: 'New Lab Order', error: null, mr: '' });

  const patient = await Patient.findOne({ mrNumber: mr }).lean();
  if (!patient) {
    return res.status(404).render('lab_find', { title: 'New Lab Order', error: 'No patient found with MR number ' + mr + '.', mr });
  }
  res.redirect('/lab/new/' + patient._id);
});

// ---------- Choose tests for a patient ----------
router.get('/new/:patientId', async (req, res) => {
  if (!isId(req.params.patientId)) return res.status(404).send('Patient not found');
  const patient = await Patient.findById(req.params.patientId).lean();
  if (!patient) return res.status(404).send('Patient not found');

  const tests = await LabTest.find({ active: true }).sort({ category: 1, name: 1 }).lean();
  const groups = {};
  tests.forEach(t => { (groups[t.category] = groups[t.category] || []).push(t); });
  res.render('lab_order', { title: 'Lab Tests', patient, groups, hasTests: tests.length > 0, error: null });
});

// ---------- Save order, then show the lab slip ----------
router.post('/orders', async (req, res) => {
  const { patientId } = req.body;
  if (!isId(patientId)) return res.status(400).send('Invalid patient');

  const patient = await Patient.findById(patientId).lean();
  if (!patient) return res.status(404).send('Patient not found');

  const ids = [].concat(req.body.tests || []).filter(isId);
  const tests = ids.length ? await LabTest.find({ _id: { $in: ids }, active: true }).lean() : [];

  if (!tests.length) {
    const all = await LabTest.find({ active: true }).sort({ category: 1, name: 1 }).lean();
    const groups = {};
    all.forEach(t => { (groups[t.category] = groups[t.category] || []).push(t); });
    return res.status(400).render('lab_order', {
      title: 'Lab Tests', patient, groups, hasTests: all.length > 0, error: 'Please select at least one test.'
    });
  }

  try {
    const items = tests.map(t => ({ test: t._id, name: t.name, price: t.price }));
    const total = items.reduce((sum, i) => sum + i.price, 0);
    const seq = await nextSequence('labOrder');
    const order = await LabOrder.create({
      orderNumber: 'LAB-' + String(seq).padStart(6, '0'),
      patient: patient._id,
      items,
      total,
      createdBy: req.session.user.id
    });
    res.redirect('/lab/orders/' + order._id + '/slip');
  } catch (e) {
    console.error(e);
    res.status(500).send('Could not save the lab order. Please go back and try again.');
  }
});

// ---------- Lab slip (print) ----------
router.get('/orders/:id/slip', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Order not found');
  const order = await LabOrder.findById(req.params.id)
    .populate('patient')
    .populate('createdBy', 'fullName')
    .lean();
  if (!order) return res.status(404).send('Order not found');
  res.render('lab_slip', { title: 'Lab Slip ' + order.orderNumber, order });
});

// ---------- Recent lab orders ----------
router.get('/', async (req, res) => {
  const orders = await LabOrder.find().sort({ createdAt: -1 }).limit(50).populate('patient', 'name mrNumber').lean();
  res.render('lab_list', { title: 'Lab Orders', orders });
});

// ---------- Test catalog (everyone can view, admin can edit) ----------
router.get('/tests', async (req, res) => {
  const tests = await LabTest.find().sort({ category: 1, name: 1 }).lean();
  res.render('lab_tests', { title: 'Lab Tests', tests, error: null });
});

router.post('/tests', requireRole('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 200);
  const category = String(req.body.category || '').trim().slice(0, 100) || 'General';
  const price = Number(req.body.price);

  try {
    if (!name || !Number.isFinite(price) || price < 0) throw new Error('Enter a test name and a valid price.');
    await LabTest.create({ name, category, price });
    res.redirect('/lab/tests');
  } catch (e) {
    const tests = await LabTest.find().sort({ category: 1, name: 1 }).lean();
    const error = e.code === 11000 ? 'A test with this name already exists.' : e.message;
    res.status(400).render('lab_tests', { title: 'Lab Tests', tests, error });
  }
});

router.post('/tests/:id', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Test not found');
  const price = Number(req.body.price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).send('Invalid price');
  const test = await LabTest.findById(req.params.id).lean();
  if (!test) return res.status(404).send('Test not found');
  const active = req.body.active === 'on';
  if (test.price !== price || test.active !== active) {
    await LabTest.updateOne({ _id: test._id }, { price, active });
    await logAudit(req, {
      action: 'update', entity: 'labTest', entityId: String(test._id), label: test.name,
      before: { price: test.price, active: test.active },
      after: { price, active }
    });
  }
  res.redirect('/lab/tests');
});

// ---------- Admin only: edit the tests of a lab order ----------
// Tests already in the order keep their saved price. Newly added tests use today's catalog price.
async function editViewData(order, selected) {
  const catalog = await LabTest.find().sort({ category: 1, name: 1 }).lean();
  const saved = {};
  order.items.forEach(i => { saved[String(i.test)] = i; });
  const seen = new Set();
  const groups = {};

  catalog.forEach(t => {
    const id = String(t._id);
    seen.add(id);
    if (!t.active && !(id in saved)) return;           // hide switched-off tests unless already in the order
    const price = id in saved ? saved[id].price : t.price;
    (groups[t.category] = groups[t.category] || []).push({ _id: t._id, name: t.name, price });
  });

  // Tests that were deleted from the catalog after this order was made
  order.items.forEach(i => {
    if (seen.has(String(i.test))) return;
    (groups['Removed from catalog'] = groups['Removed from catalog'] || []).push({ _id: i.test, name: i.name, price: i.price });
  });

  return {
    title: 'Edit Lab Order',
    patient: order.patient,
    groups,
    hasTests: true,
    heading: 'Edit Lab Order ' + order.orderNumber,
    action: '/lab/orders/' + order._id + '/edit',
    submitLabel: 'Save Changes',
    cancelUrl: '/lab/orders/' + order._id + '/slip',
    selected
  };
}

router.get('/orders/:id/edit', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Order not found');
  const order = await LabOrder.findById(req.params.id).populate('patient').lean();
  if (!order) return res.status(404).send('Order not found');
  const selected = order.items.map(i => String(i.test));
  res.render('lab_order', { ...(await editViewData(order, selected)), error: null });
});

router.post('/orders/:id/edit', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Order not found');
  const order = await LabOrder.findById(req.params.id).populate('patient').lean();
  if (!order) return res.status(404).send('Order not found');

  const ids = [...new Set([].concat(req.body.tests || []).filter(isId).map(String))];
  const existing = new Map(order.items.map(i => [String(i.test), i]));
  const newIds = ids.filter(id => !existing.has(id));
  const fresh = newIds.length ? await LabTest.find({ _id: { $in: newIds }, active: true }).lean() : [];
  const freshMap = new Map(fresh.map(t => [String(t._id), t]));

  const items = [];
  ids.forEach(id => {
    if (existing.has(id)) {
      const i = existing.get(id);
      items.push({ test: i.test, name: i.name, price: i.price });
    } else if (freshMap.has(id)) {
      const t = freshMap.get(id);
      items.push({ test: t._id, name: t.name, price: t.price });
    }
  });

  if (!items.length) {
    return res.status(400).render('lab_order', {
      ...(await editViewData(order, ids)),
      error: 'Please select at least one test. To remove the whole order, use Delete on the Lab Orders page.'
    });
  }

  const total = items.reduce((sum, i) => sum + i.price, 0);
  try {
    await LabOrder.updateOne({ _id: order._id }, { items, total });
    await logAudit(req, {
      action: 'update', entity: 'labOrder', entityId: String(order._id),
      label: order.orderNumber + ' (' + order.patient.mrNumber + ' ' + order.patient.name + ')',
      before: { items: order.items.map(i => ({ name: i.name, price: i.price })), total: order.total },
      after: { items: items.map(i => ({ name: i.name, price: i.price })), total }
    });
    res.redirect('/lab/orders/' + order._id + '/slip');
  } catch (e) {
    console.error(e);
    res.status(500).send('Could not save the changes. Please go back and try again.');
  }
});

// ---------- Admin only: delete a lab order ----------
router.post('/orders/:id/delete', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Order not found');
  const order = await LabOrder.findById(req.params.id).populate('patient', 'name mrNumber').lean();
  if (!order) return res.status(404).send('Order not found');

  try {
    await logAudit(req, {
      action: 'delete', entity: 'labOrder', entityId: String(order._id),
      label: order.orderNumber + (order.patient ? ' (' + order.patient.mrNumber + ' ' + order.patient.name + ')' : ''),
      before: {
        orderNumber: order.orderNumber,
        items: order.items.map(i => ({ name: i.name, price: i.price })),
        total: order.total,
        status: order.status
      }
    });
    await LabOrder.deleteOne({ _id: order._id });
    res.redirect('/lab');
  } catch (e) {
    console.error(e);
    res.status(500).send('Could not delete the lab order. Please try again.');
  }
});

// ---------- Admin only: delete a test from the catalog ----------
// Old orders are not affected: they keep their own copy of the test name and price.
router.post('/tests/:id/delete', requireRole('admin'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).send('Test not found');
  const test = await LabTest.findById(req.params.id).lean();
  if (!test) return res.status(404).send('Test not found');

  await logAudit(req, {
    action: 'delete', entity: 'labTest', entityId: String(test._id),
    label: test.name,
    before: { name: test.name, category: test.category, price: test.price, active: test.active }
  });
  await LabTest.deleteOne({ _id: test._id });
  res.redirect('/lab/tests');
});

module.exports = router;

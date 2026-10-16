// Usage: npm run seed-tests
// Adds a starter list of common lab tests. Safe to run again: existing tests are not changed.
// Prices are EXAMPLES only (PKR). Change them here or on the Lab Tests page (admin).
require('dotenv').config();
const mongoose = require('mongoose');
const LabTest = require('../models/LabTest');

const tests = [
  { name: 'CBC (Complete Blood Count)', category: 'Hematology', price: 500 },
  { name: 'Hemoglobin (HB)', category: 'Hematology', price: 200 },
  { name: 'ESR', category: 'Hematology', price: 200 },
  { name: 'Blood Group', category: 'Hematology', price: 200 },
  { name: 'Blood Sugar Random', category: 'Chemistry', price: 150 },
  { name: 'Blood Sugar Fasting', category: 'Chemistry', price: 150 },
  { name: 'HbA1c', category: 'Chemistry', price: 1200 },
  { name: 'Serum Creatinine', category: 'Chemistry', price: 300 },
  { name: 'Blood Urea', category: 'Chemistry', price: 300 },
  { name: 'Serum Electrolytes', category: 'Chemistry', price: 800 },
  { name: 'LFTs (Liver Function Tests)', category: 'Chemistry', price: 1000 },
  { name: 'Lipid Profile', category: 'Chemistry', price: 1200 },
  { name: 'Urine Complete Examination', category: 'Urine', price: 250 },
  { name: 'Hepatitis B Surface Antigen (HBsAg)', category: 'Serology', price: 600 },
  { name: 'Hepatitis C Antibody (Anti-HCV)', category: 'Serology', price: 800 },
  { name: 'Malaria Parasite (MP)', category: 'Parasitology', price: 300 },
  { name: 'Typhidot', category: 'Serology', price: 800 },
  { name: 'Pregnancy Test (Urine)', category: 'Urine', price: 200 }
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hms');
  let added = 0;
  for (const t of tests) {
    const res = await LabTest.updateOne({ name: t.name }, { $setOnInsert: t }, { upsert: true });
    if (res.upsertedCount) added++;
  }
  console.log(`Done. ${added} new test(s) added, ${tests.length - added} already existed.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

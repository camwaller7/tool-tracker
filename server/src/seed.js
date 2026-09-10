// Seeds the Port Lincoln sample dataset so the app opens showing real activity
// (mirrors PROTOTYPE-REFERENCE.md: 2 active jobs + 1 closed, 14 tools, 7 people
// including one employee in a supervised period). Idempotent-ish: wipes and
// re-seeds the core tables. Run with:  npm run seed
import db from './db.js';
import { savePhoto } from './storage.js';
import { newId, now, hashPin, daysFromNow } from './util.js';

const DEFAULT_PIN = '1234';

// A tiny placeholder image reused for every seeded photo (real photos come
// from the camera in the running app).
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR42mNkYPhfz0AEYBxVSF+F' +
    'jP///2egEDCOKqSvQsb///9TZgIAsBAJ8x0v4bkAAAAASUVORK5CYII=',
  'base64'
);
const seedPhoto = () => savePhoto(PLACEHOLDER_PNG, 'image/png');

console.log('Clearing existing data…');
for (const t of ['strike', 'registerEntry', 'notification', 'signout', 'job_supervisor', 'tool', 'job', 'person']) {
  db.prepare(`DELETE FROM ${t}`).run();
}

function addPerson(name, phone, roles, status = 'active') {
  const id = newId('person');
  db.prepare(
    `INSERT INTO person (id, name, phone, pinHash, isEmployee, isSupervisor, isAdmin, status, supervisedUntil, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, name, phone, hashPin(DEFAULT_PIN),
    roles.employee === false ? 0 : 1,
    roles.supervisor ? 1 : 0,
    roles.admin ? 1 : 0,
    status,
    status === 'supervised' ? daysFromNow(30) : null,
    now()
  );
  return id;
}

console.log('People…');
const cambell = addPerson('Cambell Waller', '0400000001', { supervisor: true, admin: true });
const dave = addPerson('Dave Nguyen', '0400000002', { supervisor: true });
const mia = addPerson('Mia Rossi', '0400000003', { supervisor: true });
const sam = addPerson('Sam Torres', '0400000004', {});
const jack = addPerson('Jack Reeves', '0400000005', {});
const ella = addPerson('Ella Brown', '0400000006', {});
const tom = addPerson('Tom Fletcher', '0400000007', {}, 'supervised'); // supervised period

function addJob(name, client, status, supervisorIds) {
  const id = newId('job');
  db.prepare('INSERT INTO job (id, name, client, status, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, client, status, now());
  for (const sid of supervisorIds) {
    db.prepare('INSERT INTO job_supervisor (jobId, supervisorId) VALUES (?, ?)').run(id, sid);
  }
  return id;
}

console.log('Jobs…');
const marina = addJob('Marina Berth Rebuild', 'Port Lincoln Marina', 'active', [cambell, dave]);
const kiosk = addJob('Foreshore Kiosk Fitout', 'City Council', 'active', [mia]);
addJob('Grain Shed Reroof', 'AgCo Storage', 'closed', [dave]); // closed job

function addTool(name, category, assetTag) {
  const id = newId('tool');
  db.prepare(
    `INSERT INTO tool (id, name, category, assetTag, status, createdAt) VALUES (?, ?, ?, ?, 'available', ?)`
  ).run(id, name, category, assetTag, now());
  return id;
}

console.log('Tools…');
const t = {
  drill: addTool('Makita Drill', 'power tool', 'PT-001'),
  impact: addTool('DeWalt Impact Driver', 'power tool', 'PT-002'),
  circsaw: addTool('Circular Saw', 'power tool', 'PT-003'),
  grinder: addTool('Angle Grinder', 'power tool', 'PT-004'),
  hammer: addTool('Claw Hammer', 'hand tool', 'HT-011'),
  tape: addTool('Tape Measure', 'hand tool', 'HT-012'),
  level: addTool('Spirit Level', 'hand tool', 'HT-013'),
  ladder: addTool('Aluminium Ladder 2.4m', 'access', 'AC-021'),
  trestle: addTool('Trestle Pair', 'access', 'AC-022'),
  laser: addTool('Laser Level', 'measuring', 'ME-031'),
  station: addTool('Total Station', 'measuring', 'ME-032'),
  gen: addTool('Honda 2kVA Generator', 'generator', 'GEN-041'),
  lead: addTool('Extension Lead 20m', 'other', 'OT-051'),
  firstaid: addTool('First Aid Kit', 'other', 'OT-052'),
};

// --- Activity ------------------------------------------------------------
function openSignout(toolId, userId, jobId, supervisorId, at) {
  const id = newId('signout');
  db.prepare(
    `INSERT INTO signout (id, toolId, userId, currentResponsible, jobId, supervisorId, signOutAt, signOutPhoto, supervisorSignoff, transferred)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'n/a', '[]')`
  ).run(id, toolId, userId, userId, jobId, supervisorId, at, seedPhoto());
  db.prepare(`UPDATE tool SET status='out', currentHolder=?, currentJob=?, currentSignoutId=? WHERE id=?`)
    .run(userId, jobId, id, toolId);
  return id;
}

function returnedFine(toolId, userId, jobId, supervisorId, outAt, backAt) {
  const id = newId('signout');
  db.prepare(
    `INSERT INTO signout (id, toolId, userId, currentResponsible, jobId, supervisorId, signOutAt, signOutPhoto, returnAt, returnPhoto, condition, supervisorSignoff, transferred)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fine', 'n/a', '[]')`
  ).run(id, toolId, userId, userId, jobId, supervisorId, outAt, seedPhoto(), backAt, seedPhoto());
  // tool stays available (no currentSignoutId)
}

function returnedDamaged(toolId, userId, jobId, supervisorId, outAt, backAt, notes) {
  const id = newId('signout');
  db.prepare(
    `INSERT INTO signout (id, toolId, userId, currentResponsible, jobId, supervisorId, signOutAt, signOutPhoto, returnAt, returnPhoto, condition, notes, supervisorSignoff, transferred)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issue', ?, 'n/a', '[]')`
  ).run(id, toolId, userId, userId, jobId, supervisorId, outAt, seedPhoto(), backAt, seedPhoto(), notes);
  db.prepare(`UPDATE tool SET status='damaged', currentHolder=NULL, currentJob=NULL, currentSignoutId=? WHERE id=?`)
    .run(id, toolId);
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

console.log('Activity…');
// Currently out
openSignout(t.drill, sam, marina, cambell, hoursAgo(5));
openSignout(t.circsaw, jack, kiosk, mia, hoursAgo(4));
openSignout(t.laser, tom, marina, dave, hoursAgo(6)); // held by the supervised employee

// History so the generator has a timeline and is available again
returnedFine(t.gen, sam, marina, cambell, daysAgo(1) + '', hoursAgo(20));
returnedFine(t.gen, jack, kiosk, mia, daysAgo(3), daysAgo(2));

// A damaged tool sitting unavailable (populates Phase 3 "needs attention")
returnedDamaged(t.grinder, ella, kiosk, mia, hoursAgo(9), hoursAgo(1), 'Damaged / needs repair; Note: guard cracked');

console.log('\nSeed complete. Everyone\'s PIN is', DEFAULT_PIN);
console.log('Sample logins:');
console.log('  Cambell Waller (admin+supervisor)  0400000001');
console.log('  Dave Nguyen    (supervisor)         0400000002');
console.log('  Sam Torres     (employee)           0400000004');
console.log('  Tom Fletcher   (supervised employee) 0400000007');

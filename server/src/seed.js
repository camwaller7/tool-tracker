// Seeds the Port Lincoln sample dataset (PROTOTYPE-REFERENCE.md): 2 active jobs
// + 1 closed, 14 tools, 7 people incl. one supervised. Wipes and re-seeds the
// core tables. Run with:  npm run seed
import { q, pool, ensureSchema } from './db.js';
import { savePhoto } from './storage.js';
import { newId, now, hashPin, daysFromNow } from './util.js';

const DEFAULT_PIN = '1234';

const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR42mNkYPhfz0AEYBxVSF+F' +
    'jP///2egEDCOKqSvQsb///9TZgIAsBAJ8x0v4bkAAAAASUVORK5CYII=',
  'base64'
);
const seedPhoto = () => savePhoto(PLACEHOLDER_PNG, 'image/png');

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

async function addPerson(name, phone, roles, status = 'active') {
  const id = newId('person');
  const email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@portlincolntrades.example';
  await q.run(
    `INSERT INTO person ("id","name","phone","email","pinHash","isEmployee","isSupervisor","isAdmin","status","supervisedUntil","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, name, phone, email, hashPin(DEFAULT_PIN),
      roles.employee === false ? false : true,
      !!roles.supervisor, !!roles.admin,
      status, status === 'supervised' ? daysFromNow(30) : null, now(),
    ]
  );
  return id;
}

async function addJob(name, client, status, supervisorIds) {
  const id = newId('job');
  await q.run('INSERT INTO job ("id","name","client","status","createdAt") VALUES ($1,$2,$3,$4,$5)',
    [id, name, client, status, now()]);
  for (const sid of supervisorIds) {
    await q.run('INSERT INTO job_supervisor ("jobId","supervisorId") VALUES ($1,$2)', [id, sid]);
  }
  return id;
}

async function addTool(name, category, assetTag) {
  const id = newId('tool');
  await q.run(`INSERT INTO tool ("id","name","category","assetTag","status","createdAt") VALUES ($1,$2,$3,$4,'available',$5)`,
    [id, name, category, assetTag, now()]);
  return id;
}

async function openSignout(toolId, userId, jobId, supervisorId, at) {
  const id = newId('signout');
  await q.run(
    `INSERT INTO signout ("id","toolId","userId","currentResponsible","jobId","supervisorId","signOutAt","signOutPhoto","supervisorSignoff","transferred")
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7,'n/a','[]'::jsonb)`,
    [id, toolId, userId, jobId, supervisorId, at, await seedPhoto()]
  );
  await q.run(`UPDATE tool SET "status"='out', "currentHolder"=$1, "currentJob"=$2, "currentSignoutId"=$3 WHERE "id"=$4`,
    [userId, jobId, id, toolId]);
}

async function returnedFine(toolId, userId, jobId, supervisorId, outAt, backAt) {
  const id = newId('signout');
  await q.run(
    `INSERT INTO signout ("id","toolId","userId","currentResponsible","jobId","supervisorId","signOutAt","signOutPhoto","returnAt","returnPhoto","condition","supervisorSignoff","transferred")
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,'fine','n/a','[]'::jsonb)`,
    [id, toolId, userId, jobId, supervisorId, outAt, await seedPhoto(), backAt, await seedPhoto()]
  );
}

async function returnedDamaged(toolId, userId, jobId, supervisorId, outAt, backAt, notes) {
  const id = newId('signout');
  await q.run(
    `INSERT INTO signout ("id","toolId","userId","currentResponsible","jobId","supervisorId","signOutAt","signOutPhoto","returnAt","returnPhoto","condition","notes","supervisorSignoff","transferred")
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,'issue',$10,'n/a','[]'::jsonb)`,
    [id, toolId, userId, jobId, supervisorId, outAt, await seedPhoto(), backAt, await seedPhoto(), notes]
  );
  await q.run(`UPDATE tool SET "status"='damaged', "currentHolder"=NULL, "currentJob"=NULL, "currentSignoutId"=$1 WHERE "id"=$2`,
    [id, toolId]);
}

export async function seedDemo() {
  await ensureSchema();
  console.log('Clearing existing data…');
  await q.run('TRUNCATE notification, strike, "registerEntry", signout, job_supervisor, tool, job, person CASCADE');

  console.log('People…');
  const cambell = await addPerson('Cambell Waller', '0400000001', { supervisor: true, admin: true });
  const dave = await addPerson('Dave Nguyen', '0400000002', { supervisor: true });
  const mia = await addPerson('Mia Rossi', '0400000003', { supervisor: true });
  const sam = await addPerson('Sam Torres', '0400000004', {});
  const jack = await addPerson('Jack Reeves', '0400000005', {});
  const ella = await addPerson('Ella Brown', '0400000006', {});
  const tom = await addPerson('Tom Fletcher', '0400000007', {}, 'supervised');

  console.log('Jobs…');
  const marina = await addJob('Marina Berth Rebuild', 'Port Lincoln Marina', 'active', [cambell, dave]);
  const kiosk = await addJob('Foreshore Kiosk Fitout', 'City Council', 'active', [mia]);
  await addJob('Grain Shed Reroof', 'AgCo Storage', 'closed', [dave]);

  console.log('Tools…');
  const t = {
    drill: await addTool('Makita Drill', 'power tool', 'PT-001'),
    impact: await addTool('DeWalt Impact Driver', 'power tool', 'PT-002'),
    circsaw: await addTool('Circular Saw', 'power tool', 'PT-003'),
    grinder: await addTool('Angle Grinder', 'power tool', 'PT-004'),
    hammer: await addTool('Claw Hammer', 'hand tool', 'HT-011'),
    tape: await addTool('Tape Measure', 'hand tool', 'HT-012'),
    level: await addTool('Spirit Level', 'hand tool', 'HT-013'),
    ladder: await addTool('Aluminium Ladder 2.4m', 'access', 'AC-021'),
    trestle: await addTool('Trestle Pair', 'access', 'AC-022'),
    laser: await addTool('Laser Level', 'measuring', 'ME-031'),
    station: await addTool('Total Station', 'measuring', 'ME-032'),
    gen: await addTool('Honda 2kVA Generator', 'generator', 'GEN-041'),
    lead: await addTool('Extension Lead 20m', 'other', 'OT-051'),
    firstaid: await addTool('First Aid Kit', 'other', 'OT-052'),
  };

  console.log('Activity…');
  await openSignout(t.drill, sam, marina, cambell, hoursAgo(5));
  await openSignout(t.circsaw, jack, kiosk, mia, hoursAgo(4));
  await openSignout(t.laser, tom, marina, dave, hoursAgo(6));
  await returnedFine(t.gen, sam, marina, cambell, daysAgo(1), hoursAgo(20));
  await returnedFine(t.gen, jack, kiosk, mia, daysAgo(3), daysAgo(2));
  await returnedDamaged(t.grinder, ella, kiosk, mia, hoursAgo(9), hoursAgo(1), 'Damaged / needs repair; Note: guard cracked');

  console.log('\nSeed complete. Everyone\'s PIN is', DEFAULT_PIN);
  console.log('Sample logins:');
  console.log('  Cambell Waller (admin+supervisor)   0400000001');
  console.log('  Dave Nguyen    (supervisor)          0400000002');
  console.log('  Sam Torres     (employee)            0400000004');
  console.log('  Tom Fletcher   (supervised employee) 0400000007');
  return { seeded: true };
}

// Run directly as a script (npm run seed).
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

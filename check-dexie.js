const { db } = require('./src/lib/dexie/db');
db.reports.toArray().then(reports => {
  console.log('Reports in Dexie:', JSON.stringify(reports, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

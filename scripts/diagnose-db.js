// Read-only diagnosis. Credentials, hostnames and raw driver errors are never printed.
require('../src/config').loadEnv();
const mongoose = require('mongoose');
const { Resolver } = require('node:dns/promises');
const { connectDatabaseOrThrow } = require('../src/database');
const { diagnoseDatabaseError } = require('../src/utils/database-errors');

async function main() {
  const uri = process.env.MONGODB_URI;
  console.log(`MONGODB_URI: ${uri ? 'configured' : 'missing'}; TEST_MONGODB_URI: ${process.env.TEST_MONGODB_URI ? 'configured' : 'not configured (tests use isolated collections in the configured database)'}.`);
  if (uri) {
    try {
      const parsed = new URL(uri);
      console.log(`URI scheme: ${parsed.protocol}; explicit application database: ${parsed.pathname.length > 1 ? 'yes' : 'no'}.`);
      if (parsed.protocol === 'mongodb+srv:') {
        const resolver = new Resolver({ timeout: 5000, tries: 1 });
        const srv = await resolver.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
        console.log(`Atlas SRV DNS: ${srv.length} records resolved.`);
      }
    } catch (error) {
      const diagnostic = diagnoseDatabaseError(error);
      console.log(`Preflight [${diagnostic.category}]: ${diagnostic.message}`);
    }
  }
  const client = new mongoose.Mongoose();
  try {
    await connectDatabaseOrThrow(uri, {
      client,
      connectionOptions: { maxPoolSize: 1, autoCreate: false, autoIndex: false },
      onRetry: (diagnostic, attempt) => console.log(`Attempt ${attempt}/3 [${diagnostic.category}]: ${diagnostic.message}`),
    });
    console.log('MongoDB connectivity: PASS (authenticated ping). No records or credentials were changed.');
  } finally { await client.disconnect(); }
}
main().catch(error => {
  console.error(error.name === 'DatabaseConnectionError' ? error.message : 'Database diagnosis failed. No raw connection details are logged.');
  process.exitCode = 1;
});

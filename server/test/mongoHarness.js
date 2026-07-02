// Throwaway in-memory MongoDB for characterization/integration tests.
// Spins a real mongod (via mongodb-memory-server) so aggregation pipelines
// run for real — a hand-rolled fake would have to reimplement $group/$reduce/
// $map/$avg and could silently agree with buggy code. Call start() in
// beforeAll and stop() in afterAll.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');

async function startInMemoryMongo() {
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  return {
    client,
    async stop() {
      await client.close();
      await mongod.stop();
    },
  };
}

module.exports = { startInMemoryMongo };

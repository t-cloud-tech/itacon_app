const { v1 } = require('../functions/node_modules/@google-cloud/firestore');

async function main() {
  const client = new v1.FirestoreAdminClient({ projectId: 'itacon-app' });
  const formattedDatabase = client.databasePath('itacon-app', '(default)');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outputUriPrefix = `gs://itacon-app-backups/pre-delete-${dateStr}`;

  console.log(`Exporting Firestore documents from ${formattedDatabase} to ${outputUriPrefix}...`);
  const [operation] = await client.exportDocuments({
    name: formattedDatabase,
    outputUriPrefix: outputUriPrefix,
    collectionIds: [],
  });

  console.log(`Operation created: ${operation.name}`);
  console.log('Waiting for export operation to complete (this may take 1-3 minutes)...');
  const [response] = await operation.promise();
  console.log('Firestore export completed successfully!');
  console.log('Response:', JSON.stringify(response, null, 2));
}

main().catch(err => {
  console.error('Firestore export failed:', err);
  process.exit(1);
});


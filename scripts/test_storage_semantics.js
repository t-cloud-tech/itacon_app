const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

async function main() {
  const env = await initializeTestEnvironment({
    projectId: 'itacon-app',
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /test/{file} {
      allow create: if true;
      allow update: if false;
      allow delete: if false;
    }
  }
}`,
    },
  });

  const s = env.authenticatedContext('u1').storage();
  const r = s.ref('test/doc.txt');

  console.log('1. First put:');
  await r.put(Buffer.from('hello'));
  console.log('First put succeeded!');

  console.log('2. Second put (overwrite):');
  try {
    await r.put(Buffer.from('world'));
    console.log('Second put: SUCCEEDED');
  } catch (e) {
    console.log('Second put: FAILED', e.code);
  }

  console.log('3. updateMetadata:');
  try {
    await r.updateMetadata({ customMetadata: { x: '1' } });
    console.log('updateMetadata: SUCCEEDED');
  } catch (e) {
    console.log('updateMetadata: FAILED', e.code);
  }

  console.log('4. delete:');
  try {
    await r.delete();
    console.log('delete: SUCCEEDED');
  } catch (e) {
    console.log('delete: FAILED', e.code);
  }

  await env.cleanup();
}

main().catch(console.error);

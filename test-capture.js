const { captureNote } = require('./capture');

async function test() {
  try {
    console.log('Testing capture module...');
    
    const notePath = await captureNote(
      'This is a test note from the vault curator build session!',
      { source: 'telegram' }
    );
    
    console.log('✅ Note created:', notePath);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();

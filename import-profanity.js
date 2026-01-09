async function importList(url, lang, severity, source) {
  console.log(`\n📥 Importing ${source} (${lang}, severity: ${severity})...`);
  
  try {
    // Download
    const response = await fetch(url);
    const text = await response.text();
    const words = text.split('\n').map(w => w.trim()).filter(w => w);
    
    console.log(`   Found ${words.length} words`);
    
    // Import via API
    const result = await fetch('http://localhost:3000/api/v1/profanity/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        words,
        language:  lang,
        severity,
        source
      })
    });
    
    const data = await result.json();
    console.log(`   ✅ Result: `, data);
    
    return data;
  } catch (error) {
    console.error(`   ❌ Error importing ${source}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting profanity data import...\n');
  
  try {
    // Import EN
    await importList(
      'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en',
      'en',
      'medium',
      'ldnoobw'
    );
    
    // Import FR
    await importList(
      'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/fr',
      'fr',
      'medium',
      'ldnoobw'
    );
    
    // Import FR Extra
    await importList(
      'https://raw.githubusercontent.com/darwiin/french-badwords-list/master/list.txt',
      'fr',
      'high',
      'french-badwords'
    );
    
    // Check stats
    console.log('\n📊 Final stats:');
    const statsResponse = await fetch('http://localhost:3000/api/v1/profanity/count');
    const stats = await statsResponse. json();
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\n✅ All done!');
  } catch (error) {
    console.error('\n❌ Error:', error. message);
    process.exit(1);
  }
}

main();
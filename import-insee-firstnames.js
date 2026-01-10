const fs = require('fs');
const path = require('path');

/**
 * Parse CSV line handling potential issues
 */
function parseCSVLine(line) {
  const parts = line.split(';');
  if (parts.length < 4) return null;
  
  return {
    sexe: parts[0].trim(),
    prenat: parts[1].trim(),
    annais: parts[2].trim(),
    nombre: parts[3].trim(),
  };
}

/**
 * Calculate quartiles from birth year distribution
 */
function calculateQuartiles(birthYears, currentYear = 2026) {
  // Flatten distribution into array of ages
  const ages = [];
  
  for (const entry of birthYears) {
    const age = currentYear - entry.year;
    const count = entry.totalCount;
    
    // Add age 'count' times to array
    for (let i = 0; i < count; i++) {
      ages.push(age);
    }
  }
  
  if (ages.length === 0) return { p25: null, p50: null, p75: null };
  
  ages.sort((a, b) => a - b);
  
  const getPercentile = (arr, p) => {
    const index = Math.floor(arr.length * p);
    return arr[Math.min(index, arr.length - 1)];
  };
  
  return {
    p25: getPercentile(ages, 0.25),
    p50: getPercentile(ages, 0.50),
    p75: getPercentile(ages, 0.75),
  };
}

/**
 * Calculate weighted average age
 */
function calculateWeightedAge(birthYears, currentYear = 2026) {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const entry of birthYears) {
    const age = currentYear - entry.year;
    const weight = entry.totalCount;
    
    weightedSum += age * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return null;
  
  return Math.round(weightedSum / totalWeight);
}

/**
 * Find peak decade
 */
function findPeakDecade(birthYears) {
  const decades = {};
  
  for (const entry of birthYears) {
    const decade = Math.floor(entry.year / 10) * 10;
    const decadeKey = `${decade}s`;
    
    if (!decades[decadeKey]) {
      decades[decadeKey] = 0;
    }
    
    decades[decadeKey] += entry.totalCount;
  }
  
  let maxCount = 0;
  let peakDecade = null;
  
  for (const [decade, count] of Object.entries(decades)) {
    if (count > maxCount) {
      maxCount = count;
      peakDecade = decade;
    }
  }
  
  return peakDecade;
}

/**
 * Process CSV file and aggregate by firstname
 */
async function processCSVFile(filePath) {
  console.log(`📖 Reading file: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`   Total lines: ${lines.length}`);
  
  // Skip header
  const dataLines = lines.slice(1).filter(l => l.trim());
  
  // Aggregate by firstname
  const firstnameData = {};
  
  for (const line of dataLines) {
    const parsed = parseCSVLine(line);
    if (!parsed) continue;
    
    const { sexe, prenat, annais, nombre } = parsed;
    
    // Skip invalid data
    if (annais === 'XXXX' || prenat === '_PRENOMS_RARES') continue;
    
    const year = parseInt(annais, 10);
    const count = parseInt(nombre, 10);
    const sex = sexe === '1' ? 'M' : 'F';
    
    if (isNaN(year) || isNaN(count)) continue;
    
    // Normalize firstname (lowercase, no accents)
    const firstname = prenat
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    
    if (!firstnameData[firstname]) {
      firstnameData[firstname] = {
        firstname,
        maleCount: 0,
        femaleCount: 0,
        birthYears: {},
      };
    }
    
    // Update counts
    if (sex === 'M') {
      firstnameData[firstname].maleCount += count;
    } else {
      firstnameData[firstname].femaleCount += count;
    }
    
    // Update birth years
    if (!firstnameData[firstname].birthYears[year]) {
      firstnameData[firstname].birthYears[year] = { maleCount: 0, femaleCount: 0 };
    }
    
    if (sex === 'M') {
      firstnameData[firstname].birthYears[year].maleCount += count;
    } else {
      firstnameData[firstname].birthYears[year].femaleCount += count;
    }
  }
  
  console.log(`   Unique firstnames found: ${Object.keys(firstnameData).length}`);
  
  // Convert to final format
  const result = [];
  
  for (const [firstname, data] of Object.entries(firstnameData)) {
    const maleCount = data.maleCount;
    const femaleCount = data.femaleCount;
    const totalCount = maleCount + femaleCount;
    
    if (totalCount === 0) continue;
    
    const genderRatio = Math.max(maleCount, femaleCount) / totalCount;
    
    let dominantGender = null;
    if (maleCount > femaleCount) dominantGender = 'M';
    else if (femaleCount > maleCount) dominantGender = 'F';
    
    // Convert birthYears to array
    const birthYears = Object.entries(data.birthYears)
      .map(([year, counts]) => ({
        year: parseInt(year, 10),
        maleCount: counts.maleCount,
        femaleCount: counts.femaleCount,
        totalCount: counts.maleCount + counts.femaleCount,
      }))
      .sort((a, b) => a.year - b.year);
    
    const estimatedAge = calculateWeightedAge(birthYears);
    const quartiles = calculateQuartiles(birthYears);
    const peakDecade = findPeakDecade(birthYears);
    
    result.push({
      firstname,
      maleCount,
      femaleCount,
      totalCount,
      genderRatio,
      dominantGender,
      birthYears,
      estimatedAge,
      ageP25: quartiles.p25,
      ageP50: quartiles.p50,
      ageP75: quartiles.p75,
      peakDecade,
    });
  }
  
  return result;
}

/**
 * Send batch to API
 */
async function sendBatch(batch, batchNumber) {
  console.log(`   Sending batch ${batchNumber} (${batch.length} firstnames)...`);
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/firstname-enrichment/import/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ firstnames: batch }),
    });
    
    const result = await response.json();
    console.log(`   ✅ Batch ${batchNumber}: imported=${result.imported}, skipped=${result.skipped}`);
    
    return result;
  } catch (error) {
    console.error(`   ❌ Error sending batch ${batchNumber}:`, error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node import-insee-firstnames.js <path-to-csv-file>');
    console.error('Example: node import-insee-firstnames.js data/nat2021.csv');
    process.exit(1);
  }
  
  const csvPath = args[0];
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }
  
  console.log('🚀 Starting INSEE firstname data import...\n');
  
  try {
    // Process CSV
    const firstnames = await processCSVFile(csvPath);
    
    console.log(`\n📊 Total firstnames to import: ${firstnames.length}`);
    
    // Import in batches of 500
    const batchSize = 500;
    let totalImported = 0;
    let totalSkipped = 0;
    
    for (let i = 0; i < firstnames.length; i += batchSize) {
      const batch = firstnames.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      const result = await sendBatch(batch, batchNumber);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Final stats:');
    console.log(`   Total imported: ${totalImported}`);
    console.log(`   Total skipped: ${totalSkipped}`);
    
    // Get API stats
    console.log('\n📊 Checking API stats...');
    const statsResponse = await fetch('http://localhost:3000/api/v1/firstname-enrichment/stats');
    const stats = await statsResponse.json();
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\n✅ All done!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

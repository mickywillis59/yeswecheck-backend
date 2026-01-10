# Firstname Enrichment Module

This module provides firstname extraction from email addresses, gender/civility deduction, and age estimation based on INSEE (French national statistics) data.

## Features

### 1. Advanced Firstname Extraction
- **NFKD normalization**: Handles accents correctly (José → jose)
- **Smart tokenization**: Filters blacklisted terms (contact, admin, info, etc.)
- **Intelligent scoring**: 0-100 scale with multiple factors:
  - Frequency score (logarithmic scale)
  - Length score (optimal 3-10 characters)
  - Position bonus (second token in 2-token patterns gets boost)
  - Purity bonus (unambiguous gender gets boost)
- **Ambiguity check**: Requires 25% score gap between best and second-best candidates
- **Compound name support**: Preserves hyphens (Jean-Pierre)

### 2. Demographics
- **Gender deduction**: M./Mme when >85% confidence, null for ambiguous names
- **Age estimation**: P25/P50/P75 quartiles from INSEE birth data
- **Confidence scoring**: Based on data volume (0.3-0.9)
- **Peak decade**: Identifies most common birth decade

### 3. Performance
- **Redis caching**: Sub-millisecond lookups
- **Batch loading**: Automatic on startup
- **Batch import API**: For large datasets

## API Endpoints

### POST /api/v1/firstname-enrichment/enrich
Extract and enrich firstname from email.

**Request:**
```json
{
  "email": "jean.dupont@example.com"
}
```

**Response:**
```json
{
  "firstName": "Jean",
  "firstNameConfidence": 92,
  "civility": "M.",
  "gender": "M",
  "genderConfidence": 0.99,
  "presumedAge": 67,
  "presumedAgeRange": {
    "p25": 52,
    "p50": 68,
    "p75": 79
  },
  "presumedAgeConfidence": 0.90,
  "peakDecade": "1950s",
  "detectedFrom": "email_local_part",
  "normalizedInput": "jean.dupont",
  "warnings": [
    "Âge basé sur naissances INSEE, pas population vivante actuelle"
  ],
  "debug": {
    "allScores": [
      {"token": "jean", "score": 92},
      {"token": "dupont", "score": 35}
    ],
    "appliedRatio": "2.63"
  }
}
```

### GET /api/v1/firstname-enrichment/stats
Get database statistics.

**Response:**
```json
{
  "totalFirstnames": 30000,
  "source": "insee",
  "lastUpdate": "2026-01-10T13:00:00.000Z"
}
```

### GET /api/v1/firstname-enrichment/top
Get top 100 firstnames by frequency.

**Response:**
```json
[
  {
    "id": "uuid",
    "firstname": "jean",
    "maleCount": 500000,
    "femaleCount": 1000,
    "totalCount": 501000,
    ...
  }
]
```

### POST /api/v1/firstname-enrichment/import/batch
Import INSEE data in batch.

**Request:**
```json
{
  "firstnames": [
    {
      "firstname": "jean",
      "maleCount": 500000,
      "femaleCount": 1000,
      "totalCount": 501000,
      "genderRatio": 0.998,
      "dominantGender": "M",
      "birthYears": [...],
      "estimatedAge": 67,
      "ageP25": 52,
      "ageP50": 68,
      "ageP75": 79,
      "peakDecade": "1950s"
    }
  ]
}
```

## Import Script

Use the provided script to import INSEE CSV data:

```bash
node import-insee-firstnames.js data/nat2021.csv
```

**CSV Format Expected:**
```csv
sexe;prenat;annais;nombre
1;JEAN;1950;12345
2;MARIE;1950;11234
```

The script will:
1. Parse and normalize firstnames
2. Aggregate by firstname
3. Calculate age statistics
4. Send in batches of 500 to the API

## Test Cases Covered

### Extraction Scenarios
- ✅ `jean.dupont@example.com` → Jean
- ✅ `JEAN@example.com` → Jean
- ✅ `jean49@example.com` → Jean (removes trailing digits)
- ✅ `59jean@example.com` → Jean (removes leading digits)
- ✅ `jean!@example.com` → Jean (removes punctuation)
- ✅ `martin.jean@example.com` → Jean (position bonus)
- ✅ `jean-pierre@example.com` → Jean-Pierre (compound names)
- ✅ `xyz123@example.com` → null (no valid firstname)
- ✅ `contact@example.com` → null (blacklist)
- ✅ `a.b.jean@example.com` → Jean (filters tokens < 2 chars)

### Validation
- ✅ Score always bounded to 0-100
- ✅ Gender deduction at 85% threshold
- ✅ Ambiguous names (Camille) return null civility
- ✅ Age quartiles calculated correctly
- ✅ Warnings included (INSEE disclaimer, rare firstname)
- ✅ Ambiguity ratio enforced (1.25x minimum gap)

## Architecture

Follows the same pattern as `disposable-email` module:
- Entity for database (TypeORM)
- Service with Redis caching
- Controller with RESTful endpoints
- Module with TypeORM integration
- Comprehensive unit tests

## Dependencies

- TypeORM: Database ORM
- ioredis: Redis caching
- class-validator: DTO validation

## Security

- No vulnerabilities detected (CodeQL scan)
- RGPD-friendly: Only birth statistics, no personal data
- Non-blocking: Always returns a response (null if no data)

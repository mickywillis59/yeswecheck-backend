#!/bin/bash
set -e

echo "🚀 Importing ambiguous firstnames seed v3..."

# Connexion PostgreSQL
DB_HOST="localhost"
DB_USER="yeswecheck_user"
DB_NAME="yeswecheck"

# 1. Importer le seed (crée table + contraintes + trigger + données)
echo "📥 Importing seed..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f seed-ambiguous-firstnames-v3.sql

# 2. Vérifier les contraintes
echo "✅ Verifying constraints..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
AND constraint_name LIKE 'chk_%';
"

# 3. Vérifier les données
echo "✅ Verifying data..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
  token_type, 
  lastname_frequency,
  COUNT(*) 
FROM ambiguous_firstnames 
GROUP BY token_type, lastname_frequency
ORDER BY token_type, lastname_frequency;
"

# 4. Tester le trigger lowercase
echo "🧪 Testing lowercase trigger..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
INSERT INTO ambiguous_firstnames (firstname, token_type, lastname_frequency) 
VALUES ('  TEST  ', 'AMBIGUOUS', 'low') 
ON CONFLICT (firstname) DO NOTHING;

SELECT firstname FROM ambiguous_firstnames WHERE firstname = 'test';

DELETE FROM ambiguous_firstnames WHERE firstname = 'test';
"

# 5. Tester les contraintes CHECK
echo "🧪 Testing CHECK constraints..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
-- Ceci doit échouer
INSERT INTO ambiguous_firstnames (firstname, token_type, lastname_frequency) 
VALUES ('invalid_test', 'INVALID_TYPE', 'high');
" 2>&1 | grep -q "violates check constraint" && echo "✅ CHECK constraint works!" || echo "❌ CHECK constraint failed!"

echo "🎉 Import completed!"
echo ""
echo "📊 Summary:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as total FROM ambiguous_firstnames;"

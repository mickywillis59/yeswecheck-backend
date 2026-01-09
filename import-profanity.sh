#!/bin/bash

echo "📥 Starting profanity data import..."

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ jq is not installed. Installing..."
    apt-get update && apt-get install -y jq
fi

BASE_URL="http://localhost:3000/api/v1/profanity/import"

# Function to download and import
import_list() {
    local url=$1
    local lang=$2
    local severity=$3
    local source=$4
    
    echo ""
    echo "📥 Importing $source ($lang, severity: $severity)..."
    
    # Download
    curl -s "$url" -o /tmp/profanity-temp.txt
    
    # Count lines
    lines=$(cat /tmp/profanity-temp.txt | grep -v '^$' | wc -l)
    echo "   Found $lines words"
    
    # Convert to JSON array
    words=$(cat /tmp/profanity-temp.txt | jq -R -s -c 'split("\n") | map(select(length > 0))')
    
    # Import via API
    response=$(curl -s -X POST "$BASE_URL" \
      -H "Content-Type: application/json" \
      -d "{\"words\": $words, \"language\": \"$lang\", \"severity\": \"$severity\", \"source\":  \"$source\"}")
    
    echo "   ✅ Result: $response"
}

echo ""
echo "🔄 Starting imports..."

# Import LDNOOBW - English
import_list \
  "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en" \
  "en" \
  "medium" \
  "ldnoobw"

# Import LDNOOBW - French
import_list \
  "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/fr" \
  "fr" \
  "medium" \
  "ldnoobw"

# Import French Badwords List
import_list \
  "https://raw.githubusercontent.com/darwiin/french-badwords-list/master/list.txt" \
  "fr" \
  "high" \
  "french-badwords"

echo ""
echo "🎉 Import complete!"
echo ""
echo "📊 Checking stats..."

curl -s http://localhost:3000/api/v1/profanity/count | jq '.'

echo ""
echo "✅ All done!"
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUERIES = {
  nihongo: '日本語の勉強',
  conversation: 'japanese conversation'
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
};

async function fetchYoutubeSearch(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=ja`;
  console.log(`Fetching YouTube search for: "${query}" ...`);
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const html = await response.text();

  // Try to find ytInitialData in HTML
  const regexes = [
    /ytInitialData\s*=\s*({[\s\S]+?});/,
    /window\["ytInitialData"\]\s*=\s*({[\s\S]+?});/,
    /var ytInitialData\s*=\s*({[\s\S]+?});/
  ];

  let jsonStr = null;
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match) {
      jsonStr = match[1];
      break;
    }
  }

  if (!jsonStr) {
    // If not found with regex, try a more permissive block scanner
    const index = html.indexOf('ytInitialData = {');
    if (index !== -1) {
      // Find the closing brace
      let braceCount = 0;
      let start = html.indexOf('{', index);
      let end = start;
      while (end < html.length) {
        if (html[end] === '{') braceCount++;
        else if (html[end] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonStr = html.substring(start, end + 1);
            break;
          }
        }
        end++;
      }
    }
  }

  if (!jsonStr) {
    throw new Error(`Could not find ytInitialData in HTML for query: "${query}"`);
  }

  // Verify it is valid JSON
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (err) {
    throw new Error(`Extracted string is not valid JSON: ${err.message}`);
  }
}

async function main() {
  const fixturesDir = __dirname + '/../src/lib/media/__tests__/fixtures';
  
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  for (const [key, query] of Object.entries(QUERIES)) {
    try {
      const data = await fetchYoutubeSearch(query);
      const filePath = fixturesDir + `/${key}.json`;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Successfully saved fixture to ${filePath}`);
    } catch (error) {
      console.error(`Error generating fixture for "${query}":`, error.message);
      process.exit(1);
    }
  }
}

main();

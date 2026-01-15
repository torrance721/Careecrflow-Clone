/**
 * Test Tavily Search API for interview data
 * Tavily is a search API that can search across multiple sources
 */

// Tavily API endpoint
const TAVILY_API_URL = 'https://api.tavily.com/search';

// We'll use the built-in forge API which includes Tavily-like search
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const TEST_COMPANY = 'Google';
const TEST_POSITION = 'Software Engineer';

async function testTavilySearch() {
  console.log('\n🔍 Testing Tavily-style Search');
  console.log('-'.repeat(50));
  
  // Search queries for interview data
  const queries = [
    `${TEST_COMPANY} ${TEST_POSITION} interview questions`,
    `${TEST_COMPANY} interview experience 一亩三分地`,
    `${TEST_COMPANY} ${TEST_POSITION} interview reddit`,
  ];
  
  for (const query of queries) {
    console.log(`\n📝 Query: "${query}"`);
    
    try {
      // Try using the forge API's search capability
      const response = await fetch(`${FORGE_API_URL}/v1/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FORGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          max_results: 5,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found ${data.results?.length || 0} results`);
        
        if (data.results?.length > 0) {
          data.results.slice(0, 3).forEach((result, i) => {
            console.log(`\n  ${i + 1}. ${result.title}`);
            console.log(`     URL: ${result.url}`);
            console.log(`     Snippet: ${result.snippet?.slice(0, 150)}...`);
          });
        }
      } else {
        console.log(`❌ Search failed: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`   Response: ${text.slice(0, 200)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function testDirectTavilyAPI() {
  console.log('\n🔍 Testing Direct Tavily API (if available)');
  console.log('-'.repeat(50));
  
  // Check if we have a Tavily API key
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  
  if (!TAVILY_API_KEY) {
    console.log('⚠️ TAVILY_API_KEY not set, skipping direct Tavily test');
    console.log('   Tavily is a paid API service');
    return;
  }
  
  const query = `${TEST_COMPANY} ${TEST_POSITION} interview questions experience`;
  
  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'advanced',
        include_domains: ['reddit.com', '1point3acres.com', 'glassdoor.com', 'blind.com'],
        max_results: 10,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Found ${data.results?.length || 0} results`);
      
      if (data.results?.length > 0) {
        data.results.forEach((result, i) => {
          console.log(`\n${i + 1}. ${result.title}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   Content: ${result.content?.slice(0, 200)}...`);
        });
      }
    } else {
      console.log(`❌ Tavily API failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function testAlternativeSearch() {
  console.log('\n🔍 Testing Alternative: Use LLM with web search capability');
  console.log('-'.repeat(50));
  
  // The forge API might have a data_api endpoint for web search
  try {
    const response = await fetch(`${FORGE_API_URL}/v1/data_api/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FORGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${TEST_COMPANY} ${TEST_POSITION} interview questions`,
        type: 'web',
        limit: 5,
      }),
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500));
    } else {
      const text = await response.text();
      console.log(`Response: ${text.slice(0, 300)}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log(`Testing search APIs for: ${TEST_POSITION} at ${TEST_COMPANY}`);
  console.log('='.repeat(60));
  
  console.log('\nEnvironment check:');
  console.log(`FORGE_API_URL: ${FORGE_API_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`FORGE_API_KEY: ${FORGE_API_KEY ? '✅ Set' : '❌ Not set'}`);
  
  // Test different search approaches
  await testTavilySearch();
  await testDirectTavilyAPI();
  await testAlternativeSearch();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary');
  console.log('='.repeat(60));
  console.log(`
Based on the tests, the recommended approach is:
1. LeetCode Scraper (Apify) - ✅ Working, 250+ results
2. Tavily/Web Search - Depends on API availability
3. Glassdoor - ❌ Requires paid subscription

For MVP, we can proceed with LeetCode data + LLM-based knowledge synthesis.
`);
}

main().catch(console.error);

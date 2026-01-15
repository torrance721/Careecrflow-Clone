/**
 * Test script for interview data sources
 * Run with: node scripts/test-data-sources.mjs
 */

import { ApifyClient } from 'apify-client';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_API_TOKEN) {
  console.error('❌ APIFY_API_TOKEN not set');
  process.exit(1);
}

const client = new ApifyClient({ token: APIFY_API_TOKEN });

// Test company and position
const TEST_COMPANY = 'Google';
const TEST_POSITION = 'Software Engineer';

console.log('='.repeat(60));
console.log(`Testing data sources for: ${TEST_POSITION} at ${TEST_COMPANY}`);
console.log('='.repeat(60));

// Test 1: Glassdoor Interview Questions
async function testGlassdoor() {
  console.log('\n📊 Test 1: Glassdoor Interview Questions');
  console.log('-'.repeat(40));
  
  try {
    // Try the glassdoor scraper
    const searchUrl = `https://www.glassdoor.com/Interview/${TEST_COMPANY}-Interview-Questions-E9079.htm`;
    
    console.log(`Searching: ${searchUrl}`);
    console.log('Starting Apify actor: epctex/glassdoor-scraper...');
    
    const run = await client.actor('epctex/glassdoor-scraper').call({
      startUrls: [{ url: searchUrl }],
      maxItems: 5,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    }, {
      timeout: 120, // 2 minutes timeout
    });
    
    console.log(`Run finished with status: ${run.status}`);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n✅ Found ${items.length} items from Glassdoor`);
    
    if (items.length > 0) {
      console.log('\nSample data:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`\n--- Item ${i + 1} ---`);
        console.log(JSON.stringify(item, null, 2).slice(0, 500) + '...');
      });
    }
    
    return items;
  } catch (error) {
    console.error(`❌ Glassdoor test failed: ${error.message}`);
    return [];
  }
}

// Test 2: LeetCode Interview Questions
async function testLeetCode() {
  console.log('\n💻 Test 2: LeetCode Interview Questions');
  console.log('-'.repeat(40));
  
  try {
    console.log('Starting Apify actor: harvest/leetcode-interview-questions-scraper...');
    
    const run = await client.actor('harvest/leetcode-interview-questions-scraper').call({
      company: TEST_COMPANY.toLowerCase(),
      maxItems: 10,
    }, {
      timeout: 120,
    });
    
    console.log(`Run finished with status: ${run.status}`);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n✅ Found ${items.length} items from LeetCode`);
    
    if (items.length > 0) {
      console.log('\nSample data:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`\n--- Item ${i + 1} ---`);
        console.log(JSON.stringify(item, null, 2).slice(0, 500) + '...');
      });
    }
    
    return items;
  } catch (error) {
    console.error(`❌ LeetCode test failed: ${error.message}`);
    return [];
  }
}

// Test 3: Check available Apify actors for interview data
async function listAvailableActors() {
  console.log('\n🔍 Test 3: Search for interview-related Apify actors');
  console.log('-'.repeat(40));
  
  try {
    // Search for glassdoor actors
    const store = await client.store().list({
      search: 'glassdoor interview',
      limit: 5,
    });
    
    console.log('\nGlassdoor-related actors:');
    store.items.forEach((actor, i) => {
      console.log(`${i + 1}. ${actor.username}/${actor.name} - ${actor.title}`);
    });
    
    // Search for leetcode actors
    const leetcodeStore = await client.store().list({
      search: 'leetcode',
      limit: 5,
    });
    
    console.log('\nLeetCode-related actors:');
    leetcodeStore.items.forEach((actor, i) => {
      console.log(`${i + 1}. ${actor.username}/${actor.name} - ${actor.title}`);
    });
    
  } catch (error) {
    console.error(`❌ Actor search failed: ${error.message}`);
  }
}

// Test 4: Simple Glassdoor URL test
async function testGlassdoorSimple() {
  console.log('\n📊 Test 4: Glassdoor Simple Web Scraper');
  console.log('-'.repeat(40));
  
  try {
    // Use a simpler web scraper approach
    const searchUrl = `https://www.glassdoor.com/Interview/Google-Software-Engineer-Interview-Questions-EI_IE9079.0,6_KO7,24.htm`;
    
    console.log(`Target URL: ${searchUrl}`);
    console.log('Starting Apify actor: apify/web-scraper...');
    
    const run = await client.actor('apify/web-scraper').call({
      startUrls: [{ url: searchUrl }],
      pageFunction: async function pageFunction(context) {
        const { $, request } = context;
        const results = [];
        
        // Try to extract interview questions
        $('[data-test="interviewQuestion"]').each((i, el) => {
          results.push({
            question: $(el).text().trim(),
            url: request.url,
          });
        });
        
        // Also try other selectors
        $('.interview-question').each((i, el) => {
          results.push({
            question: $(el).text().trim(),
            url: request.url,
          });
        });
        
        return results;
      },
      maxRequestsPerCrawl: 1,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    }, {
      timeout: 60,
    });
    
    console.log(`Run finished with status: ${run.status}`);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n✅ Found ${items.length} items`);
    
    if (items.length > 0) {
      console.log('\nSample data:');
      console.log(JSON.stringify(items.slice(0, 5), null, 2));
    }
    
    return items;
  } catch (error) {
    console.error(`❌ Simple Glassdoor test failed: ${error.message}`);
    return [];
  }
}

// Run all tests
async function main() {
  console.log('\n🚀 Starting data source tests...\n');
  
  // First, list available actors
  await listAvailableActors();
  
  // Test LeetCode (usually more reliable)
  const leetcodeResults = await testLeetCode();
  
  // Test Glassdoor
  // const glassdoorResults = await testGlassdoor();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Summary');
  console.log('='.repeat(60));
  console.log(`LeetCode: ${leetcodeResults.length} items`);
  // console.log(`Glassdoor: ${glassdoorResults.length} items`);
}

main().catch(console.error);

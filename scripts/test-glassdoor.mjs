/**
 * Test Glassdoor scraper specifically
 */

import { ApifyClient } from 'apify-client';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const client = new ApifyClient({ token: APIFY_API_TOKEN });

const TEST_COMPANY = 'Google';

async function testGlassdoorReviewsScraper() {
  console.log('\n📊 Testing: memo23/apify-glassdoor-reviews-scraper');
  console.log('-'.repeat(50));
  
  try {
    // This scraper can get interviews
    const run = await client.actor('memo23/apify-glassdoor-reviews-scraper').call({
      startUrls: [
        { url: `https://www.glassdoor.com/Interview/Google-Interview-Questions-E9079.htm` }
      ],
      maxItems: 10,
      proxy: {
        useApifyProxy: true,
      },
    }, {
      timeout: 180,
    });
    
    console.log(`Run status: ${run.status}`);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n✅ Found ${items.length} items`);
    
    if (items.length > 0) {
      console.log('\n📝 Sample items:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`\n--- Item ${i + 1} ---`);
        // Show relevant fields
        const relevantFields = {
          type: item.type,
          title: item.title,
          jobTitle: item.jobTitle,
          interviewQuestion: item.interviewQuestion,
          interviewAnswer: item.interviewAnswer,
          difficulty: item.difficulty,
          experience: item.experience,
          offer: item.offer,
          date: item.date,
        };
        console.log(JSON.stringify(relevantFields, null, 2));
      });
      
      // Show all unique keys
      console.log('\n📋 All available fields:');
      const allKeys = new Set();
      items.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
      console.log([...allKeys].join(', '));
    }
    
    return items;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    return [];
  }
}

async function testBittyStudioScraper() {
  console.log('\n📊 Testing: bitty.studio/glassdoor-jobs-company-reviews-interviews-salaries-scraper');
  console.log('-'.repeat(50));
  
  try {
    const run = await client.actor('bitty.studio/glassdoor-jobs-company-reviews-interviews-salaries-scraper').call({
      companyUrl: `https://www.glassdoor.com/Overview/Working-at-Google-EI_IE9079.11,17.htm`,
      scrapeInterviews: true,
      scrapeReviews: false,
      scrapeSalaries: false,
      scrapeJobs: false,
      maxInterviews: 10,
    }, {
      timeout: 180,
    });
    
    console.log(`Run status: ${run.status}`);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n✅ Found ${items.length} items`);
    
    if (items.length > 0) {
      console.log('\n📝 Sample items:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`\n--- Item ${i + 1} ---`);
        console.log(JSON.stringify(item, null, 2).slice(0, 800));
      });
    }
    
    return items;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🔍 Testing Glassdoor scrapers for:', TEST_COMPANY);
  console.log('='.repeat(60));
  
  // Test the reviews scraper (includes interviews)
  const results1 = await testGlassdoorReviewsScraper();
  
  // Test bitty.studio scraper
  const results2 = await testBittyStudioScraper();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary');
  console.log('='.repeat(60));
  console.log(`memo23 scraper: ${results1.length} items`);
  console.log(`bitty.studio scraper: ${results2.length} items`);
}

main().catch(console.error);

/**
 * 测试 LinkedIn 职位搜索功能
 */

import { scrapeLinkedInJobs } from '../apify';

async function testLinkedInSearch() {
  console.log('=== 测试 LinkedIn 职位搜索 ===\n');
  
  try {
    console.log('搜索: Software Engineer, San Francisco');
    console.log('开始时间:', new Date().toISOString());
    
    const jobs = await scrapeLinkedInJobs({
      title: 'Software Engineer',
      location: 'San Francisco',
      rows: 5,
    });
    
    console.log('\n结束时间:', new Date().toISOString());
    console.log(`找到 ${jobs.length} 个职位\n`);
    
    if (jobs.length > 0) {
      console.log('=== 职位列表 ===\n');
      jobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.title}`);
        console.log(`   公司: ${job.company}`);
        console.log(`   地点: ${job.location}`);
        console.log(`   链接: ${job.linkedinUrl}`);
        console.log('');
      });
    }
    
    return jobs;
  } catch (error) {
    console.error('搜索失败:', error);
    throw error;
  }
}

// 运行测试
testLinkedInSearch()
  .then(() => {
    console.log('测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });

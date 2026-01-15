import { describe, it, expect } from 'vitest';
import { isApifyConfigured, getApifyAccountInfo } from './apify';

describe('Apify Integration', () => {
  it('should have APIFY_API_TOKEN configured', () => {
    expect(isApifyConfigured()).toBe(true);
  });

  it('should be able to connect to Apify API', async () => {
    const accountInfo = await getApifyAccountInfo();
    
    expect(accountInfo.configured).toBe(true);
    expect(accountInfo.username).toBeDefined();
    expect(accountInfo.error).toBeUndefined();
    
    console.log('Apify account info:', accountInfo);
  }, 30000); // 30 second timeout for API call
});

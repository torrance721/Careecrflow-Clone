# LinkedIn Company Scraper (No Cookies) - API Notes

## Actor ID
`dev_fusion/linkedin-company-scraper`

## Pricing
$8.00 / 1,000 results

## Features
- No cookies required
- Extracts: company name, industry, website, LinkedIn URL, employee count, description, specialities, founding year, headquarters location, follower count
- Visual assets: company logos and cover images

## Input Format
```json
{
  "profileUrls": [
    "https://www.linkedin.com/company/tesla-motors",
    "https://www.linkedin.com/company/netflix"
  ]
}
```

## JavaScript API Usage
```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

const input = {
  profileUrls: [
    "https://www.linkedin.com/company/tesla-motors",
    "https://www.linkedin.com/company/netflix",
  ]
};

const run = await client.actor("dev_fusion/linkedin-company-scraper").call(input);

const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

## Expected Output Fields
- name: Company name
- industry: Industry type
- website: Company website URL
- linkedinUrl: LinkedIn company page URL
- employeeCount: Number of employees
- description: Company description
- specialities: Company specialities
- foundedYear: Year founded
- headquarters: Headquarters location
- followerCount: LinkedIn follower count
- logoUrl: Company logo URL
- coverImageUrl: Cover image URL

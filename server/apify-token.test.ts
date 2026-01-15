import { describe, it, expect } from "vitest";
import { ApifyClient } from "apify-client";

describe("Apify Token V2 Validation", () => {
  it("should validate APIFY_API_TOKEN_V2 by fetching user info", async () => {
    const token = process.env.APIFY_API_TOKEN_V2;
    expect(token).toBeDefined();
    expect(token).not.toBe("");

    const client = new ApifyClient({ token });
    
    // Fetch user info to validate token
    const user = await client.user().get();
    
    expect(user).toBeDefined();
    expect(user.username).toBeDefined();
    console.log(`Token validated for user: ${user.username}`);
  });

  it("should have access to Glassdoor scraper actor", async () => {
    const token = process.env.APIFY_API_TOKEN_V2;
    const client = new ApifyClient({ token });
    
    // Check if we can access the Glassdoor actor
    const actor = client.actor("memo23/apify-glassdoor-reviews-scraper");
    const actorInfo = await actor.get();
    
    expect(actorInfo).toBeDefined();
    expect(actorInfo?.name).toBe("apify-glassdoor-reviews-scraper");
    console.log(`Glassdoor actor accessible: ${actorInfo?.name}`);
  });
});

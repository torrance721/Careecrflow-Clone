# LinkedIn Profile Page Structure Analysis

## Key Findings from DOM Analysis

Based on the analysis of LinkedIn's profile page (https://www.linkedin.com/in/zhou-ric-li-7b579724/), here are the key DOM selectors and structure:

### 1. Profile URL Pattern
```
https://www.linkedin.com/in/{username}/
```

### 2. Key Data Attributes
- `data-view-name="identity-module"` - Main identity section
- `data-view-name="identity-self-profile"` - Profile links
- `data-view-name="image"` - Profile images
- `data-sdui-screen="com.linkedin.sdui.flagshipnav.feed.MainFeed"` - Main feed area

### 3. Profile Information Selectors (from visible elements)

#### Name
- Element index 21: `Zhou (Ric) Li` with verified badge
- CSS class pattern: `c60ffaab _6a957edf _98dd74c4 b0d9e07a _4af7d1db _6a6a27fc db587490 _710ac2b7`

#### Headline/Title
- Element index 22: `Founder, Answer.AI`
- CSS class pattern: `c60ffaab _9711d351 _4de8839f b0d9e07a _4af7d1db _6a6a27fc db587490 _710ac2b7`

#### Location
- `San Francisco Bay Area`
- CSS class pattern: `c60ffaab _9711d351 d51d7eb8 _11a23dae be840cb5 _76473fa0 _5355b5e1 a4423918 a464cddf`

#### Current Company
- Element index 22: `Answer.AI`
- With company logo image

#### Education
- Element index 23: `Peking University`

#### Connections
- Element index 25: `500+ 位好友` (500+ connections)

### 4. Profile Sections (from viewport elements)

| Section | Element Index | Description |
|---------|---------------|-------------|
| Profile Photo | 19 | User avatar |
| Name | 21 | Full name with verified badge |
| Company | 22 | Current company |
| Education | 23 | Education institution |
| Contact Info | 24 | Contact information link |
| Connections | 25 | Number of connections |
| Interests | 26 | Areas of interest |
| Profile Completion | 27-28 | Profile completion prompts |
| Job Seeking | 30-32 | Job seeking status |
| Analytics | 41-48 | Profile views, post impressions, search appearances |
| About | 50-51 | About section |
| Experience | 57-77 | Work experience entries |
| Education | 78-86 | Education entries |
| Skills | 87-97 | Skills section |

### 5. Experience Section Structure
Each experience entry contains:
- Job title
- Company name
- Employment type (正式 = Full-time)
- Duration (e.g., "2023年1月 - 至今 · 3 年 1 个月")
- Location type (现场办公 = On-site, 混合 = Hybrid)
- Description

### 6. Education Section Structure
Each education entry contains:
- Institution name
- Degree type and field
- Date range

### 7. Skills Section Structure
- Skill name
- Endorsement count
- Endorsers (colleagues from specific companies)

## Chrome Extension Implementation Notes

### Profile Scoring Criteria (Industry Standard)

Based on LinkedIn's own recommendations and career coaching best practices:

| Category | Weight | Scoring Criteria |
|----------|--------|------------------|
| **Profile Photo** | 10% | Professional headshot present |
| **Headline** | 15% | Contains keywords, not just job title, 120+ chars |
| **About Section** | 15% | 2000+ chars, keywords, achievements |
| **Experience** | 20% | 3+ positions, descriptions with metrics |
| **Education** | 10% | Degree info, relevant coursework |
| **Skills** | 10% | 5+ skills with endorsements |
| **Connections** | 10% | 500+ connections |
| **Recommendations** | 5% | 3+ recommendations |
| **Activity** | 5% | Recent posts/engagement |

### DOM Parsing Strategy

1. **Detect Profile Page**: Check URL pattern `/in/[username]/`
2. **Extract Basic Info**: Name, headline, location from identity module
3. **Extract Sections**: Iterate through section elements
4. **Calculate Score**: Apply weighted scoring based on completeness

### Sample Selectors (may change with LinkedIn updates)

```javascript
// Profile detection
const isProfilePage = window.location.pathname.startsWith('/in/');

// Get profile sections by aria-label or data attributes
const sections = document.querySelectorAll('[data-view-name]');

// Get text content from specific elements
const nameElement = document.querySelector('[data-view-name="identity-self-profile"]');
```

## Notes

- LinkedIn uses obfuscated CSS class names that change frequently
- Better to use `data-*` attributes and `aria-*` attributes for more stable selectors
- Consider using MutationObserver for dynamic content loading
- Profile structure may vary between logged-in user's own profile and others' profiles

# Quick Start Guide - Careerflow Clone

## 🚀 Get Your Application Running in 3 Steps

This guide will help you quickly get the Careerflow Clone application running on Vercel.

## Prerequisites

- GitHub account
- Vercel account (sign up at https://vercel.com)
- The backup file: `Careerflow-Clone-backup.tar.gz`

## Step 1: Upload Code to GitHub (5 minutes)

### Option A: Using Git Command Line (Recommended)

1. **Extract the backup file**:
   ```bash
   tar -xzf Careerflow-Clone-backup.tar.gz
   cd Careecrflow-Clone
   ```

2. **Initialize and push to GitHub**:
   ```bash
   # If repository is empty, initialize it
   git init
   git add -A
   git commit -m "Initial commit: Complete Careerflow Clone with paywall features"
   
   # Add remote and push
   git remote add origin https://github.com/Wangjiahui-mobi/Careecrflow-Clone.git
   git branch -M main
   git push -u origin main
   ```

### Option B: Using GitHub Desktop (Easiest)

1. Download and install GitHub Desktop
2. Extract the backup file
3. In GitHub Desktop: File → Add Local Repository → Select extracted folder
4. Commit all files with message: "Initial commit"
5. Publish repository to GitHub

### Option C: Using GitHub Web Interface (No Git Required)

1. Go to https://github.com/Wangjiahui-mobi/Careecrflow-Clone
2. Click "uploading an existing file"
3. Drag and drop all files from extracted backup
4. Commit changes

## Step 2: Deploy to Vercel (10 minutes)

### 2.1 Create New Project

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import `Wangjiahui-mobi/Careecrflow-Clone` repository
4. Click "Import"

### 2.2 Configure Build Settings

Vercel should auto-detect these settings, but verify:

- **Framework Preset**: Vite
- **Root Directory**: `./`
- **Build Command**: `pnpm build`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install`

### 2.3 Add Environment Variables

Click "Environment Variables" and add these:

```bash
# Required - Add these now
FORGE_API_KEY=your_manus_forge_api_key
APIFY_API_TOKEN=your_apify_api_token
SESSION_SECRET=generate_random_string_here

# Database - Will be added after Step 3
DATABASE_URL=will_be_added_after_postgres_setup

# Optional
NODE_ENV=production
PORT=3001
```

**Important**: Don't deploy yet! Click "Save" but don't click "Deploy".

## Step 3: Add Vercel Postgres (5 minutes)

### 3.1 Create Database

1. In your Vercel project, click "Storage" tab
2. Click "Create Database"
3. Select "Postgres"
4. Choose a name (e.g., "careerflow-db")
5. Select region (choose closest to your users)
6. Click "Create"

### 3.2 Connect Database

1. After creation, click "Connect"
2. Copy the connection string (starts with `postgres://`)
3. Go back to "Settings" → "Environment Variables"
4. Add or update `DATABASE_URL` with the connection string
5. Click "Save"

### 3.3 Run Database Migrations

You have two options:

**Option A: Using Vercel CLI (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Pull environment variables
vercel env pull .env

# Run migrations
pnpm drizzle-kit push
```

**Option B: Using Drizzle Studio**

1. Install dependencies locally: `pnpm install`
2. Copy `.env.example` to `.env`
3. Update `DATABASE_URL` with Vercel Postgres connection string
4. Run: `pnpm drizzle-kit push`

## Step 4: Deploy! 🎉

1. Go back to your Vercel project dashboard
2. Click "Deployments" tab
3. Click "Deploy" (or it may auto-deploy)
4. Wait 2-3 minutes for deployment to complete
5. Click on the deployment URL to view your app!

## Verify Deployment

Test these features to ensure everything works:

### ✅ Basic Functionality
- [ ] Application loads without errors
- [ ] Can register a new account
- [ ] Can login with created account
- [ ] Dashboard displays correctly

### ✅ Jobs Board
- [ ] Can search for jobs
- [ ] Jobs display in results
- [ ] Can perform 3 searches
- [ ] Paywall appears on 4th search

### ✅ Mock Interview
- [ ] Can start a mock interview
- [ ] AI responds to messages
- [ ] Recommended companies section is blurred
- [ ] Unlock button shows paywall

### ✅ Paywall
- [ ] Paywall modal displays correctly
- [ ] Shows 3 subscription tiers
- [ ] Subscribe button closes modal
- [ ] Upgrade button in sidebar works

## Troubleshooting

### Deployment Failed

**Check build logs**:
1. Go to Vercel project → Deployments
2. Click on failed deployment
3. Check "Build Logs" for errors

**Common issues**:
- Missing environment variables → Add them in Settings
- Database connection error → Verify DATABASE_URL
- Build errors → Check if all dependencies are in package.json

### Application Loads but Features Don't Work

**Check runtime logs**:
1. Go to Vercel project → Deployments
2. Click on deployment → "Functions" tab
3. Check logs for errors

**Common issues**:
- API errors → Check FORGE_API_KEY and APIFY_API_TOKEN
- Database errors → Verify migrations ran successfully
- 404 errors → Check vercel.json routing configuration

### Jobs Search Doesn't Return Results

**Possible causes**:
1. Apify API token invalid or expired
2. Apify rate limit reached
3. Network issues

**Solution**:
- Verify APIFY_API_TOKEN in environment variables
- Check Apify dashboard for API usage
- Try searching again after a few minutes

### Mock Interview AI Doesn't Respond

**Possible causes**:
1. Manus Forge API key invalid
2. API rate limit reached
3. Network timeout

**Solution**:
- Verify FORGE_API_KEY in environment variables
- Check Manus Forge dashboard for API usage
- Try again after a few minutes

## Environment Variables Reference

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Vercel Postgres dashboard |
| `FORGE_API_KEY` | Manus Forge API key for AI | https://manus.im |
| `APIFY_API_TOKEN` | Apify API token for job scraping | https://apify.com |
| `SESSION_SECRET` | Random string for session encryption | Generate random string |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (Vercel ignores this) | `3001` |

### Generating SESSION_SECRET

Use one of these methods:

```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 32

# Method 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Performance Optimization (Optional)

After successful deployment, consider these optimizations:

### 1. Enable Caching
- Vercel automatically caches static assets
- No configuration needed

### 2. Add Custom Domain
1. Go to project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 3. Monitor Performance
1. Go to project → Analytics
2. Review page load times
3. Check for errors

### 4. Set Up Alerts
1. Go to project → Settings → Notifications
2. Enable deployment notifications
3. Enable error alerts

## Next Steps

After deployment is successful:

1. **Test all features thoroughly** (use checklist above)
2. **Share the URL** with test users for feedback
3. **Monitor usage** in Vercel Analytics
4. **Track paywall conversions** (how many users click Subscribe)
5. **Gather user feedback** on pricing and features
6. **Iterate based on feedback**

## Getting Help

If you encounter issues not covered here:

1. **Check detailed guides**:
   - `VERCEL_DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
   - `MANUAL_GITHUB_UPLOAD_GUIDE.md` - GitHub upload instructions
   - `PROJECT_SUMMARY.md` - Complete project overview

2. **Check Vercel documentation**:
   - https://vercel.com/docs
   - https://vercel.com/docs/storage/vercel-postgres

3. **Check error logs**:
   - Vercel deployment logs
   - Browser developer console
   - Network tab for API errors

## Success Checklist

- [ ] Code uploaded to GitHub
- [ ] Vercel project created
- [ ] Environment variables configured
- [ ] Vercel Postgres database created
- [ ] Database migrations completed
- [ ] Application deployed successfully
- [ ] All features tested and working
- [ ] Custom domain added (optional)
- [ ] Analytics enabled
- [ ] Ready for user testing!

## Estimated Time

- **Total time**: 20-30 minutes
- **Step 1 (GitHub)**: 5 minutes
- **Step 2 (Vercel)**: 10 minutes
- **Step 3 (Database)**: 5 minutes
- **Step 4 (Deploy)**: 2-3 minutes
- **Testing**: 5-10 minutes

## What's Next?

Once deployed, you can:

1. **Validate MVP**: Share with users and gather feedback
2. **Track metrics**: Monitor search limit triggers and paywall views
3. **Iterate**: Based on user feedback, adjust pricing or features
4. **Implement payments**: Integrate Stripe/PayPal for real subscriptions
5. **Scale**: Add more features based on user demand

---

**🎉 Congratulations!** You're ready to deploy your Careerflow Clone application!

If you have any questions, refer to the detailed guides in the project files.

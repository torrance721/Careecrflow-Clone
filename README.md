# Careerflow Clone - Job Search & Mock Interview Platform

A full-stack web application that helps job seekers manage their job search process and practice mock interviews with AI. Built with React, TypeScript, Node.js, and includes paywall features for MVP validation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-22-green)

## 🌟 Features

### Core Features
- **User Authentication**: Secure registration and login system
- **Jobs Board**: Search and browse job listings with real-time scraping
- **Mock Interview**: AI-powered interview practice with feedback
- **Application Tracker**: Track job applications and their status
- **Resume Builder**: Create and export professional resumes
- **Company Research**: Access company information and insights

### Paywall Features (MVP)
- **Jobs Board Limit**: 3 free job searches per day
- **Mock Interview Unlock**: Blurred recommended companies section
- **Subscription Tiers**: Weekly ($9.9), Monthly ($19.9), Yearly ($79.9)
- **Upgrade Prompts**: Strategically placed upgrade buttons

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- pnpm (or npm/yarn)
- PostgreSQL database (or MySQL for local development)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Wangjiahui-mobi/Careecrflow-Clone.git
   cd Careecrflow-Clone
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and fill in your values
   ```

4. **Run database migrations**:
   ```bash
   pnpm drizzle-kit push
   ```

5. **Start development server**:
   ```bash
   pnpm dev
   ```

6. **Open in browser**:
   ```
   http://localhost:3000
   ```

## 📚 Documentation

- **[Quick Start Guide](QUICK_START_GUIDE.md)** - Get up and running in 20 minutes
- **[Deployment Guide](VERCEL_DEPLOYMENT_GUIDE.md)** - Deploy to Vercel with Postgres
- **[Project Summary](PROJECT_SUMMARY.md)** - Complete project overview
- **[GitHub Upload Guide](MANUAL_GITHUB_UPLOAD_GUIDE.md)** - Manual upload instructions

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Routing

### Backend
- **Node.js 22** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM
- **Express-session** - Authentication

### Database
- **PostgreSQL** - Production (Vercel Postgres)
- **MySQL** - Local development

### APIs & Services
- **Manus Forge API** - AI chat for mock interviews
- **Apify API** - Job scraping from LinkedIn

## 📁 Project Structure

```
Careerflow-Clone/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── layouts/     # Layout components
│   │   └── hooks/       # Custom hooks
├── server/              # Node.js backend
│   ├── agents/          # AI agent implementations
│   ├── routes/          # API routes
│   └── db.ts            # Database connection
├── db/                  # Database schema
│   ├── schema.ts        # Drizzle schema
│   └── migrations/      # Database migrations
└── shared/              # Shared code
```

## 🎯 Key Features Implementation

### Paywall Modal Component
Location: `client/src/components/PaywallModal.tsx`

Reusable modal component with three subscription tiers, used across:
- Jobs Board (after 3 searches)
- Mock Interview (unlock recommended companies)
- Sidebar upgrade button

### Jobs Board Search Limit
Location: `client/src/pages/JobsBoard.tsx`

- Tracks searches using localStorage
- Allows 3 free searches per day
- Resets at midnight
- Shows paywall on 4th search

### Mock Interview Blur Effect
Location: `client/src/pages/TopicPractice.tsx`

- Recommended companies section blurred by default
- Unlock button triggers paywall
- AI-powered interview conversation

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Run development server (frontend + backend)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Database commands
pnpm drizzle-kit generate  # Generate migrations
pnpm drizzle-kit push      # Push to database
pnpm drizzle-kit studio    # Open Drizzle Studio

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## 🌐 Deployment

### Deploy to Vercel

1. **Push code to GitHub**
2. **Import repository in Vercel**
3. **Add environment variables**
4. **Create Vercel Postgres database**
5. **Run migrations**
6. **Deploy!**

See [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🔑 Environment Variables

Required environment variables:

```bash
DATABASE_URL=your_database_connection_string
FORGE_API_KEY=your_manus_forge_api_key
APIFY_API_TOKEN=your_apify_api_token
SESSION_SECRET=your_random_session_secret
NODE_ENV=production
```

See `.env.example` for complete list.

## 🧪 Testing

### Local Testing Checklist
- [ ] User registration and login
- [ ] Jobs search with limit (3 searches)
- [ ] Paywall modal appears on 4th search
- [ ] Mock interview AI responds
- [ ] Recommended companies blur effect
- [ ] Unlock button triggers paywall
- [ ] Upgrade button in sidebar
- [ ] Subscribe button closes modal

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Jobs
- `GET /api/jobs` - List jobs
- `POST /api/jobs/search` - Search jobs
- `GET /api/jobs/:id` - Get job details

### Mock Interview
- `POST /api/mock-interview/start` - Start interview
- `POST /api/mock-interview/message` - Send message
- `GET /api/mock-interview/history` - Get history

## 🎨 UI/UX

- **Theme**: Dark mode with orange-red primary color (#FF5A36)
- **Language**: English
- **Responsive**: Mobile-friendly design
- **Accessibility**: WCAG 2.1 compliant

## 🚧 Known Limitations

1. **Fake Paywall**: Subscribe button doesn't process payments (MVP validation only)
2. **Search Limit**: Uses localStorage (resets if browser data cleared)
3. **Job Scraping**: Depends on Apify API availability
4. **AI Chat**: Depends on Manus Forge API availability

## 🔮 Future Enhancements

- [ ] Real payment processing (Stripe/PayPal)
- [ ] Backend-based search limit tracking
- [ ] Email notifications
- [ ] More resume templates
- [ ] Company reviews and ratings
- [ ] Job application analytics
- [ ] Referral system

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions or issues:
1. Check the [documentation files](/)
2. Review [Vercel deployment logs](https://vercel.com/docs)
3. Open an issue on GitHub

## 🙏 Acknowledgments

- Built with [Manus](https://manus.im) AI agent
- Job data powered by [Apify](https://apify.com)
- AI chat powered by [Manus Forge](https://manus.im)

---

**Status**: ✅ Ready for deployment
**Last Updated**: January 15, 2026

Made with ❤️ for job seekers everywhere

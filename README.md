# MintSite — AI Website Builder

> Describe a website in plain English and get a complete, responsive, multi-page site in seconds. Edit it by chatting, preview it on desktop / tablet / mobile, then publish to the community, GitHub Pages, or Vercel.

MintSite is a full-stack **MERN SaaS** with JWT + email-OTP authentication, a credit-based billing system powered by **Stripe Checkout**, and a **multi-provider LLM engine** (Gemini → Groq) with automatic failover, so a site is always returned even when a model is rate-limited or down.

---

## Features

### AI generation
- **Prompt → full website**: a short idea is first expanded into a structured design brief (brand, palette, fonts, pages, copy), then turned into a self-contained HTML/CSS site.
- **Conversational editing**: follow-up messages ("add a pricing page", "make it darker") modify the existing site. A *brand lock* keeps the brand name and topic stable across edits.
- **LLM cascade with failover**: walks a ranked list of Gemini and Groq models, retrying on transient errors (429/502/503/504), skipping dead models and exhausted quotas, and rejecting rejected API keys.
- **Safe save logic**: a failed, truncated or broken edit never overwrites a working site; users are only charged for complete, successful generations.
- **Offline fallback**: if no AI provider is available, a themed template generator produces a usable starter site.
- **Post-processing pipeline**: sanitizes links, strips AI-written router scripts, injects a lightweight page router, and adds defensive CSS so output stays responsive and never overlaps.
- **Real images**: placeholder keyword URLs are swapped for relevant Unsplash photos (cached, rate-limit aware).

### Live builder
- Chat panel + live iframe preview with **desktop / tablet / mobile** toggle.
- Sandboxed preview runtime that makes generated sites interactive: multi-page routing, working shopping cart (add / remove / quantity / total), forms with demo confirmations, mobile menu.
- Rename, auto-save, and **download as a standalone `.html` file**.

### Publish and share
- **Community gallery** with views, likes and sorting (new / most viewed / most liked).
- **One-click GitHub upload**: creates the repo, commits `index.html` + README, enables GitHub Pages (via Octokit).
- **One-click Vercel deploy** through the Vercel Deployments API.

### Accounts and billing
- Registration with **email OTP verification** (Brevo), login, forgot-password / reset flow, profile update, change password, delete account.
- **Credit system**: new users start with 20 credits; first build costs 5, each edit costs 2.
- **Stripe Checkout** credit packs (Starter / Popular / Pro) with idempotent payment verification and payment history.

---

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 6, React Router 6, Tailwind CSS 4, Axios, Lucide icons, react-hot-toast |
| Backend | Node.js, Express 4, Mongoose 8 (MongoDB), JWT, bcryptjs, Morgan, CORS |
| AI | Google Gemini and Groq (Llama 3.x) through OpenAI-compatible chat completion APIs |
| Integrations | Stripe, Brevo (transactional email), Unsplash API, GitHub API (Octokit), Vercel API |

---

## Architecture

```
React (Vite)  ──Axios + JWT──▶  Express API ──▶ MongoDB (Users, Projects, Payments)
     │                              │
     │ sandboxed iframe preview     ├─▶ LLM cascade: Gemini models → Groq models → offline template
     ▼                              ├─▶ Unsplash (image resolution)
 safePreview runtime                ├─▶ Stripe Checkout (credit purchases)
 (router, cart, forms)              ├─▶ Brevo (OTP emails)
                                    └─▶ GitHub Pages / Vercel (publishing)
```

Generation flow:

1. `POST /api/projects/:id/generate` checks the user's credits.
2. First build: the prompt is enhanced into a design brief. Edits: the raw request is used with the previous HTML and a brand lock.
3. `callLLM` walks the model cascade and returns the first good response.
4. The HTML is parsed, validated, post-processed and image-resolved.
5. It is saved and credits are charged only if the result is complete.

---

## Project structure

```
AI-Website-Builder/
├── backend/
│   ├── server.js                  # Express app entry (port 4000)
│   ├── config/db.js               # MongoDB connection
│   ├── middleware/auth.js         # JWT sign / requireAuth / optionalAuth
│   ├── models/                    # User, Project, Payment
│   ├── controllers/               # auth, projects, community, payments
│   ├── routes/                    # auth, authForgot, projects, projectDeploy, community, payments
│   └── utils/
│       ├── llm.js                 # prompts, LLM cascade, HTML post-processing, Unsplash resolver
│       ├── services.js            # generation orchestration, OTP email, Stripe, Vercel, GitHub
│       └── mockGenerator.js       # offline template fallback
└── frontend/
    └── src/
        ├── pages/                 # Landing, Login, Register, VerifyEmail, ForgotPassword,
        │                          # Dashboard, Builder, Preview, Community, Pricing, Settings
        ├── components/            # Navbar, Footer, ProtectedRoute, GitHub / Vercel modals
        ├── context/AuthContext.jsx
        └── utils/                 # api.js (Axios), safePreview.js (preview runtime)
```

---

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/register/verify`, `/register/resend`, `/login`; `GET/PATCH/DELETE /api/auth/me`; `PATCH /api/auth/me/password`; `/api/auth/forgot/request`, `/verify-code`, `/reset` |
| Projects | `GET/POST /api/projects`; `GET/PATCH/DELETE /api/projects/:id`; `POST /api/projects/:id/generate`, `/github`, `/deploy` |
| Community | `GET /api/community`, `GET /api/community/:id`, `POST /api/community/:id/like` |
| Payments | `GET /api/payments/packages`, `POST /api/payments/create-checkout-session`, `/verify-session`, `GET /api/payments/history` |

---

## Getting started

### Prerequisites
- Node.js 18+ (uses the built-in `fetch`)
- A MongoDB database (Atlas or local)
- At least one LLM key (Gemini or Groq). Without any key, the app falls back to the offline template generator.

### 1. Clone

```bash
git clone https://github.com/<your-username>/AI-Website-Builder.git
cd AI-Website-Builder
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
# Required
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=30d

# AI providers (at least one recommended)
GEMINI_API_KEY=
GROQ_API_KEY=

# Optional integrations
UNSPLASH_ACCESS_KEY=        # real relevant photos
BREVO_API_KEY=              # OTP emails (otherwise OTP is printed in the server console)
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=mintsite
STRIPE_SECRET_KEY=          # credit purchases
VERCEL_TOKEN=               # optional default token for deployments
```

Start the API:

```bash
npm start        # runs nodemon server.js on http://localhost:4000
```

### 3. Frontend

```bash
cd ../frontend
npm install
npm run dev      # http://localhost:5173
```

> The frontend calls `http://localhost:4000/api` (see `frontend/src/utils/api.js`) and the backend allows the `http://localhost:5173` origin (see `backend/server.js`). Update both when deploying.

### Useful scripts

| Where | Command | What it does |
|---|---|---|
| backend | `npm start` | Start the API with nodemon |
| frontend | `npm run dev` | Start the Vite dev server |
| frontend | `npm run build` | Production build |
| frontend | `npm run lint` | Run ESLint |

---

## Notes for development

- **No keys? Still works.** Without email keys, OTP codes are printed in the backend console; without LLM keys, the template generator is used.
- **Credits**: new users get 20 credits. Stripe verification is idempotent, so a payment is credited only once.
- **Security**: passwords are hashed with bcrypt, routes are protected with JWT, and project ownership is checked on every project route. Never commit your `.env` file.

---

## Roadmap ideas

- Stripe webhooks for payment confirmation
- Persist OTPs in Redis or MongoDB instead of in-memory
- Rate limiting and request validation middleware
- Custom domains and per-project analytics
- Export to a multi-file project (React / Next.js)

---

## License

Add a license of your choice (for example MIT).

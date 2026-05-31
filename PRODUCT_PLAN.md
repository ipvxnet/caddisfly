# Caddisfly - Website Refactoring Service
## Product Planning Document

**Domain**: caddisfly.ai
**Repository**: https://github.com/ipvxnet/caddisfly

---

## Product Vision

Caddisfly is a website refactoring service that uses AI and scraping to modernize customer websites. Customers can preview refactored versions of their sites, and upon purchase, receive hosting and their refactored code in a dedicated GitHub repository.

---

## Technical Stack

- **Frontend**: Cloudflare Workers (edge-rendered)
- **Storage**: Cloudflare R2 (scraped content, refactored sites)
- **Database**: Cloudflare D1 (user data, projects, purchases)
- **AI**: Cloudflare Workers AI (refactoring logic)
- **DNS**: Cloudflare DNS API (domain transfers)
- **GitHub**: GitHub API (customer repositories)
- **Scraping**: Workers-based scraping engine

---

## User Workflows

### Workflow 1: Admin - DNS Transfer Setup
**User**: Admin (you)
**Authentication**: Required

**Steps**:
1. Admin logs into admin portal
2. Admin enters customer website URL
3. System initiates DNS transfer process via Cloudflare API
4. System provides nameserver information for customer
5. Admin shares DNS change instructions with customer
6. System monitors DNS propagation status

**Required Cloudflare API Calls**:
- `POST /zones` - Create new zone for customer domain
- `GET /zones/:zone_id` - Check zone status
- `GET /zones/:zone_id/dns_records` - List DNS records
- `POST /zones/:zone_id/dns_records` - Create DNS records
- `GET /zones/:zone_id/activation_check` - Check if nameservers updated

**Data Stored (D1)**:
- Customer domain
- Zone ID
- DNS transfer status
- Nameserver information
- Admin user ID
- Timestamp

---

### Workflow 2: Public Preview (No Login Required)
**User**: Prospective customer
**Limits**: 2 pages maximum
**Authentication**: Not required

**Steps**:
1. User lands on caddisfly.ai
2. User enters:
   - Email address
   - Website URL to refactor
3. System scrapes up to 2 pages from their website
4. System uses Workers AI to refactor the pages
5. System saves scraped + refactored content to R2
6. System generates unique preview link
7. System emails preview link to user
8. Preview shows before/after comparison

**Data Stored**:
- **D1**:
  - Email
  - Original URL
  - Preview ID
  - Timestamp
  - Purchase status (pending)
  - Portfolio flag (false)
- **R2**:
  - `previews/{preview_id}/original/` - Scraped content
  - `previews/{preview_id}/refactored/` - Refactored site

**Preview Link Format**:
`https://caddisfly.ai/preview/{preview_id}`

---

### Workflow 3: Customer Purchase & Portfolio
**User**: Admin
**Authentication**: Required

**Steps**:
1. Admin marks customer as "purchased" in admin portal
2. System flags customer site for activation
3. Admin offers customer portfolio inclusion
4. If customer accepts:
   - Set portfolio flag to true
   - Display on portfolio page at `/portfolio`
5. Customer site goes live on their domain (after DNS transfer)

**Data Updates (D1)**:
- Update purchase status
- Update portfolio flag
- Add pricing tier
- Add purchase date

---

### Workflow 4: GitHub Repository Creation
**User**: System (automated)
**Trigger**: Customer purchase

**Steps**:
1. System creates new GitHub repository under your org
2. Repository name: `{customer-domain}-refactored`
3. System commits refactored code to repository
4. System grants customer read access (if they provide GitHub username)
5. Customer can fork/clone for further customization

**Required GitHub API Calls**:
- `POST /orgs/{org}/repos` - Create repository
- `PUT /repos/{owner}/{repo}/contents/{path}` - Add files
- `PUT /repos/{owner}/{repo}/collaborators/{username}` - Grant access

**Data Stored (D1)**:
- GitHub repository URL
- Customer GitHub username (optional)
- Repository creation timestamp

---

## Pricing Plans

### Starter Plan - $5/month
- Free website refactoring (static pages only)
- Cloudflare hosting included
- SSL certificate included
- Basic CDN
- **Limitations**: Static content only, no e-commerce, no AI workflows

### Plus Plan - $10/month
- Everything in Starter
- E-commerce support
- Contact forms
- Advanced CDN
- **Limitations**: No AI workflows

### Premium Plan - $20/month
- Everything in Plus
- AI-powered workflows (chatbots, search, recommendations)
- Advanced Workers AI features
- Priority support
- Custom AI integrations

---

## Technical Architecture

### Database Schema (D1)

```sql
-- Users table (admins only for now)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preview_id TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  original_url TEXT NOT NULL,
  status TEXT DEFAULT 'preview', -- preview, purchased, active
  pricing_tier TEXT, -- starter, plus, premium
  portfolio_included BOOLEAN DEFAULT 0,
  dns_zone_id TEXT,
  dns_status TEXT, -- pending, active, failed
  github_repo_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  purchased_at DATETIME,
  activated_at DATETIME
);

-- Scraped pages table
CREATE TABLE scraped_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  page_url TEXT NOT NULL,
  r2_original_path TEXT NOT NULL,
  r2_refactored_path TEXT NOT NULL,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- DNS records tracking
CREATE TABLE dns_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  record_type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  cloudflare_record_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### R2 Storage Structure

```
caddisfly-storage/
├── previews/
│   └── {preview_id}/
│       ├── original/
│       │   ├── index.html
│       │   ├── page2.html
│       │   └── assets/
│       └── refactored/
│           ├── index.html
│           ├── page2.html
│           └── assets/
└── production/
    └── {domain}/
        ├── index.html
        └── assets/
```

### Workers AI Integration

**Refactoring Workflow**:
1. Scrape HTML/CSS/JS from original site
2. Use Workers AI (@cf/meta/llama-3-8b-instruct or similar) to:
   - Analyze structure
   - Modernize HTML5 semantic elements
   - Optimize CSS (convert to Tailwind/modern CSS)
   - Improve accessibility
   - Optimize performance
3. Generate new code
4. Save to R2

**Prompt Template**:
```
You are a web development expert. Refactor the following HTML to use modern best practices:
- Use HTML5 semantic elements
- Implement accessible ARIA labels
- Optimize for performance
- Use modern CSS (Flexbox/Grid)
- Maintain the original design intent

Original HTML:
{scraped_html}

Provide only the refactored HTML, no explanations.
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up D1 database with schema
- [ ] Set up R2 bucket
- [ ] Implement basic authentication for admin
- [ ] Create admin login page
- [ ] Build database CRUD utilities

### Phase 2: Public Preview (Week 2)
- [ ] Build landing page with email/URL form
- [ ] Implement web scraping (limit 2 pages)
- [ ] Integrate Workers AI for refactoring
- [ ] Save to R2
- [ ] Generate preview links
- [ ] Build preview comparison page

### Phase 3: Admin Portal (Week 3)
- [ ] Build admin dashboard
- [ ] List all preview projects
- [ ] Implement purchase flagging
- [ ] Implement portfolio toggle
- [ ] Build portfolio public page

### Phase 4: DNS & Cloudflare Integration (Week 4)
- [ ] Integrate Cloudflare DNS API
- [ ] Implement zone creation
- [ ] DNS record management
- [ ] DNS status monitoring
- [ ] Nameserver instructions UI

### Phase 5: GitHub Integration (Week 5)
- [ ] Set up GitHub App/OAuth
- [ ] Implement repository creation
- [ ] Commit refactored code to repos
- [ ] Manage collaborator access
- [ ] Repository link in admin portal

### Phase 6: Pricing & Payments (Week 6)
- [ ] Integrate payment processor (Stripe recommended)
- [ ] Implement pricing tiers
- [ ] Subscription management
- [ ] Customer billing portal
- [ ] Upgrade/downgrade flows

### Phase 7: Production Hosting (Week 7)
- [ ] Route customer domains to Workers
- [ ] Serve sites from R2
- [ ] SSL certificate management
- [ ] CDN optimization
- [ ] Monitoring and analytics

### Phase 8: AI Workflows (Premium) (Week 8+)
- [ ] Chatbot integration
- [ ] AI-powered search
- [ ] Content recommendations
- [ ] Custom AI features per customer

---

## Open Questions & Decisions Needed

1. **Authentication Method**:
   - Option A: Simple email/password for admin (faster)
   - Option B: OAuth (GitHub/Google) for admin (more secure)
   - **Your preference?**

2. **Email Service**:
   - Option A: Cloudflare Email Workers (free, limited)
   - Option B: SendGrid/Mailgun (paid, reliable)
   - Option C: Resend (developer-friendly)
   - **Your preference?**

3. **Payment Processor**:
   - Option A: Stripe (most popular, well-documented)
   - Option B: Paddle (handles VAT/taxes globally)
   - **Your preference?**

4. **GitHub Organization**:
   - Will you use an existing org or create new one for customer repos?
   - **GitHub org name?**

5. **Scraping Limits**:
   - Free preview: 2 pages (confirmed)
   - After purchase: How many pages to scrape/refactor?
   - **Should this vary by pricing tier?**

6. **AI Model Selection**:
   - Workers AI has multiple models available
   - Text generation: @cf/meta/llama-3-8b-instruct (fast, good for code)
   - Should we use different models for different tasks?
   - **Your preference?**

7. **Domain Routing**:
   - After DNS transfer, customer sites should be served by your Worker
   - Should each customer get a separate Worker or use routing in main Worker?
   - **Preference for architecture?**

---

## Cloudflare API Requirements

### DNS API Permissions Needed
Your existing API token needs these additional permissions:
- `Zone - DNS - Edit`
- `Zone - Zone - Edit`
- `Zone - Zone Settings - Edit`

### API Token Scopes
Create a new API token with:
- **Permissions**:
  - Zone - DNS - Edit
  - Zone - Zone - Read
  - Zone - Zone - Edit
  - Account - Account Settings - Read
- **Zone Resources**: All zones
- **Account Resources**: Your account

---

## Next Steps

1. **Review this plan** - Confirm the workflows match your vision
2. **Answer open questions** - Help me make technical decisions
3. **Prioritize phases** - Which features are most critical?
4. **Start implementation** - Begin with Phase 1 or your priority

---

**Status**: Planning Phase
**Last Updated**: 2026-05-30
**Ready for**: Review & Implementation

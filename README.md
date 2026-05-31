# Caddisfly - Cloudflare Workers Hello World

A simple Hello World website deployed to Cloudflare Workers using GitHub Actions.

## Setup Instructions

### 1. Local Development

To test locally:

```bash
npm install
npm run dev
```

Visit `http://localhost:8787` to see your worker running locally.

### 2. GitHub Repository Setup

1. Create a new repository on GitHub
2. Push this code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 3. Cloudflare Configuration

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to "Workers & Pages"
3. Get your Account ID from the right sidebar
4. Create an API Token:
   - Go to "My Profile" → "API Tokens"
   - Click "Create Token"
   - Use the "Edit Cloudflare Workers" template
   - Copy the token (you won't see it again!)

### 4. GitHub Secrets Setup

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add the following secret:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Your API token from step 3

### 5. Deploy

Once you've set up the GitHub secret, any push to the `main` branch will automatically deploy your worker to Cloudflare!

## Manual Deployment

You can also deploy manually from your local machine:

```bash
npx wrangler login
npm run deploy
```

## Project Structure

```
.
├── src/
│   └── index.js          # Worker code
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions workflow
├── wrangler.toml         # Cloudflare Workers configuration
├── package.json
└── README.md
```

## Customization

Edit `src/index.js` to change what your worker returns. The GitHub Action will automatically deploy changes when you push to the main branch.

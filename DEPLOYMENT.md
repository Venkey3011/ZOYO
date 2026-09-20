# Deployment Guide for ZOYO

This guide covers deploying ZOYO to various cloud platforms and hosting providers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Platform-Specific Guides](#platform-specific-guides)
  - [Vercel](#vercel)
  - [Railway](#railway)
  - [Heroku](#heroku)
  - [Google Cloud Run](#google-cloud-run)
  - [AWS](#aws)
  - [DigitalOcean](#digitalocean)
- [Database Setup](#database-setup)
- [SSL/HTTPS](#ssl-https)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Working local development setup
- ✅ MongoDB Atlas account (optional, has fallback)
- ✅ Git repository with your code
- ✅ Domain name (optional but recommended)
- ✅ SSL certificate (most platforms provide free Let's Encrypt)

---

## Environment Variables

All platforms require these environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGODB_URI` | No* | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/zoyo` |
| `GEMINI_API_KEY` | No | Google Gemini API key | `AIza...` |
| `APP_URL` | Yes | Your app's public URL | `https://zoyo.app` |
| `NODE_ENV` | Yes | Environment mode | `production` |

*Falls back to in-memory mode if not provided

---

## Platform-Specific Guides

### Vercel

**Best for**: Frontend-focused apps with API routes

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Configure Project

Create `vercel.json` in project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### Step 3: Deploy

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Step 4: Add Environment Variables

Via Vercel Dashboard:
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add `MONGODB_URI`, `GEMINI_API_KEY`, `APP_URL`
4. Redeploy

---

### Railway

**Best for**: Full-stack apps with easy deployment

#### Step 1: Connect Repository

1. Visit [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Choose your repository

#### Step 2: Configure Build

Railway auto-detects Node.js projects. No configuration needed!

#### Step 3: Add Environment Variables

In Railway Dashboard:
1. Go to Variables tab
2. Add:
   ```
   MONGODB_URI=your_connection_string
   GEMINI_API_KEY=your_api_key
   NODE_ENV=production
   ```

#### Step 4: Deploy

Push to your connected branch:
```bash
git push origin main
```

Railway auto-deploys on push!

#### Step 5: Custom Domain (Optional)

1. Go to Settings → Domains
2. Add your domain
3. Update DNS records as instructed

---

### Heroku

**Best for**: Traditional app hosting

#### Step 1: Install Heroku CLI

```bash
# macOS
brew install heroku/brew/heroku

# Windows
# Download from heroku.com/downloads

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

#### Step 2: Login and Create App

```bash
heroku login
heroku create zoyo-voice-chat
```

#### Step 3: Add Buildpack

```bash
heroku buildpacks:set heroku/nodejs
```

#### Step 4: Set Environment Variables

```bash
heroku config:set MONGODB_URI="your_connection_string"
heroku config:set GEMINI_API_KEY="your_api_key"
heroku config:set NODE_ENV="production"
```

#### Step 5: Deploy

```bash
git push heroku main
```

#### Step 6: Scale Dynos

```bash
# Start with free tier
heroku ps:scale web=1

# View logs
heroku logs --tail
```

---

### Google Cloud Run

**Best for**: Containerized deployments with auto-scaling

#### Step 1: Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Step 2: Build and Push Image

```bash
# Set project ID
export PROJECT_ID=your-gcp-project-id

# Build image
docker build -t gcr.io/$PROJECT_ID/zoyo-app .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/zoyo-app
```

#### Step 3: Deploy to Cloud Run

```bash
gcloud run deploy zoyo-app \
  --image gcr.io/$PROJECT_ID/zoyo-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "MONGODB_URI=your_connection_string,NODE_ENV=production"
```

#### Step 4: Custom Domain

```bash
gcloud run domain-mappings create \
  --service zoyo-app \
  --domain zoyo.app \
  --region us-central1
```

---

### AWS (Elastic Beanstalk)

**Best for**: AWS ecosystem integration

#### Step 1: Install EB CLI

```bash
pip install awsebcli
```

#### Step 2: Initialize EB Application

```bash
eb init -p node.js zoyo-app --region us-east-1
```

#### Step 3: Create Environment

```bash
eb create zoyo-production
```

#### Step 4: Set Environment Variables

```bash
eb setenv MONGODB_URI="your_connection_string" \
         GEMINI_API_KEY="your_api_key" \
         NODE_ENV="production"
```

#### Step 5: Deploy

```bash
eb deploy
```

#### Step 6: Open Application

```bash
eb open
```

---

### DigitalOcean App Platform

**Best for**: Simple deployment with reasonable pricing

#### Step 1: Connect Repository

1. Visit [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect your GitHub repository

#### Step 2: Configure Build

DigitalOcean auto-detects configuration from `package.json`

Build Command: `npm run build`
Run Command: `npm start`

#### Step 3: Add Environment Variables

In App Settings → Environment Variables:
```
MONGODB_URI=your_connection_string
GEMINI_API_KEY=your_api_key
NODE_ENV=production
```

#### Step 4: Deploy

Click "Deploy" button. Subsequent pushes auto-deploy.

---

## Database Setup

### MongoDB Atlas

#### Step 1: Create Cluster

1. Visit [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free M0 cluster (512MB storage)
3. Choose cloud provider and region (closest to your users)

#### Step 2: Configure Network Access

1. Go to Network Access
2. Add IP Address
   - **Development**: Add your IP
   - **Production**: Add `0.0.0.0/0` (all IPs)

#### Step 3: Create Database User

1. Go to Database Access
2. Add New Database User
3. Choose "Password" authentication
4. Set username and strong password
5. Grant "Read and write to any database" role

#### Step 4: Get Connection String

1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy connection string
4. Replace `<password>` with your database password
5. Replace `<dbname>` with `zoyo` (or your preferred name)

Example:
```
mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/zoyo?retryWrites=true&w=majority
```

#### Step 5: Test Connection

```bash
# Add to .env locally
MONGODB_URI="your_connection_string"

# Run server
npm run dev

# Check console for:
# 🔌 Connected successfully to MongoDB Atlas!
```

---

## SSL/HTTPS

### Free SSL with Let's Encrypt

Most platforms provide automatic SSL:
- ✅ **Vercel**: Automatic
- ✅ **Railway**: Automatic
- ✅ **Heroku**: Automatic
- ✅ **Google Cloud Run**: Automatic
- ✅ **DigitalOcean**: Automatic

### Custom SSL Certificate

If you have a custom certificate:

1. Obtain certificate files:
   - `fullchain.pem` (certificate + intermediate)
   - `privkey.pem` (private key)

2. Upload via platform dashboard or CLI

---

## Post-Deployment

### Verify Deployment

```bash
# Check health
curl https://your-app-url.com/api/db-status

# Expected response:
# {"connected":true,"mode":"MongoDB Atlas"}
```

### Test Admin Login

1. Navigate to your deployed URL
2. Login with:
   - Username: `Admin`
   - Password: `Admin123`
3. Verify admin console access

### Create First Real User

1. Click "Create Account"
2. Fill in profile details
3. Complete registration
4. Login successfully

---

## Monitoring

### Application Logs

**Vercel:**
```bash
vercel logs
```

**Railway:**
View in Railway Dashboard → Logs tab

**Heroku:**
```bash
heroku logs --tail
```

**Google Cloud Run:**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Database Monitoring

MongoDB Atlas Dashboard:
1. Go to Metrics
2. Monitor:
   - Connections
   - Operation Execution Times
   - Document Metrics
   - Network Traffic

### Uptime Monitoring

Use services like:
- [UptimeRobot](https://uptimerobot.com) (Free)
- [Pingdom](https://pingdom.com)
- [StatusCake](https://statuscake.com)

Set up alerts for:
- ❌ Site down (HTTP 5xx)
- ⚠️ Slow response (>3s)
- 🔌 Database disconnection

---

## Troubleshooting

### Build Failures

**Error**: `Module not found`
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error**: `TypeScript compilation failed`
```bash
# Check TypeScript errors locally
npm run lint

# Fix errors and redeploy
```

### Runtime Errors

**Error**: `EADDRINUSE: port already in use`

Solution: Platform assigns port via `process.env.PORT`

Update `server.ts`:
```typescript
const PORT = process.env.PORT || 3000;
```

**Error**: `MongoDB connection failed`

Solutions:
1. Verify connection string format
2. Check IP whitelist in MongoDB Atlas
3. Confirm database user credentials
4. App will fallback to in-memory mode

### Performance Issues

**Slow Loading**

Optimize:
```bash
# Enable gzip compression
npm install compression

# Add to server.ts
import compression from 'compression';
app.use(compression());
```

**High Memory Usage**

Scale up:
- **Heroku**: `heroku ps:resize web=standard-1x`
- **Railway**: Upgrade plan
- **Google Cloud Run**: Increase memory limit

---

## Security Checklist

Before going live:

- [ ] Environment variables set correctly
- [ ] `NODE_ENV=production`
- [ ] HTTPS enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] MongoDB IP whitelist configured
- [ ] Strong database password
- [ ] Admin password changed
- [ ] Error messages sanitized
- [ ] Backup strategy in place

---

## Scaling

### Horizontal Scaling

**Google Cloud Run** (Auto-scales):
```bash
gcloud run services update zoyo-app \
  --max-instances 100 \
  --concurrency 80
```

**Heroku** (Manual scaling):
```bash
heroku ps:scale web=3
```

### Database Scaling

**MongoDB Atlas**:
1. Upgrade cluster tier (M0 → M10)
2. Enable sharding for large datasets
3. Add read replicas for read-heavy loads

---

## Backup & Recovery

### MongoDB Backups

**Automated** (MongoDB Atlas):
1. Go to Backup tab
2. Enable Cloud Backup
3. Set retention policy (daily snapshots)

**Manual** (using mongodump):
```bash
mongodump --uri="your_connection_string" --out=./backup
```

### Application Backup

```bash
# Backup entire repository
git clone https://github.com/yourusername/zoyo-app.git zoyo-backup

# Backup environment variables (store securely!)
# Never commit to version control
```

---

## Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run lint
    
    - name: Build
      run: npm run build
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'
```

---

## Cost Estimation

### Free Tier Options

| Platform | Free Tier | Limits |
|----------|-----------|--------|
| **Vercel** | Yes | 100GB bandwidth/month |
| **Railway** | $5 credit/month | ~500 hours runtime |
| **Heroku** | Yes | 550-1000 dyno hours/month |
| **MongoDB Atlas** | Yes | 512MB storage, M0 cluster |
| **Google Cloud Run** | Yes | 2M requests/month |

### Estimated Monthly Costs

**Small Scale** (< 1000 users):
- Hosting: $0-10
- Database: $0 (M0 tier)
- **Total**: $0-10/month

**Medium Scale** (1000-10000 users):
- Hosting: $20-50
- Database: $25 (M10 tier)
- **Total**: $45-75/month

**Large Scale** (10000+ users):
- Hosting: $100-500
- Database: $100+ (M30+ tier)
- CDN: $50
- **Total**: $250-650/month

---

## Support

Need help deploying?

- 📧 **Email**: deploy@zoyo.app
- 💬 **Discord**: [discord.gg/zoyo](https://discord.gg/zoyo)
- 📚 **Docs**: [docs.zoyo.app](https://docs.zoyo.app)

---

**Last Updated**: 2026-09-19
**Version**: 1.0

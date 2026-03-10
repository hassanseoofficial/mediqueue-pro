# Free Hosting Deployment Guide for MediQueue Pro

## Overview
This guide will help you deploy MediQueue Pro completely free using:
- **Database**: Supabase (Free tier - 500MB storage)
- **Backend**: Railway (Free tier - 500 hours/month) OR Render (Free tier)
- **Frontend**: Vercel (Free tier - unlimited)

---

## Step 1: Supabase Database Setup

### 1.1 Get Your Connection String
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **Database**
4. Find **Connection String** section
5. Select **URI** format
6. Copy the connection string (it looks like):
   ```
   postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with your actual password

### 1.2 Update Server Environment
The connection string has already been added to `server/.env`, but you may need to update it with the correct format from your dashboard.

### 1.3 Run Migrations
```bash
cd server
npm install
npm run migrate
```

This will create all necessary tables in your Supabase database.

### 1.4 Create Superadmin User
```bash
node src/db/create-superadmin.js
```

Follow the prompts to create your first superadmin account.

---

## Step 2: Backend Deployment (Railway - Recommended)

### 2.1 Sign Up for Railway
1. Go to https://railway.app
2. Sign up with GitHub (it's free)
3. You get 500 hours/month free (about $5 credit)

### 2.2 Deploy Backend
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Connect your GitHub account and select this repository
3. Railway will auto-detect it's a Node.js project
4. Click on the service → **Settings**:
   - **Root Directory**: `/server`
   - **Start Command**: `npm start`
   - **Build Command**: `npm install`

### 2.3 Add Environment Variables
In Railway, go to **Variables** tab and add:
```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
JWT_SECRET=7a9f8e2d4c6b1a3e5f7d9c8b2a4f6e1d3c5b7a9f8e2d4c6b1a3e5f7d9c8b2a4f
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_SECRET=9b8e7d6c5a4f3e2d1c9b8a7f6e5d4c3b2a1f9e8d7c6b5a4f3e2d1c9b8a7f6e5
REFRESH_TOKEN_EXPIRES_IN=30d
PORT=3001
NODE_ENV=production
CLIENT_URL=https://your-app.vercel.app
REDIS_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
FROM_EMAIL=noreply@mediqueue.app
```

### 2.4 Get Your Backend URL
After deployment, Railway will provide a URL like:
```
https://your-app.up.railway.app
```
Save this URL - you'll need it for the frontend!

---

## Step 3: Frontend Deployment (Vercel)

### 3.1 Sign Up for Vercel
1. Go to https://vercel.com
2. Sign up with GitHub (completely free)

### 3.2 Prepare Frontend for Production
Update `client/src/App.jsx` to use your Railway backend URL:

Find the Socket.IO connection (around line 20-30) and update:
```javascript
const socket = io('https://your-app.up.railway.app', {
  withCredentials: true
});
```

Update `client/vite.config.js` proxy settings:
```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://your-app.up.railway.app',
        changeOrigin: true
      }
    }
  }
})
```

### 3.3 Deploy to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3.4 Add Environment Variables (if needed)
In Vercel project settings → **Environment Variables**:
```env
VITE_API_URL=https://your-app.up.railway.app
```

### 3.5 Deploy
Click **Deploy** and wait 2-3 minutes. You'll get a URL like:
```
https://your-app.vercel.app
```

---

## Step 4: Update Backend CLIENT_URL

Go back to Railway and update the `CLIENT_URL` environment variable:
```env
CLIENT_URL=https://your-app.vercel.app
```

This allows CORS to work properly.

---

## Step 5: Test Your Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Try logging in with your superadmin credentials
3. Test creating a clinic, doctors, and queue tokens
4. Verify real-time updates work

---

## Alternative: Backend on Render (If Railway doesn't work)

### Render Setup
1. Go to https://render.com
2. Sign up (free tier available)
3. Click **New** → **Web Service**
4. Connect GitHub repo
5. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add all environment variables from Step 2.3
7. Deploy

---

## Troubleshooting

### Database Connection Issues
- Verify your Supabase connection string is correct
- Make sure you replaced `[YOUR-PASSWORD]` with the actual password
- URL-encode special characters in password (@ becomes %40)
- Check Supabase project is active

### Real-time Not Working
- Ensure `CLIENT_URL` in backend matches your Vercel URL exactly
- Check CORS settings in `server/src/index.js`
- Verify WebSocket connections aren't blocked by firewall

### Build Failures
- Run `npm install` in both `client` and `server` directories
- Check Node.js version (should be 18.x or higher)
- Review build logs for specific errors

---

## Cost Breakdown (All FREE!)

- **Supabase**: 500MB database, 2GB bandwidth/month
- **Railway**: 500 hours/month ($5 credit)
- **Vercel**: Unlimited deployments, 100GB bandwidth/month
- **Total Monthly Cost**: $0 🎉

---

## Security Notes for Production

1. **Change JWT Secrets**: Use strong random secrets (already done in .env)
2. **Enable SSL**: Railway and Vercel provide HTTPS automatically
3. **Rate Limiting**: Already configured in the backend
4. **Database Backups**: Supabase provides automatic daily backups
5. **Monitor Usage**: Check Railway/Vercel dashboards to stay within free tier

---

## Scaling Beyond Free Tier

When you grow:
- **Railway**: $5/month per service (pay as you grow)
- **Supabase**: $25/month for 8GB database
- **Vercel**: Free tier is generous, Pro is $20/month if needed

---

## Support

If you encounter issues:
1. Check deployment logs in Railway/Vercel
2. Review Supabase logs for database errors
3. Test locally first with `npm run dev`
4. Check this repository's issues/documentation

---

## Next Steps After Deployment

1. **Custom Domain**: Add your own domain in Vercel (free)
2. **Email**: Set up SendGrid for transactional emails (100 emails/day free)
3. **SMS**: Configure Twilio for SMS notifications (trial credits available)
4. **Redis**: Add Upstash Redis for better performance (free tier available)
5. **Monitoring**: Set up Sentry or LogRocket for error tracking

---

Congratulations! Your MediQueue Pro application is now live and accessible worldwide! 🚀

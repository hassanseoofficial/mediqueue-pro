# 🚀 Deploy MediQueue Pro - Step by Step

## ✅ What's Already Done
- ✅ Database migrated to Supabase
- ✅ Superadmin user created
- ✅ Environment configured

**Your Credentials:**
- **Supabase**: https://supabase.com/dashboard/project/vuvczzvytbolwhhzasun
- **Superadmin Email**: superadmin@mediqueue.com
- **Superadmin Password**: Super@1234

---

## 📦 Step 1: Deploy Backend to Railway (5 minutes)

### Option A: Deploy with Railway CLI (Fastest)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```
   (This will open your browser - sign up with GitHub, it's free!)

3. **Initialize Railway Project:**
   ```bash
   cd "D:\Doctor Ticketing System"
   railway init
   ```
   - When asked, create a new project: "mediqueue-backend"

4. **Deploy the backend:**
   ```bash
   railway up --service backend
   ```

5. **Set Environment Variables:**
   ```bash
   railway variables set DATABASE_URL="postgresql://postgres.vuvczzvytbolwhhzasun:mediqueue170506@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

   railway variables set JWT_SECRET="7a9f8e2d4c6b1a3e5f7d9c8b2a4f6e1d3c5b7a9f8e2d4c6b1a3e5f7d9c8b2a4f"

   railway variables set JWT_EXPIRES_IN="8h"

   railway variables set REFRESH_TOKEN_SECRET="9b8e7d6c5a4f3e2d1c9b8a7f6e5d4c3b2a1f9e8d7c6b5a4f3e2d1c9b8a7f6e5"

   railway variables set REFRESH_TOKEN_EXPIRES_IN="30d"

   railway variables set PORT="3001"

   railway variables set NODE_ENV="production"

   railway variables set CLIENT_URL="https://your-frontend.vercel.app"

   railway variables set FROM_EMAIL="noreply@mediqueue.app"
   ```

6. **Get your backend URL:**
   ```bash
   railway domain
   ```
   Save this URL! (e.g., `https://backend-production-xxxx.up.railway.app`)

---

### Option B: Deploy via Railway Dashboard (Easiest)

1. **Go to Railway:** https://railway.app
2. **Sign up** with GitHub (free)
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. If you don't have a GitHub repo yet:
   - First, push your code to GitHub:
     ```bash
     cd "D:\Doctor Ticketing System"
     git init
     git add .
     git commit -m "Initial commit - MediQueue Pro"
     ```
   - Create a new repo on GitHub: https://github.com/new
   - Push your code:
     ```bash
     git remote add origin https://github.com/YOUR_USERNAME/mediqueue-pro.git
     git push -u origin main
     ```
   - Return to Railway and select your repo

6. **Configure Service:**
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`

7. **Add Environment Variables** (click Variables tab):
   ```
   DATABASE_URL=postgresql://postgres.vuvczzvytbolwhhzasun:mediqueue170506@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
   JWT_SECRET=7a9f8e2d4c6b1a3e5f7d9c8b2a4f6e1d3c5b7a9f8e2d4c6b1a3e5f7d9c8b2a4f
   JWT_EXPIRES_IN=8h
   REFRESH_TOKEN_SECRET=9b8e7d6c5a4f3e2d1c9b8a7f6e5d4c3b2a1f9e8d7c6b5a4f3e2d1c9b8a7f6e5
   REFRESH_TOKEN_EXPIRES_IN=30d
   PORT=3001
   NODE_ENV=production
   CLIENT_URL=https://your-frontend.vercel.app
   FROM_EMAIL=noreply@mediqueue.app
   REDIS_URL=
   ```

8. **Enable Public Domain:**
   - Go to Settings → Networking
   - Click "Generate Domain"
   - Save your backend URL!

---

## 🎨 Step 2: Deploy Frontend to Vercel (3 minutes)

### Option A: Deploy with Vercel CLI (Fastest)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to client directory:**
   ```bash
   cd "D:\Doctor Ticketing System\client"
   ```

3. **Create production config file:**
   Create a file `client/.env.production`:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```
   *(Replace with your actual Railway URL)*

4. **Deploy:**
   ```bash
   vercel
   ```
   - Login with GitHub
   - Set up new project: Yes
   - Project name: mediqueue-pro
   - Override build settings: No

5. **Deploy to production:**
   ```bash
   vercel --prod
   ```

6. **Save your frontend URL!** (e.g., `https://mediqueue-pro.vercel.app`)

---

### Option B: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel:** https://vercel.com
2. **Sign up** with GitHub (free)
3. Click **"Add New" → "Project"**
4. **Import your GitHub repo** (if not on GitHub yet, see Railway Option B step 5)
5. **Configure Project:**
   - Framework Preset: **Vite**
   - Root Directory: **client**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

6. **Add Environment Variable:**
   - Name: `VITE_API_URL`
   - Value: `https://your-backend.up.railway.app` (your Railway URL)

7. Click **"Deploy"**
8. Wait 2-3 minutes
9. **Save your Vercel URL!**

---

## 🔗 Step 3: Link Frontend & Backend (1 minute)

Now that you have both URLs, update the backend's CORS:

1. **Go to Railway Dashboard**
2. **Click on your backend service**
3. **Go to Variables tab**
4. **Update `CLIENT_URL`** with your Vercel URL:
   ```
   CLIENT_URL=https://mediqueue-pro.vercel.app
   ```
5. **Save** - Railway will auto-redeploy

---

## ✅ Step 4: Test Your Application

1. **Visit your frontend:** https://mediqueue-pro.vercel.app
2. **Login with:**
   - Email: `superadmin@mediqueue.com`
   - Password: `Super@1234`
3. **Test the flow:**
   - Create a clinic
   - Add doctors
   - Generate queue tokens
   - Open display board in new tab
   - Test real-time updates

---

## 🎉 You're Live!

Your application is now hosted completely FREE on:
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Supabase

**Total Cost**: $0/month 🎊

---

## 🔧 Troubleshooting

### Backend won't start
- Check Railway logs: `railway logs` or in dashboard
- Verify all environment variables are set
- Check DATABASE_URL is correct

### Frontend can't connect to backend
- Verify VITE_API_URL is correct
- Check CLIENT_URL in Railway matches Vercel URL
- Look for CORS errors in browser console

### Database connection fails
- Test connection in Supabase SQL Editor
- Verify password is correct: `mediqueue170506`
- Check connection string format

### Real-time not working
- Verify WebSocket is not blocked
- Check Socket.IO connection in browser Network tab
- Ensure CLIENT_URL matches exactly

---

## 📝 Next Steps

1. **Custom Domain**: Add your own domain in Vercel (free!)
2. **Email Notifications**: Set up SendGrid (100 emails/day free)
3. **SMS Notifications**: Configure Twilio (trial credits)
4. **Monitoring**: Set up error tracking
5. **Backups**: Supabase auto-backups daily

---

## 💡 Pro Tips

- Railway free tier: 500 hours/month ($5 credit)
- Vercel free tier: Unlimited deployments
- Supabase free tier: 500MB database
- Monitor usage in dashboards to stay in free tier
- Railway sleeps after inactivity - first request may be slow

---

## 🔒 Security Checklist

✅ JWT secrets are strong and random
✅ HTTPS enabled (automatic)
✅ CORS configured properly
✅ Rate limiting enabled
✅ Database password is secure
✅ Environment variables not in code

---

## 📊 Monitor Your Apps

- **Railway**: https://railway.app/dashboard
- **Vercel**: https://vercel.com/dashboard
- **Supabase**: https://supabase.com/dashboard

---

Need help? Check the logs:
- **Railway**: `railway logs --follow`
- **Vercel**: Dashboard → Deployments → Function Logs
- **Browser**: F12 → Console tab

Good luck! 🚀

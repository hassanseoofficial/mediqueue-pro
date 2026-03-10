# Quick Deployment Guide - MediQueue Pro

## Your Supabase Details
- **Project**: mediqueue170506
- **Project URL**: https://vuvczzvytbolwhhzasun.supabase.co
- **Database Host**: db.vuvczzvytbolwhhzasun.supabase.co
- **Password**: mediqueue170506

---

## Step 1: Setup Database on Supabase

### Option A: Using Supabase SQL Editor (Recommended if local migration fails)

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/vuvczzvytbolwhhzasun
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `server/src/db/migrations/001_initial.sql` from this project
5. Copy ALL the SQL content and paste it into the Supabase SQL editor
6. Click **Run** or press `Ctrl+Enter`
7. Wait for it to complete (should take 10-20 seconds)
8. Verify tables are created: Click **Table Editor** and you should see tables like `clinics`, `doctors`, `tokens`, etc.

### Option B: Run Migration Locally (if you have network access)

```bash
cd server
npm install
npm run migrate
```

If you get a network error, use Option A above.

---

## Step 2: Create Superadmin User

After tables are created, create your first admin user:

### Option A: Using Supabase SQL Editor

Run this SQL in Supabase SQL Editor:

```sql
-- Create superadmin user
INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'superadmin',
  '$2a$10$YourHashedPasswordHere',  -- We'll generate this
  'superadmin',
  true,
  NOW(),
  NOW()
);
```

**To generate password hash:**
```bash
cd server
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('Admin@123', 10));"
```

Copy the output and replace `$2a$10$YourHashedPasswordHere` with it.

### Option B: Run Script Locally

```bash
cd server
node src/db/create-superadmin.js
```

Follow prompts to create your admin account.

**Default Credentials:**
- Username: `superadmin`
- Password: `Admin@123` (change this after first login!)

---

## Step 3: Deploy Backend to Railway

### 3.1 Sign Up & Install Railway CLI

1. Go to https://railway.app and sign up with GitHub
2. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```
3. Login:
   ```bash
   railway login
   ```

### 3.2 Deploy Backend

```bash
# Navigate to project root
cd "D:\Doctor Ticketing System"

# Initialize Railway project
railway init

# Link to Railway project
railway link

# Add environment variables
railway variables set DATABASE_URL="postgresql://postgres:mediqueue170506@db.vuvczzvytbolwhhzasun.supabase.co:5432/postgres"
railway variables set JWT_SECRET="7a9f8e2d4c6b1a3e5f7d9c8b2a4f6e1d3c5b7a9f8e2d4c6b1a3e5f7d9c8b2a4f"
railway variables set JWT_EXPIRES_IN="8h"
railway variables set REFRESH_TOKEN_SECRET="9b8e7d6c5a4f3e2d1c9b8a7f6e5d4c3b2a1f9e8d7c6b5a4f3e2d1c9b8a7f6e5"
railway variables set REFRESH_TOKEN_EXPIRES_IN="30d"
railway variables set PORT="3001"
railway variables set NODE_ENV="production"
railway variables set CLIENT_URL="https://your-app.vercel.app"
railway variables set REDIS_URL=""
railway variables set FROM_EMAIL="noreply@mediqueue.app"

# Deploy
railway up --service=backend
```

### 3.3 Alternative: Deploy via GitHub

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/mediqueue-pro.git
   git push -u origin main
   ```

2. In Railway dashboard:
   - Click **New Project** → **Deploy from GitHub repo**
   - Select your repository
   - Set **Root Directory**: `server`
   - Railway will auto-detect Node.js and deploy
   - Add all environment variables in the **Variables** tab

3. Get your Railway URL (looks like `https://backend-production-xxxx.up.railway.app`)

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 4.2 Update Frontend Configuration

Before deploying, update the API endpoint:

**Edit `client/vite.config.js`:**
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://your-backend.up.railway.app', // Replace with your Railway URL
        changeOrigin: true
      }
    }
  }
})
```

**Edit `client/src/main.jsx` or where Socket.IO is initialized:**
Look for `io('http://localhost:3001')` and replace with:
```javascript
const BACKEND_URL = import.meta.env.PROD
  ? 'https://your-backend.up.railway.app'  // Your Railway URL
  : 'http://localhost:3001';

const socket = io(BACKEND_URL, { withCredentials: true });
```

### 4.3 Deploy Frontend

```bash
# Navigate to project root
cd "D:\Doctor Ticketing System"

# Deploy with Vercel
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? mediqueue-pro
# - In which directory is your code? ./client
# - Override settings? Yes
#   - Build Command: npm run build
#   - Output Directory: dist
#   - Install Command: npm install

# Deploy to production
vercel --prod
```

### 4.4 Alternative: Deploy via GitHub

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variables (if needed):
   - `VITE_API_URL`: Your Railway backend URL
5. Click **Deploy**

---

## Step 5: Update CORS Configuration

After getting your Vercel URL, update the backend:

1. Go to Railway dashboard
2. Find your backend service
3. Update environment variable:
   ```
   CLIENT_URL=https://your-app.vercel.app
   ```
4. Railway will auto-redeploy

---

## Step 6: Test Your Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Login with superadmin credentials
3. Create a test clinic
4. Create a test doctor
5. Generate queue tokens
6. Test real-time updates by opening the display board

---

## Troubleshooting

### Migration Fails - Network Error
**Solution**: Use Supabase SQL Editor directly (see Step 1, Option A)

### CORS Error
**Solution**: Make sure `CLIENT_URL` in Railway matches your Vercel URL exactly (no trailing slash)

### WebSocket Connection Failed
**Solution**:
- Check that your backend URL is correct in frontend config
- Verify Railway service is running
- Check Railway logs for errors

### "Cannot connect to database"
**Solution**:
- Verify Supabase project is active
- Check connection string in Railway environment variables
- Try using connection pooling URL from Supabase dashboard

---

## Free Tier Limits

✅ **Supabase Free**: 500MB database, 2GB bandwidth/month
✅ **Railway Free**: $5 credit/month (~500 hours)
✅ **Vercel Free**: Unlimited deployments, 100GB bandwidth

---

## Next Steps After Deployment

1. **Custom Domain**: Add your domain in Vercel settings
2. **SSL**: Automatic with Railway & Vercel
3. **Monitoring**: Check Railway logs for backend, Vercel logs for frontend
4. **Database Backups**: Automatic with Supabase
5. **Email/SMS**: Configure SendGrid/Twilio for notifications

---

## Important URLs to Save

- **Frontend**: https://your-app.vercel.app
- **Backend**: https://your-backend.up.railway.app
- **Database**: Supabase Dashboard - https://supabase.com/dashboard/project/vuvczzvytbolwhhzasun

---

## Support

Having issues? Check:
- Railway logs: `railway logs`
- Vercel logs: Dashboard → Deployments → View logs
- Supabase logs: Dashboard → Logs

---

🎉 **Congratulations! Your MediQueue Pro is now live!**

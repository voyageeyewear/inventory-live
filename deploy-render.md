option 1 railway
# 🚀 Deploy to Render for Browser Access

## Quick Deployment Steps:

### 1. **Push to GitHub**
```bash
git add .
git commit -m "Add Render deployment config"
git push origin main
```

### 2. **Deploy on Render**
1. Go to https://render.com
2. Sign up/Login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm start`
   - **Environment**: Node
   - **Plan**: Free

### 3. **Add Database**
1. Click "New +" → "PostgreSQL"
2. Name: `inventory-db`
3. Plan: Free
4. Copy the connection string

### 4. **Set Environment Variables**
Add these in Render dashboard:
- `NODE_ENV` = `production`
- `DATABASE_URL` = `[your postgres connection string]`
- `POSTGRES_URL` = `[your postgres connection string]`
- `JWT_SECRET` = `inventory-jwt-secret-2024-secure-key`
- `NEXTAUTH_SECRET` = `inventory-nextauth-secret-2024`

### 5. **Deploy**
- Click "Deploy"
- Wait 5-10 minutes
- Get your public URL!

## 🎉 Result:
- ✅ Works in any browser
- ✅ Public HTTPS URL
- ✅ No restrictions
- ✅ Free hosting

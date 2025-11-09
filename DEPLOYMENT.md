# 🚀 Deployment Guide

## Backend (Heroku)

### ✅ Already Deployed
Your backend is running at: `https://arcane-fortress-69218-ec4429df10cc.herokuapp.com`

### 🔧 Important Notes:

1. **405 Error Explanation:**
   - The endpoint `/api/hunyuan/generate` only accepts **POST** requests
   - If you visit it in a browser (GET request), you'll get `405 Method Not Allowed`
   - This is **normal** - the endpoint works correctly with POST requests from the frontend

2. **CORS Configuration:**
   - ✅ **FIXED:** Backend now allows all origins in production (Heroku)
   - ✅ **FIXED:** Backend allows localhost:5173, localhost:5174, localhost:3000 for development
   - The CORS configuration automatically detects Heroku (via `DYNO` env var) and allows all origins
   - After deploying this update, CORS errors should be resolved

3. **Environment Variables on Heroku:**
   Make sure these are set in Heroku dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ELEVENLABS_API_KEY` (optional)
   - `DEDALUS_API_KEY` (optional)
   - `HUGGINGFACE_TOKEN` (optional)

---

## Frontend (Vercel)

### 📝 Step 1: Set Environment Variable

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** `https://arcane-fortress-69218-ec4429df10cc.herokuapp.com`
   - **Environment:** Production, Preview, Development (select all)

### 📝 Step 2: Redeploy

After adding the environment variable, **redeploy** your Vercel app:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment
- Or push a new commit to trigger auto-deploy

### 📝 Step 3: Verify

After deployment, check:
1. Open browser console on your Vercel app
2. Try generating a model
3. Check Network tab - the request should go to:
   ```
   https://arcane-fortress-69218-ec4429df10cc.herokuapp.com/api/hunyuan/generate
   ```

---

## Local Development

### Option 1: Use Heroku Backend (Recommended for Testing)

Create `.env.local` in `styled-pages/` directory:

```env
VITE_BACKEND_URL=https://arcane-fortress-69218-ec4429df10cc.herokuapp.com
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-key
```

### Option 2: Use Local Backend

If you want to run backend locally on port 8000:

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-key
```

**Important:** After creating `.env.local`, **restart your dev server** (`npm run dev`)

**Check:** Open browser console - you should see:
```
🔧 [Config] Using backend URL: https://arcane-fortress-69218-ec4429df10cc.herokuapp.com
```

---

## Testing the Backend

### ✅ Test Backend Health:
```bash
curl https://arcane-fortress-69218-ec4429df10cc.herokuapp.com/api/health
```

Should return: `{"status": "ok"}`

### ✅ Test Hunyuan Endpoint (POST):
```bash
curl -X POST https://arcane-fortress-69218-ec4429df10cc.herokuapp.com/api/hunyuan/generate \
  -F "userid=test-user-id" \
  -F "image=@test-image.jpg" \
  -F "caption=Test Model"
```

---

## Troubleshooting

### Issue: 405 Method Not Allowed
- **Cause:** Trying to GET the endpoint (browser visit)
- **Solution:** This is normal - endpoint only accepts POST

### Issue: CORS Error
- **Cause:** Backend not allowing your origin
- **Solution:** ✅ **FIXED** - Backend now allows all origins on Heroku. If you still see CORS errors:
  1. Make sure you've deployed the updated `app.py` to Heroku
  2. Check Heroku logs: `heroku logs --tail`
  3. Verify the CORS headers are being sent

### Issue: 503 Service Unavailable
- **Cause:** Heroku app is sleeping (free tier) or crashed
- **Solutions:**
  1. **Wake up the app:** Visit `https://arcane-fortress-69218-ec4429df10cc.herokuapp.com/api/health` in your browser
  2. **Check app status:** `heroku ps` (shows if dyno is running)
  3. **Check logs:** `heroku logs --tail` (see if app crashed)
  4. **Restart dyno:** `heroku restart`
  5. **Upgrade to paid tier:** Free tier dynos sleep after 30 min of inactivity

### Issue: Environment Variable Not Working
- **Cause:** Vercel needs redeploy after adding env var
- **Solution:** Redeploy your Vercel app

### Issue: Backend Returns 500
- **Cause:** Missing environment variables on Heroku
- **Solution:** Check Heroku dashboard → Settings → Config Vars

---

## Quick Checklist

- [ ] Backend deployed to Heroku ✅
- [ ] `VITE_BACKEND_URL` set in Vercel environment variables
- [ ] Vercel app redeployed after setting env var
- [ ] Backend environment variables set on Heroku
- [ ] Test health endpoint: `/api/health`
- [ ] Test model generation from Vercel frontend

---

**Your backend URL:** `https://arcane-fortress-69218-ec4429df10cc.herokuapp.com`


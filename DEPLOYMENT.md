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
   - Your backend uses `CORS(app)` which allows all origins
   - This should work with Vercel, but if you have issues, you can restrict it:
   ```python
   CORS(app, origins=["https://your-vercel-app.vercel.app"])
   ```

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

### For local development, create `.env.local` in `styled-pages/`:

```env
VITE_BACKEND_URL=http://localhost:8000
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-key
```

This will use localhost when running `npm run dev` locally.

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
- **Cause:** Backend not allowing Vercel origin
- **Solution:** Update CORS in `app.py`:
  ```python
  CORS(app, origins=["https://your-vercel-app.vercel.app", "http://localhost:5173"])
  ```

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


# Timeout Fix for 3D Model Generation

## ⏱️ The Problem

**Error:** `The read operation timed out`

**Cause:** 3D model generation takes 2-10+ minutes depending on quality settings, but the browser's default fetch timeout is much shorter (typically 120 seconds).

## ✅ The Solution

Implemented comprehensive timeout handling with:
1. **Extended timeout** - 10 minutes (600 seconds)
2. **Progress updates** - Every 30 seconds during generation
3. **Quality presets** - Fast/Balanced/High modes
4. **Better error handling** - Clear messages for timeout vs other errors

## 🎯 Key Changes

### 1. Extended Timeout with AbortController

```typescript
// Create AbortController with 10 minute timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
  updateStatus('⏱️ Request timeout - generation took too long (>10 minutes)');
}, 600000); // 10 minutes

const res = await fetch('http://localhost:8000/api/hunyuan/generate', {
  method: 'POST',
  body: formData,
  signal: controller.signal,  // ← Pass abort signal
});

clearTimeout(timeoutId); // Clear on success
```

### 2. Progress Updates

```typescript
// Show progress updates every 30 seconds
const progressInterval = setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  updateStatus(`⏳ Still generating... ${elapsed}s elapsed (this is normal for complex models)`);
}, 30000);

// Clear interval when done
clearInterval(progressInterval);
```

### 3. Quality Presets

Added 3 quality modes to give users control over speed vs quality tradeoff:

| Mode | Steps | Resolution | Chunks | Estimated Time | Use Case |
|------|-------|------------|--------|----------------|----------|
| **FAST** | 32 | 256 | 6000 | ~2 minutes | Quick preview, simple objects |
| **BALANCED** | 50 | 384 | 9000 | ~3 minutes | Default, good quality (recommended) |
| **HIGH** | 64 | 512 | 12000 | ~5+ minutes | Final quality, complex objects |

```typescript
const qualitySettings = {
  fast: {
    steps: 32,
    guidance_scale: 5.5,
    octree_resolution: 256,
    num_chunks: 6000,
    estimatedTime: '1-2 minutes'
  },
  balanced: {
    steps: 50,
    guidance_scale: 6.5,
    octree_resolution: 384,
    num_chunks: 9000,
    estimatedTime: '2-4 minutes'
  },
  high: {
    steps: 64,
    guidance_scale: 7.0,
    octree_resolution: 512,
    num_chunks: 12000,
    estimatedTime: '4-8 minutes'
  }
};
```

### 4. Enhanced Error Handling

```typescript
catch (error) {
  // Clear intervals if they exist
  if (timeoutId) clearTimeout(timeoutId);
  if (progressInterval) clearInterval(progressInterval);
  
  // Handle different error types
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      updateStatus('⏱️ Request timed out after 10 minutes');
      updateStatus('💡 Tip: Try with fewer views or lower quality settings');
    } else {
      updateStatus(`❌ Request failed: ${error.message}`);
    }
  }
}
```

## 🎨 UI Changes

Added quality selector above the generate button:

```
┌─────────────────────────────────────────┐
│  QUALITY:  [FAST (~2min)]               │
│           [BALANCED (~3min)] ← selected  │
│           [HIGH (~5min)]                 │
│                                          │
│        [GENERATE 3D MODEL]              │
└─────────────────────────────────────────┘
```

Users can:
- Click quality buttons before generating
- See estimated time for each mode
- Buttons are disabled during generation

## 📊 Timeline Comparison

### Before (Timeout Error):
```
0s   ████ Start generation
30s  ████████████ Working...
60s  ████████████████████ Working...
90s  ████████████████████████████ Working...
120s ❌ TIMEOUT ERROR (browser default)
```

### After (Extended Timeout):
```
0s    ████ Start generation
30s   ⏳ Update: "30s elapsed..."
60s   ⏳ Update: "60s elapsed..."
90s   ⏳ Update: "90s elapsed..."
120s  ⏳ Update: "120s elapsed..."
150s  ⏳ Update: "150s elapsed..."
180s  ✅ Success! (or continues up to 600s)
```

## 🧪 Testing

### Test Case 1: Fast Quality
1. Capture front view
2. Select "FAST" quality
3. Click generate
4. Should complete in ~2 minutes

### Test Case 2: High Quality
1. Capture all 4 views (front, back, left, right)
2. Select "HIGH" quality
3. Click generate
4. Should complete in ~5-8 minutes
5. Watch progress updates every 30s

### Test Case 3: Actual Timeout
1. If Hunyuan service is down/slow
2. After 10 minutes, should see:
   - "⏱️ Request timed out after 10 minutes"
   - "💡 Tip: Try with fewer views or lower quality settings"

## 💡 Tips for Users

### If You're Getting Timeouts:

1. **Try FAST quality first**
   - Much quicker
   - Good for testing/preview

2. **Use fewer views**
   - Front only = fastest
   - Front + Back = moderate
   - All 4 views = slowest but best quality

3. **Check Hunyuan service status**
   - The Hugging Face space might be busy
   - Try at different times of day

4. **Be patient**
   - 3D generation is computationally expensive
   - Progress updates show it's still working
   - Don't refresh the page!

## 🔧 Technical Details

### Timeout Values

- **Frontend fetch timeout:** 600,000ms (10 minutes)
- **Progress update interval:** 30,000ms (30 seconds)
- **Backend (Flask):** No timeout (relies on frontend)
- **Gradio client:** Uses default (very long)

### Why 10 Minutes?

- Hunyuan 3D generation typically takes 2-8 minutes
- High quality + all views can take longer
- 10 minutes gives plenty of buffer
- Shows clear error message if it exceeds

### Memory Cleanup

Both timeout and progress interval are properly cleaned up in:
- Success case: `clearTimeout()` / `clearInterval()`
- Error case: Catch block cleans up
- Abort case: Catch block handles `AbortError`

## 📝 Files Modified

1. **`PhotoCapture.tsx`**
   - Added `qualityMode` state
   - Added `AbortController` for timeout handling
   - Added progress interval
   - Added quality settings UI
   - Enhanced error handling

## 🎉 Result

- ✅ No more premature timeouts
- ✅ Users see progress during generation
- ✅ Clear control over speed vs quality
- ✅ Better error messages
- ✅ Proper resource cleanup

Users can now successfully generate high-quality 3D models without timing out! 🚀

## 🐛 Troubleshooting

### Still timing out after 10 minutes?

**Possible causes:**
1. Hunyuan service is overloaded/down
2. Network issues
3. Parameters are too aggressive

**Solutions:**
- Try FAST quality
- Use only front view
- Check Hugging Face status: https://huggingface.co/spaces/tencent/Hunyuan3D-2
- Wait and try again later

### Progress updates not showing?

**Check:**
- Browser console for errors
- Backend is running (`python app.py`)
- Network tab in DevTools shows ongoing request

### Quality selector not working?

**Verify:**
- Component state is updating (React DevTools)
- Parameters are being sent to backend (Network tab)
- Backend is using the parameters (check Flask logs)


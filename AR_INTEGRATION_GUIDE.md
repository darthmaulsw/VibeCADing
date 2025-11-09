# 🥽 AR Integration Complete!

## What Was Done

Merged WebXR/AR functionality from `webXR_styled` into `styled-pages` so you can view your generated 3D models in Augmented Reality!

---

## 📂 Files Added/Modified

### Files Copied from webXR_styled:
1. **`WebXRScene.tsx`** - Main AR scene component
2. **`XRControllerModelFactory.tsx`** - Controller models for AR
3. **`utils/modelLoader.ts`** - Model loading utilities

### Files Modified:
1. **`App.tsx`** - Added AR mode, AR button, WebXR session management

### Key Changes to WebXRScene:
```typescript
// Now accepts a modelUrl prop!
interface WebXRSceneProps {
  xrSession?: XRSession | null;
  modelUrl?: string; // ← NEW! Load any GLB URL
}

// Loads GLB from:
// 1. modelUrl prop (from PhotoCapture or database)
// 2. window.VIBECAD_LAST_GLB_URL (fallback)
// 3. Red cube (if no model found)
```

---

## 🎮 How to Use

### 1. Generate a Model
```
Landing → Photo Capture → Take Photos → Generate 3D Model
```

### 2. Enter AR Mode
```
Editor → Click [ENTER AR] button (top right)
```

### 3. View in AR
- **Point your phone/headset** at a surface
- **Model will appear** in AR space
- **Use VR controllers** to interact:
  - **Grab (both hands)** - Scale
  - **Right stick** - Rotate
  - **B button (right)** - Drag/move
  - **Y button (left)** - Open menu

### 4. Exit AR
```
Click [EXIT AR] button (top left)
```

---

## 🔧 AR Features

### Interactions:
- ✋ **Two-hand scaling** - Grab with both hands, move apart/together
- 🔄 **Right-stick rotation** - Rotate model with right controller stick
- 🎯 **Drag mode** - Hold B button (right controller) to drag
- 🎨 **Color picker** - Open menu (Y), select Color
- 📏 **Scale overlay** - Shows current scale when scaling
- 🔁 **Rotate overlay** - Shows rotation angle when rotating

### UI in AR:
- **3D radial menu** - Floats in front of left controller
- **3D color picker** - Interactive color wheel in AR
- **Scale/Rotate overlays** - Visual feedback for transformations

---

## 📱 Device Requirements

### Minimum Requirements:
- **WebXR-compatible device:**
  - Quest 2/3/Pro
  - Magic Leap
  - HoloLens 2
  - ARCore-enabled Android phones
  - ARKit-enabled iPhones (iOS 15.4+)

- **Browser:**
  - Chrome (Android)
  - Safari (iOS)
  - Quest Browser (Quest headsets)

### Testing:
```bash
# Must serve over HTTPS for WebXR
# Use ngrok or similar for mobile testing

# Desktop development (no AR, but code won't crash):
npm run dev
```

---

## 🎯 Code Flow

### PhotoCapture → AR:
```typescript
// 1. User generates model
PhotoCapture.generate3DModel()
  → Hunyuan API returns GLB URL
  → Sets window.VIBECAD_LAST_GLB_URL = url
  → Transitions to editor

// 2. User clicks [ENTER AR]
App.handleEnterAR()
  → Gets window.VIBECAD_LAST_GLB_URL
  → Requests XR session
  → setScreen('ar')
  → setArModelUrl(url)

// 3. WebXRScene renders
WebXRScene({ modelUrl: arModelUrl })
  → Loads GLB from URL
  → Centers and scales model
  → User interacts in AR
```

### Database → AR:
```typescript
// 1. User selects model from carousel
ModelCarousel.onSelect(model)
  → Sets window.VIBECAD_LAST_GLB_URL = model.glb_file_url
  → setScreen('editor')

// 2. User clicks [ENTER AR]
// Same flow as above!
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────┐
│  Photo Capture  │
└────────┬────────┘
         │ generates
         ↓
┌─────────────────┐
│   Hunyuan API   │
└────────┬────────┘
         │ returns GLB URL
         ↓
┌─────────────────────────┐
│ window.VIBECAD_LAST_GLB │ ← Global state
└──────┬──────────┬───────┘
       │          │
       │          │ also stored in
       │          ↓
       │     ┌─────────┐
       │     │Database │
       │     └────┬────┘
       │          │ loads from
       │          ↓
       │     ┌──────────┐
       │     │Carousel  │
       │     └────┬─────┘
       │          │ selects
       ↓          ↓
  ┌────────────────┐
  │ Editor Screen  │
  └────────┬───────┘
           │ clicks [ENTER AR]
           ↓
  ┌────────────────┐
  │  handleEnterAR │
  └────────┬───────┘
           │ requests XR session
           ↓
  ┌────────────────┐
  │  WebXRScene    │ ← Loads GLB in AR!
  └────────────────┘
```

---

## 🎨 UI Elements

### Editor Screen:
```
┌─────────────────────────────────────┐
│                      [ENTER AR] 📱  │ ← NEW!
│                                     │
│   ┌─────────────────────┐          │
│   │  3D Model Viewer    │          │
│   └─────────────────────┘          │
│                                     │
│  [Inspector]  [Controls]  [Menus]  │
└─────────────────────────────────────┘
```

### AR Screen:
```
┌─────────────────────────────────────┐
│  ❌ [EXIT AR]                       │ ← NEW!
│                                     │
│  ╔═════════════════╗                │
│  ║  AR Camera View ║                │
│  ║                 ║                │
│  ║  🎨 3D Model    ║                │
│  ║     in space    ║                │
│  ╚═════════════════╝                │
│                                     │
│  (Use VR controllers to interact)  │
└─────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### "WebXR not supported"
**Cause:** Browser/device doesn't support WebXR  
**Solution:** 
- Use Quest browser on Quest headset
- Use Chrome on Android with ARCore
- Use Safari on iOS 15.4+ with ARKit

### "No model loaded"
**Cause:** No GLB URL in `window.VIBECAD_LAST_GLB_URL`  
**Solution:** Generate or select a model first

### Model appears but can't interact
**Cause:** VR controllers not detected  
**Solution:** 
- Make sure controllers are turned on
- Check controller battery
- Restart XR session

### Model is too big/small in AR
**Cause:** Default scale is 1 meter max dimension  
**Solution:** Use two-hand scaling gesture in AR

### AR session ends immediately
**Cause:** Permission denied or feature not available  
**Solution:**
- Grant camera permission
- Check if device supports required features
- Try removing optional features from session request

---

## 🔧 Customization

### Change Default Model Size:
```typescript
// WebXRScene.tsx line 18
const START_MAX_SIZE_M = 1.0; // Change this (meters)
```

### Change Model Start Position:
```typescript
// WebXRScene.tsx line 619
container.position.set(0, 1.6, -1.5);
//                     ↑   ↑    ↑
//                     x   y    z
// Change -1.5 to place closer/farther
```

### Disable Certain Features:
```typescript
// App.tsx handleEnterAR()
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['hit-test'], // Remove 'dom-overlay' if issues
  optionalFeatures: ['local-floor'], // Remove unused features
});
```

---

## 📊 Performance Tips

### For Better Performance:
1. **Simplify models** - Fewer polygons = smoother AR
2. **Optimize textures** - Smaller textures load faster
3. **Test on device** - AR performance varies by device
4. **Close other apps** - Free up device resources

### Model Complexity:
- **Good:** < 50K polygons
- **OK:** 50K - 100K polygons
- **Slow:** > 100K polygons

---

## 🚀 Next Steps

### Optional Enhancements:
1. **Hit testing** - Place model on detected surfaces
2. **Anchors** - Persist model position between sessions
3. **Hand tracking** - Use hand gestures instead of controllers
4. **Occlusion** - Hide model behind real-world objects
5. **Lighting estimation** - Match real-world lighting

### To Add Hit Testing:
```typescript
// In WebXRScene.tsx
session.requestHitTestSource({ space: viewerSpace })
  .then(hitTestSource => {
    // Use hit test to place model on surfaces
  });
```

---

## 📖 Resources

- **WebXR API:** https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- **Three.js XR:** https://threejs.org/docs/#manual/en/introduction/How-to-use-WebXR
- **Quest Development:** https://developer.oculus.com/webxr/

---

## ✅ Summary

**You now have:**
- ✅ Full AR integration in styled-pages
- ✅ Loads generated GLB models in AR
- ✅ VR controller interactions (scale, rotate, move)
- ✅ 3D UI elements (menu, color picker)
- ✅ Enter/Exit AR buttons
- ✅ Works with PhotoCapture and database models

**Try it:**
1. Generate a model
2. Click [ENTER AR]
3. View in AR!

🎉 Happy AR modeling! 🥽


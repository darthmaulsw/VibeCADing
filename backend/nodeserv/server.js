const express = require("express");
const { createOpenSCAD } = require("openscad-wasm");
const fs = require("fs");
const path = require("path");

const app = express();

// CORS middleware for cross-origin requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "10mb" }));

// Create directories for generated files
const PUBLIC_DIR = path.join(__dirname, "public");
const GENERATED_DIR = path.join(PUBLIC_DIR, "generated");
fs.mkdirSync(GENERATED_DIR, { recursive: true });

// Serve static files (generated STL files)
app.use("/files", express.static(PUBLIC_DIR));

let openSCADPromise;

openSCADPromise = (async () => {
  try {
    console.log("[convert] Initializing OpenSCAD-WASM...");
    const mod = await createOpenSCAD({ noInitialRun: true });
    console.log("[convert] OpenSCAD-WASM initialized");
    return mod;
  } catch (err) {
    console.error("[convert] Failed to initialize OpenSCAD:", err);
    throw err;
  }
})();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "scad-converter" });
});

app.post("/convert-scad", async (req, res) => {
  const startTime = Date.now();
  try {
    const { scad, model_id, userid, stream: streamFlag } = req.body || {};
    
    if (!scad || typeof scad !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'scad' string" });
    }

    console.log(`[convert] Request: scad_length=${scad.length} model_id=${model_id || 'none'} stream=${!!streamFlag}`);
    console.log(`[convert] SCAD preview (first 500 chars):\n${scad.substring(0, 500)}\n...`);

    // Preprocess SCAD: Strip markdown code fences if present
    let processedScad = scad.trim();
    
    // Split into lines for robust fence detection
    let lines = processedScad.split('\n');
    
    // Remove opening code fence (```openscad, ```scad, or just ```)
    // Check first line - might have whitespace or different fence formats
    if (lines.length > 0 && lines[0].trim().startsWith('```')) {
      lines.shift(); // Remove first line
      console.log('[convert] Stripped opening markdown fence');
    }
    
    // Remove closing code fence (```)
    // Check last line - might have whitespace
    if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
      lines.pop(); // Remove last line
      console.log('[convert] Stripped closing markdown fence');
    }
    
    // Rejoin and trim
    processedScad = lines.join('\n').trim();
    
    console.log(`[convert] After fence removal (first 300 chars):\n${processedScad.substring(0, 300)}\n...`);
    
    // Fix 2: Look for variables used in assembly but defined in modules
    // Common pattern: translate([..., variable_name/2, ...]) where variable_name is in a module
    const usedVars = new Set();
    const varUsagePattern = /(\w+)\s*\/\s*2|translate\([^)]*(\w+)[^)]*\)/g;
    let match;
    while ((match = varUsagePattern.exec(processedScad)) !== null) {
      if (match[1]) usedVars.add(match[1]);
      if (match[2]) usedVars.add(match[2]);
    }
    
    // Find variable definitions inside modules
    const moduleVarDefs = [];
    const modulePattern = /module\s+(\w+)\s*\([^)]*\)\s*\{([^}]+)\}/gs;
    let moduleMatch;
    
    while ((moduleMatch = modulePattern.exec(processedScad)) !== null) {
      const moduleBody = moduleMatch[2];
      const varDefPattern = /^\s*(\w+)\s*=\s*([^;]+);/gm;
      let varMatch;
      
      while ((varMatch = varDefPattern.exec(moduleBody)) !== null) {
        const varName = varMatch[1];
        const varValue = varMatch[2].trim();
        
        // If this variable is used outside its module, extract it
        if (usedVars.has(varName)) {
          moduleVarDefs.push(`${varName} = ${varValue};`);
          console.log(`[convert] Hoisting variable: ${varName} = ${varValue}`);
        }
      }
    }
    
    // Prepend hoisted variables
    if (moduleVarDefs.length > 0) {
      const varsBlock = moduleVarDefs.join('\n');
      processedScad = `// Auto-hoisted variables from module scopes\n${varsBlock}\n\n${processedScad}`;
    }

    const scadModule = await openSCADPromise;
    
    if (!scadModule) {
      throw new Error("OpenSCAD module is undefined after initialization");
    }

    console.log("[convert] Rendering SCAD to STL...");
    const stlBuffer = await scadModule.renderToStl(processedScad);
    const bytes = stlBuffer.length || stlBuffer.byteLength || Buffer.byteLength(stlBuffer);
    console.log(`[convert] Render complete: ${bytes} bytes in ${Date.now() - startTime}ms`);

    // If stream flag is true, return raw STL buffer
    if (streamFlag) {
      console.log("[convert] Streaming STL response");
      res.setHeader("Content-Type", "application/sla");
      res.setHeader("Content-Disposition", "inline; filename=model.stl");
      return res.send(Buffer.from(stlBuffer));
    }

    // Otherwise, save to file and return JSON with URL
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileName = `model_${timestamp}_${randomId}.stl`;
    const filePath = path.join(GENERATED_DIR, fileName);
    
    fs.writeFileSync(filePath, Buffer.from(stlBuffer));
    console.log(`[convert] Saved: ${fileName}`);

    const fileUrl = `/files/generated/${fileName}`;
    res.json({
      status: "ok",
      url: fileUrl,
      bytes,
      format: "stl",
      model_id,
      ms: Date.now() - startTime
    });
  } catch (err) {
    console.error("[convert] Error:", err);
    console.error("[convert] Error stack:", err.stack);
    
    // Save failed SCAD code for debugging
    try {
      const debugFileName = `failed_${Date.now()}.scad`;
      const debugPath = path.join(GENERATED_DIR, debugFileName);
      fs.writeFileSync(debugPath, req.body.scad || 'NO SCAD CODE');
      console.error(`[convert] Failed SCAD saved to: ${debugFileName}`);
    } catch (saveErr) {
      console.error("[convert] Could not save failed SCAD:", saveErr);
    }
    
    // Try to provide more helpful error message
    let errorMessage = err.message || "conversion failed";
    if (typeof err === 'number') {
      errorMessage = `OpenSCAD compilation error code: ${err}. The SCAD code likely has syntax errors or undefined variables.`;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      hint: "Check Node server logs for SCAD code preview. Common issues: undefined variables, missing semicolons, invalid module calls."
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[convert] SCAD→STL service running on :${PORT}`));
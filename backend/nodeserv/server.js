const express = require("express");
const { createOpenSCAD } = require("openscad-wasm");
const stream = require("stream");

const app = express();
app.use(express.json({ limit: "10mb" }));

let openSCADPromise;

openSCADPromise = (async () => {
  try {
    console.log("Initializing OpenSCAD-WASM...");
    const mod = await createOpenSCAD({ noInitialRun: true });
    console.log("OpenSCAD-WASM initialized");
    return mod;
  } catch (err) {
    console.error("Failed to initialize OpenSCAD:", err);
    throw err;
  }
})();

app.post("/convert-scad", async (req, res) => {
  try {
    const scadText = req.body?.scad;
    if (!scadText || typeof scadText !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'scad' string" });
    }

    const scad = await openSCADPromise;
    
    if (!scad) {
      throw new Error("OpenSCAD module is undefined after initialization");
    }

    console.log("Rendering SCAD to STL...");
    const stlBuffer = await scad.renderToStl(scadText);

    console.log("Sending STL response...");
    res.setHeader("Content-Type", "application/sla");
    res.setHeader("Content-Disposition", "inline; filename=model.stl");
    const bufferStream = new stream.PassThrough();
    bufferStream.end(stlBuffer);
    bufferStream.pipe(res);
  } catch (err) {
    console.error("Conversion error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SCAD→STL service running on :${PORT}`));
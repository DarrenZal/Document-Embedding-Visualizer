// scripts/generate-initial-data.ts
import 'dotenv/config'; // Load .env for API keys
import * as fs from 'fs/promises';
import * as path from 'path';

// Assuming your compiled JS files will be in 'dist' and keep the .js extension
import { loadDocuments } from '../src/documentLoader.js';
import { generateEmbeddings } from '../src/embeddingGenerator.js';
import { reduceDimensions, UMAPOptions } from '../src/dimensionReducer.js';
import { generatePlotlyData } from '../src/visualizer.js';

const PREPOP_DIR = path.join(process.cwd(), 'pre-pop');
const SERVED_DOCS_DIR_NAME = 'served-docs'; // Directory name within public
const SERVED_DOCS_DIR = path.join(process.cwd(), 'public', SERVED_DOCS_DIR_NAME);
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'initial-plot-data.json');

async function generateInitialData() {
  console.log(`[generateInitialData] Starting pre-processing for directory: ${PREPOP_DIR}`);
  console.log(`[generateInitialData] Will copy files to: ${SERVED_DOCS_DIR}`);

  try {
    // --- Step 0: Prepare Served Directory ---
    console.log("[generateInitialData] Step 0: Preparing served documents directory...");
    await fs.mkdir(SERVED_DOCS_DIR, { recursive: true });
    const prepopFiles = await fs.readdir(PREPOP_DIR);
    for (const file of prepopFiles) {
        const sourcePath = path.join(PREPOP_DIR, file);
        const destPath = path.join(SERVED_DOCS_DIR, file);
        console.log(`[generateInitialData] Copying ${file} to ${SERVED_DOCS_DIR_NAME}...`);
        await fs.copyFile(sourcePath, destPath);
    }
    console.log("[generateInitialData] Finished copying files.");

    // --- Step 1: Load Documents (from the *served* directory) ---
    console.log(`[generateInitialData] Step 1: Loading documents from ${SERVED_DOCS_DIR}...`);
    let documents = await loadDocuments(SERVED_DOCS_DIR); // Load from the public copy
    if (documents.length === 0) {
      console.error(`[generateInitialData] No processable documents found in ${SERVED_DOCS_DIR}.`);
      process.exit(1);
    }
    console.log(`[generateInitialData] Loaded ${documents.length} documents.`);

    // --- Step 1b: Adjust filepaths to be web-relative ---
    console.log("[generateInitialData] Step 1b: Adjusting filepaths for web access...");
     documents = documents.map(doc => ({
         ...doc,
         // Replace the absolute path with the relative web path (NO leading slash)
         filepath: `${SERVED_DOCS_DIR_NAME}/${path.basename(doc.filepath)}`
     }));
     console.log("[generateInitialData] Adjusted filepaths:", documents.map(d => d.filepath));


    // --- Step 2: Generate Embeddings ---
    console.log("[generateInitialData] Step 2: Generating embeddings...");
    // Ensure the cache env var is set if running this outside Vercel context
    // (dotenv should handle LLAMA key, but TRANSFORMERS_CACHE might be needed if not set globally)
    if (!process.env.TRANSFORMERS_CACHE) {
        console.warn("[generateInitialData] TRANSFORMERS_CACHE env var not set, using default.");
        // Consider setting a default or requiring it: process.env.TRANSFORMERS_CACHE = '/tmp/transformers_cache';
    }
    const embeddings = await generateEmbeddings(documents);
    console.log(`[generateInitialData] Generated ${embeddings.length} embeddings.`);

    // 3. Reduce Dimensions
    console.log("[generateInitialData] Step 3: Reducing dimensions using UMAP...");
    const umapOptions: UMAPOptions = {}; // Use default options or customize
     if (embeddings.length <= 15) {
        console.warn(`[generateInitialData] Warning: Only ${embeddings.length} data points. Adjusting UMAP nNeighbors.`);
        if (embeddings.length < 3) {
            throw new Error("Need at least 3 data points for UMAP.");
        }
        umapOptions.nNeighbors = Math.max(2, Math.min(15, embeddings.length - 1));
        console.log(`[generateInitialData] Adjusted UMAP nNeighbors to ${umapOptions.nNeighbors}.`);
    }
    const reducedPoints = await reduceDimensions(embeddings, 3, umapOptions);
    console.log(`[generateInitialData] Reduced dimensions to ${reducedPoints.length} points.`);

    // 4. Generate Visualization Data
    console.log("[generateInitialData] Step 4: Generating visualization data...");
    const visualizationData = generatePlotlyData(documents, reducedPoints);
    console.log("[generateInitialData] Visualization data generated.");

    // 5. Save Data to File
    console.log(`[generateInitialData] Step 5: Saving data to ${OUTPUT_FILE}...`);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(visualizationData, null, 2)); // Pretty print JSON
    console.log("[generateInitialData] Successfully saved initial plot data.");

  } catch (error) {
    console.error("[generateInitialData] Error during pre-processing:", error);
    process.exit(1); // Exit with error code
  }
}

// Execute the function
generateInitialData();

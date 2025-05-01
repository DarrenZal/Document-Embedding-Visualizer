import express, { Express, Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs/promises'; // Needed for directory creation and cleanup
import { loadUploadedDocuments } from './documentLoader';
import { generateEmbeddings } from './embeddingGenerator';
import { reduceDimensions, UMAPOptions } from './dimensionReducer'; // Import UMAPOptions type
import { generatePlotlyData } from './visualizer';

// Determine upload directory based on environment
const IS_VERCEL = process.env.VERCEL === '1';
const UPLOAD_DIR = IS_VERCEL ? path.join('/tmp', 'input_docs') : path.join(process.cwd(), 'input_docs');
console.log(`[Server] Running on Vercel: ${IS_VERCEL}, Upload directory: ${UPLOAD_DIR}`); // Log environment

// Ensure the upload directory exists (especially needed for /tmp on Vercel)
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(err => {
    console.error(`[Server] Error creating upload directory ${UPLOAD_DIR}:`, err);
    // If running on Vercel and /tmp fails, something is very wrong.
    // Locally, permissions might be an issue.
});

// Configure multer for file uploads using disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR); // Save files to UPLOAD_DIR ('input_docs')
  },
  filename: function (req, file, cb) {
    // Use the original filename; multer handles sanitization/uniqueness if needed,
    // but for simplicity, we'll assume unique names or overwrite for now.
    // Consider adding unique IDs or timestamp if overwriting is an issue.
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

const app: Express = express();

// Serve static files (like index.html) from 'public' directory relative to project root
app.use(express.static(path.join(process.cwd(), 'public')));
// Serve generated visualizations from 'output' directory relative to project root
app.use('/output', express.static(path.join(process.cwd(), 'output')));
// Serve input documents from 'input_docs' directory relative to project root
app.use('/input_docs', express.static(path.join(process.cwd(), 'input_docs')));


// Basic route for the root path - serve the index.html file
app.get('/', (req: Request, res: Response) => {
  // Serve index.html from the public directory relative to project root
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

// File upload and processing endpoint - **Match the Vercel route /api/upload**
app.post('/api/upload', upload.array('documents'), async (req: Request, res: Response) => {
    console.log(`[Server] Reached POST /api/upload handler. Request path: ${req.path}`); // Add log
    const uploadedFiles = req.files as Express.Multer.File[];
    console.log('[Server] Received upload request with files:', uploadedFiles?.map(f => f.originalname));

    if (!uploadedFiles || uploadedFiles.length === 0) {
        res.status(400).send('No files were uploaded.');
        return;
    }

    try {
        // 1. Load Documents from uploaded files
        console.log(`Step 1: Loading documents from ${UPLOAD_DIR}...`);
        // loadUploadedDocuments reads from file.path provided by multer, which uses UPLOAD_DIR
        const documents = await loadUploadedDocuments(uploadedFiles);
        if (documents.length === 0) {
            console.log("No processable documents found in upload.");
            res.status(400).send("No processable documents (txt, md, pdf) were found in the upload.");
            return; // Exit early
        }
        console.log(`Loaded ${documents.length} documents.`);

        // 2. Generate Embeddings (Assuming this extracts discourse graphs internally or is the main content representation)
        console.log("Step 2: Generating embeddings...");
        const embeddings = await generateEmbeddings(documents);
        console.log(`Generated ${embeddings.length} embeddings.`);

        // 3. Reduce Dimensions
        console.log("Step 3: Reducing dimensions using UMAP...");
        const umapOptions: UMAPOptions = {};
        if (embeddings.length <= 15) {
            console.warn(`Warning: Only ${embeddings.length} data points. Adjusting UMAP nNeighbors.`);
            if (embeddings.length < 3) {
                throw new Error("Need at least 3 data points for UMAP."); // Throw error instead of just logging
            }
            umapOptions.nNeighbors = Math.max(2, Math.min(15, embeddings.length - 1));
            console.log(`Adjusted UMAP nNeighbors to ${umapOptions.nNeighbors}.`);
        }
        const reducedPoints = await reduceDimensions(embeddings, 3, umapOptions);
        console.log(`Reduced dimensions to ${reducedPoints.length} points.`);

        // 4. Generate Visualization Data (Plotly JSON)
        console.log("Step 4: Generating visualization data...");
        const visualizationData = generatePlotlyData(documents, reducedPoints);
        console.log("Visualization data generated.");

        // 5. Send back the visualization data
        res.status(200).json({ visualizationData });

    } catch (error) {
        console.error("Error processing uploaded files:", error);
        // Ensure temporary files are cleaned up even if an error occurs mid-pipeline
        // Files are now permanently saved by multer's diskStorage.
        // If an error occurs *during* processing a file, we might want to delete
        // the file that caused the error, but a general cleanup loop isn't needed
        // in the same way as with temporary files.
        // For now, leave the successfully saved files in input_docs even on error.
        // Error handling could be enhanced to remove the specific problematic file.
        res.status(500).send(`Server error during processing: ${error instanceof Error ? error.message : String(error)}`);
    }
});


// Export the app for testing
export { app };

// Export the app for Vercel
module.exports = app;

// Start the server only if this file is run directly (e.g., `node dist/server.js` or `ts-node src/server.ts`)
// This allows Vercel to import the 'app' object while still enabling local execution.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
    console.log(`Access the visualizer at http://localhost:${port}/`);
  });
}

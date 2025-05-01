import express, { Express, Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs/promises'; // Needed for directory creation and cleanup
import { loadUploadedDocuments } from './documentLoader';
import { generateEmbeddings } from './embeddingGenerator';
import { reduceDimensions, UMAPOptions } from './dimensionReducer'; // Import UMAPOptions type
import { generatePlotlyData } from './visualizer';


// Define the target directory for uploads
const UPLOAD_DIR = path.join(__dirname, '../input_docs');

// Ensure the upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error); // Create if not exists, ignore error if it does

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
const port = process.env.PORT || 3000;

// Serve static files (like index.html) from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));
// Serve generated visualizations from 'output' directory
app.use('/output', express.static(path.join(__dirname, '../output')));
// Serve input documents from 'input_docs' directory
app.use('/input_docs', express.static(path.join(__dirname, '../input_docs')));


// Basic route for the root path - serve the index.html file
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// File upload and processing endpoint
app.post('/upload', upload.array('documents'), async (req: Request, res: Response) => {
    const uploadedFiles = req.files as Express.Multer.File[];
    console.log('Received upload request with files:', uploadedFiles?.map(f => f.originalname));

    if (!uploadedFiles || uploadedFiles.length === 0) {
        res.status(400).send('No files were uploaded.');
        return;
    }

    try {
        // 1. Load Documents from uploaded files
        console.log("Step 1: Loading documents...");
        const documents = await loadUploadedDocuments(uploadedFiles); // This now handles temp file cleanup
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

// Start the server only if this file is run directly (not imported)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
}

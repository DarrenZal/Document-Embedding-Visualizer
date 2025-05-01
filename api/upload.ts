import type { NextApiRequest, NextApiResponse } from 'next'; // Vercel uses Next.js types
import path from 'path';
import multer from 'multer';
import fs from 'fs/promises';
import util from 'util'; // To promisify multer

// Add .js extension for ESM imports
import { loadUploadedDocuments } from '../src/documentLoader.js';
import { generateEmbeddings } from '../src/embeddingGenerator.js';
import { reduceDimensions, UMAPOptions } from '../src/dimensionReducer.js';
import { generatePlotlyData } from '../src/visualizer.js';

// Define Vercel's temporary directory for uploads
const UPLOAD_DIR = path.join('/tmp', 'input_docs_api'); // Use a distinct temp dir name

// Ensure the upload directory exists
// Use sync method here as it's simpler in this context, or handle promise rejection
try {
  fs.mkdir(UPLOAD_DIR, { recursive: true });
  console.log(`[api/upload] Ensured upload directory exists: ${UPLOAD_DIR}`);
} catch (err: any) {
  console.error(`[api/upload] FATAL: Could not create upload directory ${UPLOAD_DIR}:`, err);
  // If we can't create /tmp dir, the function can't proceed
  throw new Error(`Server setup failed: Could not create upload directory. ${err.message}`);
}

// Configure multer for file uploads using disk storage to /tmp
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use original filename
  }
});

const upload = multer({ storage: storage });

// Promisify the multer middleware
const runMiddleware = (req: NextApiRequest, res: NextApiResponse, fn: any) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// Disable Vercel's default body parser as multer needs the raw stream
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[api/upload] Function invoked. Method: ${req.method}`);

  if (req.method !== 'POST') {
    console.log(`[api/upload] Method not allowed: ${req.method}`);
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Run the multer middleware to handle file uploads
    // We need to cast req/res types slightly for multer compatibility here
    await runMiddleware(req, res, upload.array('documents'));
    console.log('[api/upload] Multer middleware finished.');

    // Access files from the extended NextApiRequest type after middleware
    const uploadedFiles = (req as NextApiRequest & { files: Express.Multer.File[] }).files;
    // Add type to map parameter to fix implicit any
    console.log('[api/upload] Received files:', uploadedFiles?.map((f: Express.Multer.File) => f.originalname));

    if (!uploadedFiles || uploadedFiles.length === 0) {
      console.log('[api/upload] No files were uploaded.');
      return res.status(400).send('No files were uploaded.');
    }

    // --- Start Processing Logic (copied from server.ts) ---
    console.log(`[api/upload] Step 1: Loading documents from ${UPLOAD_DIR}...`);
    const documents = await loadUploadedDocuments(uploadedFiles); // Reads from file.path in /tmp
    if (documents.length === 0) {
        console.log("[api/upload] No processable documents found in upload.");
        return res.status(400).send("No processable documents (txt, md, pdf) were found in the upload.");
    }
    console.log(`[api/upload] Loaded ${documents.length} documents.`);

    console.log("[api/upload] Step 2: Generating embeddings...");
    const embeddings = await generateEmbeddings(documents);
    console.log(`[api/upload] Generated ${embeddings.length} embeddings.`);

    console.log("[api/upload] Step 3: Reducing dimensions using UMAP...");
    const umapOptions: UMAPOptions = {};
    if (embeddings.length <= 15) {
        console.warn(`[api/upload] Warning: Only ${embeddings.length} data points. Adjusting UMAP nNeighbors.`);
        if (embeddings.length < 3) {
            throw new Error("Need at least 3 data points for UMAP.");
        }
        umapOptions.nNeighbors = Math.max(2, Math.min(15, embeddings.length - 1));
        console.log(`[api/upload] Adjusted UMAP nNeighbors to ${umapOptions.nNeighbors}.`);
    }
    const reducedPoints = await reduceDimensions(embeddings, 3, umapOptions);
    console.log(`[api/upload] Reduced dimensions to ${reducedPoints.length} points.`);

    console.log("[api/upload] Step 4: Generating visualization data...");
    const visualizationData = generatePlotlyData(documents, reducedPoints);
    console.log("[api/upload] Visualization data generated.");

    console.log("[api/upload] Step 5: Sending back visualization data...");
    return res.status(200).json({ visualizationData });
    // --- End Processing Logic ---

  } catch (error: any) {
    console.error("[api/upload] Error processing upload:", error);
    // Clean up uploaded files in /tmp on error? Maybe not necessary as /tmp is ephemeral.
    return res.status(500).send(`Server error during processing: ${error.message || String(error)}`);
  }
}

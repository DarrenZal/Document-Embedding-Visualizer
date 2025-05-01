import * as path from 'path';
import { loadDocuments } from './documentLoader';
import { generateEmbeddings } from './embeddingGenerator';
import { reduceDimensions } from './dimensionReducer';
import { create3DScatterPlot } from './visualizer';

// --- Configuration ---
const DEFAULT_INPUT_DIR = './input_docs'; // Default directory to look for documents
const DEFAULT_OUTPUT_FILE = './output/visualization.html'; // Default output HTML file path
// ---------------------

async function runPipeline(inputDir: string, outputFile: string) {
    console.log(`Starting pipeline...`);
    console.log(`Input directory: ${path.resolve(inputDir)}`);
    console.log(`Output file: ${path.resolve(outputFile)}`);

    try {
        // 1. Load Documents
        console.log("\nStep 1: Loading documents...");
        const documents = await loadDocuments(inputDir);
        if (documents.length === 0) {
            console.log("No documents found or loaded. Exiting.");
            return;
        }
        console.log(`Loaded ${documents.length} documents.`);

        // 2. Generate Embeddings
        console.log("\nStep 2: Generating embeddings...");
        // Note: This step can take time, especially on the first run as the model downloads.
        const embeddings = await generateEmbeddings(documents);
        console.log(`Generated ${embeddings.length} embeddings.`);

        // 3. Reduce Dimensions
        console.log("\nStep 3: Reducing dimensions using UMAP...");
        const umapOptions: import('./dimensionReducer').UMAPOptions = {}; // Declare umapOptions here
        // Ensure we have enough embeddings for UMAP default settings (nNeighbors=15)
        if (embeddings.length <= 15) {
             console.warn(`Warning: Only ${embeddings.length} data points found. UMAP may not produce meaningful results with default settings (requires > 15 points). Consider adding more documents or adjusting UMAP parameters.`);
             // Decide how to handle this - exit, proceed with caution, or adjust params?
             // For now, we'll proceed but the results might be poor.
             if (embeddings.length < 3) { // UMAP needs at least 3 points generally
                 console.error("Error: Need at least 3 data points for UMAP. Exiting.");
                  return;
              }
             // Dynamically adjust nNeighbors if data points are few
             umapOptions.nNeighbors = Math.max(2, Math.min(15, embeddings.length - 1));
             console.log(`Adjusted UMAP nNeighbors to ${umapOptions.nNeighbors} due to low data count.`);
         }
         const reducedPoints = await reduceDimensions(embeddings, 3 /* target dimensions */, umapOptions);
         console.log(`Reduced dimensions to ${reducedPoints.length} points.`);

         // 4. Create Visualization
         console.log("\nStep 4: Creating 3D scatter plot...");
         // Pass the original documents and the reduced points
         await create3DScatterPlot(documents, reducedPoints, outputFile);
         console.log(`Visualization saved to ${outputFile}`);

        console.log("\nPipeline finished successfully!");

    } catch (error) {
        console.error("\nPipeline failed:", error);
        process.exitCode = 1; // Indicate error exit
    }
}

// --- Main Execution ---
// Get input/output paths from command line arguments or use defaults
const inputDirectory = process.argv[2] || DEFAULT_INPUT_DIR;
const outputFilepath = process.argv[3] || DEFAULT_OUTPUT_FILE;

runPipeline(inputDirectory, outputFilepath);
// ----------------------

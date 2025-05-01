// Remove static imports for transformers
// import { pipeline, env, Pipeline } from '@xenova/transformers';
import { Document } from './documentLoader'; // Import the Document type

// Define the expected function signature for the feature extraction pipeline
// Note: We might not need the Pipeline type directly anymore if only using dynamic import
// It takes text or array of text, options, and returns embeddings
type FeatureExtractionPipeline = (
    texts: string | string[],
    options?: { pooling?: 'mean'; normalize?: boolean }
) => Promise<Array<{ embedding: Float32Array }> | { embedding: Float32Array }>;


// Singleton instance for the pipeline
let extractor: FeatureExtractionPipeline | null = null;

// Function to get or initialize the pipeline
async function getExtractor(): Promise<FeatureExtractionPipeline> {
    if (extractor === null) {
        console.log('Initializing feature extraction pipeline...');
        // Dynamically import the transformers library
        const { pipeline, env } = await import('@xenova/transformers');

        // Configure Transformers.js environment inside the async function
        // to ensure it runs after the import
        env.allowLocalModels = true;
        env.useBrowserCache = false; // Disable browser cache for Node.js environment

        // Load the model for sentence embeddings
        // Use Xenova/all-MiniLM-L6-v2 for good performance/quality balance
        extractor = (await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            {
                // Optional: Add progress callback if needed
                 // progress_callback: (progress: any) => console.log(progress),
            }
        )) as unknown as FeatureExtractionPipeline; // Cast needed as pipeline() returns a general type
        console.log('Pipeline initialized.');
    }
    return extractor;
}

// Function to generate embeddings for documents
export async function generateEmbeddings(documents: Document[]): Promise<Float32Array[]> {
    if (!documents || documents.length === 0) {
        return []; // Return empty array if no documents are provided
    }

    // Get the feature extraction pipeline
    const extractorInstance = await getExtractor();

    // Extract content from documents
    const contents = documents.map(doc => doc.content);

    // Handle case where all documents might have empty content after processing
    if (contents.every(c => !c.trim())) {
        console.warn("All documents have empty content. Returning empty embeddings.");
        // Return arrays of the correct dimension filled with zeros or handle as appropriate
        const embeddingDim = 384; // Or get dynamically if possible
        return documents.map(() => new Float32Array(embeddingDim).fill(0));
    }


    console.log(`Generating embeddings for ${documents.length} documents...`);

    // Generate embeddings in batch
    // Use pooling='mean' and normalize=true for sentence embeddings
    const output = await extractorInstance(contents, { pooling: 'mean', normalize: true });

    let embeddings: Float32Array[];

    // Check if the output is a Tensor (batch processing often returns this)
    // The actual structure might vary slightly based on transformers.js version,
    // but typically it has a 'data' property (Float32Array) and 'dims'.
    if (output && typeof output === 'object' && 'data' in output && 'dims' in output && output.data instanceof Float32Array) {
        const tensorData = output.data as Float32Array;
        const dims = output.dims as number[]; // e.g., [num_embeddings, embedding_dim]

        if (dims.length === 2 && dims[0] === documents.length) {
            const numEmbeddings = dims[0];
            const embeddingDim = dims[1];
            embeddings = [];
            for (let i = 0; i < numEmbeddings; i++) {
                // Extract each embedding vector from the flat tensor data
                const start = i * embeddingDim;
                const end = start + embeddingDim;
                embeddings.push(tensorData.slice(start, end));
            }
        } else {
             console.error("Unexpected Tensor dimensions from pipeline:", dims);
             throw new Error("Failed to parse Tensor output from embedding pipeline.");
        }

    } else if (Array.isArray(output)) {
         // Handle case where it might return an array of objects (like the mock did)
         try {
            embeddings = output.map((result: any) => result.embedding as Float32Array);
         } catch (e) {
             console.error("Failed to process array output from pipeline:", output, e);
             throw new Error("Unexpected array structure from embedding pipeline.");
         }
    }
     else {
        console.error("Unexpected output type from embedding pipeline:", output);
        throw new Error("Unexpected output type from embedding pipeline.");
    }


    console.log(`Generated ${embeddings.length} embeddings.`);
    return embeddings;
}

// Helper function to normalize embeddings (can be removed if normalize:true is used in pipeline)
function normalizeEmbedding(embedding: number[] | Float32Array): Float32Array {
    const vector = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector; // Avoid division by zero
    return vector.map(val => val / norm);
}

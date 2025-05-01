import { UMAP } from 'umap-js';

// Define optional parameters for UMAP
export interface UMAPOptions {
    nNeighbors?: number;
    minDist?: number;
    spread?: number;
    // Add other relevant UMAP parameters here if needed
}

// Function to reduce dimensions using UMAP
export async function reduceDimensions(
    embeddings: Float32Array[],
    nComponents: number = 3, // Default to 3 dimensions
    options: UMAPOptions = {}
): Promise<number[][]> {

    if (!embeddings || embeddings.length === 0) {
        return [];
    }

    // UMAP often requires more data points than nNeighbors + 1
    const nNeighbors = options.nNeighbors ?? 15; // Default UMAP value or a safe one
    if (embeddings.length <= nNeighbors) {
         throw new Error(`Insufficient data points (${embeddings.length}) for UMAP with nNeighbors=${nNeighbors}. Need at least ${nNeighbors + 1}.`);
    }

    console.log(`Reducing dimensions for ${embeddings.length} embeddings to ${nComponents} components using UMAP...`);

    // Convert Float32Array embeddings to plain number arrays for umap-js
    const embeddingsArray = embeddings.map(e => Array.from(e));

    // Initialize UMAP
    const umap = new UMAP({
        nComponents: nComponents,
        nNeighbors: options.nNeighbors ?? 15, // Use provided or default
        minDist: options.minDist ?? 0.1,     // Use provided or default
        spread: options.spread ?? 1.0,       // Use provided or default
        // Add other parameters as needed
    });

    // Fit the data (synchronous)
    umap.initializeFit(embeddingsArray);

    // Get the embedding (synchronous)
    const reducedEmbedding = umap.getEmbedding();

    console.log(`UMAP reduction complete. Output dimensions: ${reducedEmbedding.length} x ${reducedEmbedding[0]?.length}`);

    return reducedEmbedding;
}

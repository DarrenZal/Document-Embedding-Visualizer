// Keep Document import at top
import { Document } from '../documentLoader';

// Define the mock pipeline function at the top level
const mockPipeline = jest.fn().mockImplementation(async (text: string | string[]) => {
  // Simulate embedding generation: return a fixed-size array of numbers
  // based on input type (string or array of strings)
  const embeddingDim = 384; // Example dimension for MiniLM
  if (Array.isArray(text)) {
    return text.map((_, idx) => ({
      embedding: new Float32Array(embeddingDim).fill(0.1 * (idx + 1)),
    }));
  } else {
    return { embedding: new Float32Array(embeddingDim).fill(0.5) };
  }
});

// Declare the variable for the function under test
let generateEmbeddings: typeof import('../embeddingGenerator').generateEmbeddings;

describe('embeddingGenerator', () => {
  // Apply the mock before tests run, after initial module load
  beforeAll(() => {
    jest.doMock('@xenova/transformers', () => ({
      __esModule: true, // Indicate it's an ES module
      pipeline: jest.fn().mockResolvedValue(mockPipeline),
      env: {
        allowLocalModels: true,
        useBrowserCache: false,
      }
    }));
  });

  // Reset mocks and dynamically import the module *after* mocking
  beforeEach(async () => {
    // Reset mocks
    mockPipeline.mockClear();
    // Need to reset the mock function created by jest.doMock if possible,
    // or ensure the module is re-imported cleanly.
    // Re-importing ensures we get the version with the mock applied.
    jest.resetModules(); // Crucial to clear cache and re-import with mock
    generateEmbeddings = (await import('../embeddingGenerator')).generateEmbeddings;
    // Clear the pipeline mock specifically if needed after re-import
     const transformers = require('@xenova/transformers');
     if (transformers.pipeline.mockClear) {
        transformers.pipeline.mockClear();
     }
  });

  afterAll(() => {
    jest.unmock('@xenova/transformers'); // Clean up mock
  });


  const sampleDocuments: Document[] = [
    { filepath: 'doc1.txt', content: 'This is text document 1.', filetype: 'txt' },
    { filepath: 'doc2.md', content: '## Markdown Content', filetype: 'md' },
    { filepath: 'doc3.pdf', content: 'PDF text content here.', filetype: 'pdf' },
  ];

  // No longer need beforeEach for clearing mocks here as resetModules handles it

  it('should initialize the feature-extraction pipeline on first call', async () => {
    await generateEmbeddings(sampleDocuments);
    expect(require('@xenova/transformers').pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2', // Ensure this matches the model used in implementation
      expect.any(Object) // Allow for progress callback or other options
    );
    expect(require('@xenova/transformers').pipeline).toHaveBeenCalledTimes(1);

    // Call again to ensure pipeline is reused (not called again)
    await generateEmbeddings([sampleDocuments[0]]);
     expect(require('@xenova/transformers').pipeline).toHaveBeenCalledTimes(1);
  });

  it('should generate an embedding for each document', async () => {
    const embeddings = await generateEmbeddings(sampleDocuments);
    expect(embeddings).toHaveLength(sampleDocuments.length);
    expect(mockPipeline).toHaveBeenCalledTimes(1); // Called once with the array of contents
    expect(mockPipeline).toHaveBeenCalledWith(sampleDocuments.map(d => d.content), { pooling: 'mean', normalize: true });
  });

  it('should return embeddings as Float32Array', async () => {
    const embeddings = await generateEmbeddings(sampleDocuments);
    embeddings.forEach(emb => {
      expect(emb).toBeInstanceOf(Float32Array);
      expect(emb.length).toBe(384); // Check dimension matches mock
    });
  });

   it('should handle an empty document list', async () => {
    const embeddings = await generateEmbeddings([]);
    expect(embeddings).toEqual([]);
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it('should handle documents with empty content (though ideally filtered earlier)', async () => {
     const docsWithEmpty: Document[] = [
        { filepath: 'empty.txt', content: '', filetype: 'txt' },
        sampleDocuments[0]
     ];
    const embeddings = await generateEmbeddings(docsWithEmpty);
    expect(embeddings).toHaveLength(docsWithEmpty.length);
    // Check that the mock pipeline was called with the content, including empty string
    expect(mockPipeline).toHaveBeenCalledWith(docsWithEmpty.map(d => d.content), expect.any(Object));
    // Check the structure of returned embeddings (mock returns valid arrays even for empty)
    expect(embeddings[0]).toBeInstanceOf(Float32Array);
    expect(embeddings[1]).toBeInstanceOf(Float32Array);
  });

});

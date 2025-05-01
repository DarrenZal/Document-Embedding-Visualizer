import request from 'supertest';
import { app } from '../server.js'; // Add .js extension
import { jest } from '@jest/globals'; // Import Jest object for mocking

import { Document } from '../documentLoader.js'; // Add .js extension

// Mock the embeddingGenerator module
jest.mock('../embeddingGenerator', () => ({
  // Make the mock return embeddings based on input documents
  generateEmbeddings: jest.fn<(docs: Document[]) => Promise<number[][]>>()
    .mockImplementation(async (docs: Document[]) => {
      // Return one mock embedding vector for each document received
      return docs.map((_, index) => [index * 0.1, index * 0.2, index * 0.3]);
  }),
}));

// Mock the dimensionReducer module as well, as it might depend on specific embedding formats
// or could also cause issues if it has complex dependencies.
import { UMAPOptions } from '../dimensionReducer.js'; // Add .js extension

// Let's assume it returns 3D points based on the number of embeddings.
jest.mock('../dimensionReducer', () => ({
  // Make the mock return points based on input embeddings
  reduceDimensions: jest.fn<(embeddings: Float32Array[], nComponents?: number, options?: UMAPOptions) => Promise<number[][]>>()
    .mockImplementation(async (embeddings: Float32Array[], dimensions?: number) => {
      // Return mock 3D points, one for each input embedding received
      return embeddings.map((_embedding: Float32Array, index: number) => [index * 0.1 + 1, index * 0.2 + 1, index * 0.3 + 1]); // Use slightly different values
  }),
}));


describe('Server', () => {
  // Clear mocks before each test
  beforeEach(() => {
     jest.clearAllMocks();
  });

  it('should respond with 200 OK on the root path', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    // Optionally, check for some basic content if you serve an HTML file later
    // expect(response.text).toContain('<h1>Discourse Graph Visualizer</h1>');
  });

  it('should accept file uploads to /upload', async () => {
    const response = await request(app)
      .post('/upload')
      .attach('documents', Buffer.from('mock file content 1'), 'test1.txt')
      .attach('documents', Buffer.from('mock file content 2'), 'test2.md')
      .attach('documents', Buffer.from('mock file content 3'), 'test3.txt'); // Change to .txt to avoid PDF parsing error
    expect(response.status).toBe(200);
    // Check if the response body contains the visualization data structure
    expect(response.body).toHaveProperty('visualizationData');
    // We could add more specific checks here later, e.g., checking array lengths or specific properties
  });

  // We will add more tests here for error handling, etc.
});

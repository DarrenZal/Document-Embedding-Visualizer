import { reduceDimensions } from '../dimensionReducer'; // Will fail initially

// Mock the umap-js library
const mockFit = jest.fn(); // Mock for 'fit' method (if used)
const mockTransform = jest.fn(); // Mock for 'transform' method (if used)
const mockInitializeFit = jest.fn(); // Mock for 'initializeFit' method
const mockGetEmbedding = jest.fn().mockImplementation(() => { // Mock for 'getEmbedding'
    // Return dummy data matching input length based on sampleEmbeddings
    const inputLength = sampleEmbeddings.length;
    return Array.from({ length: inputLength }, (_, i) => [i * 0.1, i * 0.2, i * 0.3]);
});


jest.mock('umap-js', () => ({
    UMAP: jest.fn().mockImplementation(() => ({
        // Return the pre-defined mocks for the instance methods
        fit: mockFit,
        transform: mockTransform,
        initializeFit: mockInitializeFit,
        getEmbedding: mockGetEmbedding
    })),
}));

// Define sample embeddings at the top level so the mock can access its length
const sampleEmbeddings: Float32Array[] = Array.from({ length: 20 }, (_, i) =>
    new Float32Array(384).fill(0.1 * (i + 1))
);

describe('dimensionReducer', () => {

    beforeEach(() => {
        // Clear mocks before each test
        // Clear the top-level mocks before each test
        mockFit.mockClear();
        mockTransform.mockClear();
        mockInitializeFit.mockClear();
        mockGetEmbedding.mockClear();
        // Clear the constructor mock itself
        (require('umap-js').UMAP as jest.Mock).mockClear();
    });

     it('should throw error for insufficient data points', async () => {
        const fewEmbeddings = [new Float32Array(384).fill(0.1)];
        // UMAP typically needs more points than neighbors + 1
        await expect(reduceDimensions(fewEmbeddings, 3)).rejects.toThrow(/Insufficient data points/);
    });

    it('should initialize UMAP with default parameters if none provided', async () => {
        await reduceDimensions(sampleEmbeddings, 3);
        expect(require('umap-js').UMAP).toHaveBeenCalledWith({
            nComponents: 3, // Default target dimension
            nNeighbors: 15, // Default neighbors or a sensible default
            minDist: 0.1,   // Default min distance or a sensible default
            spread: 1.0,    // Default spread or a sensible default
            // Add other defaults if the implementation sets them
        });
    });

     it('should initialize UMAP with provided parameters', async () => {
        const options = { nNeighbors: 5, minDist: 0.5, spread: 0.8 };
        await reduceDimensions(sampleEmbeddings, 3, options);
        expect(require('umap-js').UMAP).toHaveBeenCalledWith({
            nComponents: 3,
            nNeighbors: 5,
            minDist: 0.5,
            spread: 0.8,
        });
    });


    it('should call UMAP fit and transform (or initializeFit/getEmbedding)', async () => {
        await reduceDimensions(sampleEmbeddings, 3);
        // Depending on implementation (sync/async UMAP usage)
        // Option 1: Using fit + transform (async)
        // expect(mockFit).toHaveBeenCalledWith(sampleEmbeddings.map(e => Array.from(e))); // UMAP might expect plain arrays
        // expect(mockTransform).toHaveBeenCalled();

        // Option 2: Using initializeFit + getEmbedding (sync) - Check the top-level mocks
         expect(mockInitializeFit).toHaveBeenCalledWith(sampleEmbeddings.map(e => Array.from(e)));
         expect(mockGetEmbedding).toHaveBeenCalled();
    });

    it('should return an array of 3D points (number[][])', async () => {
        const reducedData = await reduceDimensions(sampleEmbeddings, 3);
        expect(Array.isArray(reducedData)).toBe(true);
        expect(reducedData.length).toBe(sampleEmbeddings.length);
        reducedData.forEach((point: number[]) => { // Add type for point
            expect(Array.isArray(point)).toBe(true);
            expect(point.length).toBe(3); // Check for 3 dimensions
            point.forEach((coord: number) => { // Add type for coord
                expect(typeof coord).toBe('number');
            });
        });
    });

    it('should handle an empty input array', async () => {
        const reducedData = await reduceDimensions([], 3);
        expect(reducedData).toEqual([]);
        expect(require('umap-js').UMAP).not.toHaveBeenCalled();
    });
});

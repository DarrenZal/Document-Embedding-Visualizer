// Keep Document import + .js extension, remove create3DScatterPlot import
import { Document } from '../documentLoader.js';
// import * as fs from 'fs/promises'; // Remove static fs import
import * as path from 'path';

// Define the mock functions first
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockMkdir = jest.fn().mockResolvedValue(undefined);

// Declare the variable for the function under test + .js extension
let create3DScatterPlot: typeof import('../visualizer.js').create3DScatterPlot;


describe('visualizer', () => {
    // Apply mocks before tests run
    beforeAll(() => {
        // Mock fs/promises using doMock
        jest.doMock('fs/promises', () => ({
            __esModule: true,
            writeFile: mockWriteFile,
            mkdir: mockMkdir,
        }));
        // No need to mock plotly anymore as we construct HTML manually
    });

     // Reset mocks and dynamically import the module *after* mocking
    beforeEach(async () => {
        // Reset mocks
        mockWriteFile.mockClear();
        mockMkdir.mockClear();

        // Crucial to clear cache and re-import with mocks applied
        jest.resetModules();
        // Dynamically import the module under test AFTER mocks are set + .js extension
        create3DScatterPlot = (await import('../visualizer.js')).create3DScatterPlot;
    });

     afterAll(() => {
        // Clean up mocks
        jest.unmock('fs/promises');
    });

    // Keep sample data definition
    const sampleDocuments: Document[] = [
        { filepath: 'dir/doc1.txt', content: 'Content 1', filetype: 'txt' },
        { filepath: 'dir/doc2.md', content: 'Content 2', filetype: 'md' },
    ];
    const samplePoints: number[][] = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
    ];
    const outputPath = path.join(__dirname, 'output', 'test_plot.html');

    // No longer need beforeEach for clearing mocks here as resetModules handles it

    it('should throw an error if documents and points lengths mismatch', async () => {
        const mismatchedPoints = [[0.1, 0.2, 0.3]]; // Only one point

        // Temporarily mock console.error to suppress the expected error log
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(create3DScatterPlot(sampleDocuments, mismatchedPoints, outputPath))
            .rejects.toThrow(/Mismatch between number of documents/);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    it('should handle empty data gracefully', async () => {
        await create3DScatterPlot([], [], outputPath);

        // Expect writeFile to be called with the placeholder HTML
        expect(mockWriteFile).toHaveBeenCalledTimes(1);
        const writtenHtml = mockWriteFile.mock.calls[0][1];
        const expectedPlaceholderHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>No Data</title>
</head>
<body>
    <p>No data available to generate the visualization.</p>
</body>
</html>
            `.trim();
        expect(mockWriteFile).toHaveBeenCalledWith(outputPath, expectedPlaceholderHtml, 'utf-8');
    });

    it('should write HTML containing correct plot data JSON', async () => {
        await create3DScatterPlot(sampleDocuments, samplePoints, outputPath);

        expect(mockWriteFile).toHaveBeenCalledTimes(1);
        const writtenHtml = mockWriteFile.mock.calls[0][1]; // Get the content written

        // Check that the written HTML contains the JSON-stringified data
        const expectedTrace = {
            x: [0.1, 0.4],
            y: [0.2, 0.5],
            z: [0.3, 0.6],
            mode: 'markers',
            type: 'scatter3d',
            text: ['doc1.txt', 'doc2.md'], // Filenames
            customdata: ['dir/doc1.txt', 'dir/doc2.md'], // Full paths
            hoverinfo: 'none', // Use hovertemplate instead
            hovertemplate: `<b>%{text}</b><br><a href="/%{customdata}" target="_blank" style="color: white;">View File</a><extra></extra>`,
            marker: { size: 5 },
        };
        const expectedLayout = {
             title: 'Document Embedding Visualizer', // Match actual title
             margin: { l: 0, r: 0, b: 0, t: 40 },
             scene: {
                 xaxis: { title: 'UMAP Dim 1' },
                 yaxis: { title: 'UMAP Dim 2' },
                 zaxis: { title: 'UMAP Dim 3' },
             },
             hovermode: 'closest'
        };
        const expectedConfig = { staticPlot: false };

        // Check if the HTML contains the stringified versions
        expect(writtenHtml).toContain(`const plotData = ${JSON.stringify([expectedTrace])};`);
        expect(writtenHtml).toContain(`const layout = ${JSON.stringify(expectedLayout)};`);
        expect(writtenHtml).toContain(`const config = ${JSON.stringify(expectedConfig)};`);
        // Use the variable name 'plotDiv' instead of the string literal
        expect(writtenHtml).toContain(`Plotly.newPlot(plotDiv, plotData, layout, config);`);
    });

    // This test is now covered by the one above, can be removed or kept for redundancy
    // it('should extract filenames correctly for hover text', async () => {
    //    await create3DScatterPlot(sampleDocuments, samplePoints, outputPath);
    //    const writtenHtml = mockWriteFile.mock.calls[0][1];
    //    expect(writtenHtml).toContain('"text":["doc1.txt","doc2.md"]');
    // });

    it('should call fs.writeFile with the correct path and the generated HTML', async () => {
        await create3DScatterPlot(sampleDocuments, samplePoints, outputPath);
        expect(mockWriteFile).toHaveBeenCalledTimes(1);
        // Check the path and that the content is a non-empty string (HTML)
        expect(mockWriteFile).toHaveBeenCalledWith(outputPath, expect.any(String), 'utf-8');
        // Optionally, do a basic check on the HTML structure
        const writtenHtml = mockWriteFile.mock.calls[0][1];
        expect(writtenHtml).toMatch(/^<!DOCTYPE html>/);
        expect(writtenHtml).toContain('<div id=\'plotDiv\'');
        expect(writtenHtml).toContain('</html>');
    });

     it('should create the output directory if it does not exist', async () => {
        await create3DScatterPlot(sampleDocuments, samplePoints, outputPath);
        expect(mockMkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
    });

});

 import Plotly from 'plotly.js'; // Import from the main module to match @types/plotly.js
import * as fs from 'fs/promises';
import * as path from 'path';
import { Document } from './documentLoader'; // Import Document type

// Define the structure for the Plotly data object to be returned
export interface PlotlyData {
    data: Partial<Plotly.Data>[];
    layout: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
}

// Function to generate Plotly data structure for 3D scatter plot
export function generatePlotlyData(
    documents: Document[],
    points: number[][] // Expecting array of [x, y, z] points
): PlotlyData {
    if (documents.length !== points.length) {
        throw new Error(`Mismatch between number of documents (${documents.length}) and points (${points.length})`);
    }

    if (documents.length === 0) {
        console.log("No data provided for visualization. Returning empty plot data.");
        // Return a default empty structure or throw an error? Returning empty for now.
        return { data: [], layout: { title: 'No Data Provided' } };
    }

    console.log(`Generating Plotly data for ${documents.length} documents...`);

    // Prepare data for Plotly
    const trace: Partial<Plotly.Data> = {
        x: points.map(p => p[0]), // Extract X coordinates
        y: points.map(p => p[1]), // Extract Y coordinates
        z: points.map(p => p[2]), // Extract Z coordinates
        mode: 'markers',
        type: 'scatter3d',
        text: documents.map(doc => path.basename(doc.filepath)), // Use filenames for display
        customdata: documents.map(doc => doc.filepath), // Store full filepath
        hoverinfo: 'none', // Disable default hover text, we use hovertemplate
        hovertemplate: `<b>%{text}</b><br>` +
                       // Added style="color: white;" for better visibility on dark tooltips
                       `<a href="/%{customdata}" target="_blank" style="color: white;">View File</a>` +
                       // Add other options here in the future if needed
                       `<extra></extra>`, // <extra> hides trace info
        marker: {
            size: 5,
            // color: documents.map((_, i) => i), // Example: color by index
            // colorscale: 'Viridis',
            // opacity: 0.8
        },
    };

    // Prepare layout for Plotly
    const layout: Partial<Plotly.Layout> = {
        title: 'Document Embedding Visualizer', // Updated title
        margin: { l: 0, r: 0, b: 0, t: 40 }, // Adjust margins
        scene: {
            xaxis: { title: 'UMAP Dim 1' },
            yaxis: { title: 'UMAP Dim 2' },
            zaxis: { title: 'UMAP Dim 3' },
        },
        hovermode: 'closest'
    };

     // Configuration options (optional, but good to include)
    const config: Partial<Plotly.Config> = {
        staticPlot: false, // Make the plot interactive
        // responsive: true // Make plot responsive
    };

    return { data: [trace], layout, config };
}


// Function to create and save a 3D scatter plot (uses generatePlotlyData)
export async function create3DScatterPlot(
    documents: Document[],
    points: number[][], // Expecting array of [x, y, z] points
    outputPath: string
): Promise<void> {
    try {
        // Generate the plot data structure
        const { data: plotDataArray, layout, config } = generatePlotlyData(documents, points);

        // Handle the case where generatePlotlyData returns empty data
        if (plotDataArray.length === 0) {
            console.log("No plot data generated. Skipping HTML file creation.");
            // Optionally create a placeholder HTML or just return
            const placeholderHtml = `
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
            const outputDir = path.dirname(outputPath);
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputPath, placeholderHtml, 'utf-8');
            console.log(`Placeholder HTML saved to ${outputPath}`);
            return;
        }

        // Manually construct HTML embedding the plot data as JSON.
        const plotDataJson = JSON.stringify(plotDataArray);
        const layoutJson = JSON.stringify(layout);
        const configJson = JSON.stringify(config || {}); // Ensure config is defined

        // Construct the HTML, including the click event listener script
        const plotHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${layout.title || 'Plotly 3D Scatter Plot'}</title>
    <script src='https://cdn.plot.ly/plotly-latest.min.js'></script>
</head>
<body>
    <div id='plotDiv' style='width: 95vw; height: 95vh;'></div>
    <script>
        const plotData = ${plotDataJson};
        const layout = ${layoutJson};
        const config = ${configJson};
        const plotDiv = document.getElementById('plotDiv');

        Plotly.newPlot(plotDiv, plotData, layout, config);

        // No longer need the plotly_click listener, action is in hovertemplate link
    </script>
</body>
</html>
        `.trim(); // Use trim() to remove leading/trailing whitespace

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // Write the generated HTML (from the mock) to the file
        await fs.writeFile(outputPath, plotHtml, 'utf-8');
        console.log(`3D scatter plot saved to ${outputPath}`);

    } catch (error) {
        console.error("Error generating or saving Plotly chart:", error);
        throw error; // Re-throw the error
    }
}

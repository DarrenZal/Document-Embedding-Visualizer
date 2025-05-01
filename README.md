# Document Embedding Visualizer

This project provides a web application for generating and visualizing document embeddings in an interactive 3D space. Users can upload a collection of documents, and the application calculates their semantic embeddings, reduces the dimensionality of these embeddings using UMAP, and displays a 3D scatter plot where proximity indicates semantic similarity.

## How it Works

The application consists of a backend server and a frontend interface:

1.  **Backend (`src/server.ts`):**
    *   An Express.js server handles HTTP requests.
    *   Uses Multer to manage file uploads via a `/upload` endpoint.
    *   Orchestrates the processing pipeline upon receiving files.
2.  **Processing Pipeline:**
    *   **Document Loading (`src/documentLoader.ts`):** Reads text content from uploaded files (`.txt`, `.md`, `.pdf`). PDF text extraction is handled using the `pdf-parse` library.
    *   **Embedding Generation (`src/embeddingGenerator.ts`):** Uses the `Xenova/all-MiniLM-L6-v2` sentence transformer model (via `@xenova/transformers`) to generate a high-dimensional embedding vector for the content of each document. This model is specifically designed for creating semantic text embeddings.
    *   **Dimensionality Reduction (`src/dimensionReducer.ts`):** Employs the UMAP algorithm (via `umap-js`) to reduce the high-dimensional embeddings down to 3 dimensions, preserving semantic relationships as spatial proximity.
    *   **Visualization Data Generation (`src/visualizer.ts`):** Prepares the data structure (traces and layout) required by Plotly.js for the 3D scatter plot.
3.  **Frontend (`public/index.html`):**
    *   Provides a simple HTML interface with a file upload form.
    *   Sends the selected files to the backend's `/upload` endpoint.
    *   Receives the visualization data (as JSON) from the backend.
    *   Uses the Plotly.js library (loaded via CDN) to render the interactive 3D scatter plot in the browser. Each point represents a document, positioned according to its reduced 3D coordinates. Hovering over a point displays the document's filename.

## Setup

1.  **Prerequisites:** Node.js and npm installed.
2.  **Install Dependencies:** Navigate to the project root directory in your terminal and run:
    ```bash
    npm install
    ```

## Running the Web Application

1.  **Build the TypeScript Code:** Compile the server-side TypeScript to JavaScript:
    ```bash
    npm run build
    ```
    (This creates a `dist` directory with the compiled code).
2.  **Start the Server:** Run the compiled server script:
    ```bash
    node dist/server.js
    ```
    You should see a message like `[server]: Server is running at http://localhost:3000`.
3.  **Access the Application:** Open your web browser and navigate to `http://localhost:3000`.
4.  **Upload and Visualize:** Use the form to select one or more `.txt`, `.md`, or `.pdf` files and click "Visualize".

**Note:** The first time you upload files after starting the server, the embedding model (`Xenova/all-MiniLM-L6-v2`) will be downloaded by the backend, which may take some time depending on your internet connection. Subsequent processing requests will be faster as the model will be cached locally by the server process.

## Testing

Unit tests have been written for the core modules and the server endpoint structure using Jest. To run the tests:

```bash
npm test
```
*(Note: Tests currently mock the embedding generation and dimensionality reduction steps to avoid dependency conflicts and long execution times during testing).*

## Future Plans (Phase 2)

The next phase aims to enhance the visualization by incorporating extracted features:

1.  **Feature Extraction:** Implement a module (`src/featureExtractor.ts`) to identify and extract specific semantic features from document content, such as:
    *   Questions
    *   Claims
    *   Hypotheses
    *   Evidence
    This will likely involve using a Large Language Model (LLM) via API calls or local models.
2.  **Feature Embedding:** Generate embeddings for each extracted feature, similar to how document embeddings are generated.
3.  **Combined Visualization:**
    *   Update the dimensionality reduction step to include both document and feature embeddings in the same 3D space.
    *   Enhance the Plotly visualization to display:
        *   Document points (perhaps larger).
        *   Feature points (perhaps smaller, color-coded by type).
        *   Lines connecting features to their parent documents.
        *   Potentially, lines connecting similar features across different documents to visualize explicit content overlap beyond general semantic similarity.

This will provide a richer, multi-layered view of the relationships within and between the documents.

# Document Embedding Visualizer

This project provides a web application deployed on Vercel for generating and visualizing document embeddings in an interactive 3D space. It loads an initial visualization based on pre-selected documents and allows users to upload their own collection of documents (`.pdf`, `.md`, `.txt`) to generate a new visualization on the fly. The application calculates semantic embeddings, reduces their dimensionality using UMAP, and displays a 3D scatter plot where proximity indicates semantic similarity.

## How it Works

The application consists of a Vercel Serverless Function backend, a frontend interface, and a pre-processing step:

1.  **Backend (`api/upload.ts`):**
    *   A Vercel Serverless Function handles HTTP POST requests to `/api/upload`.
    *   Uses Multer to manage file uploads, saving them temporarily to `/tmp`.
    *   Orchestrates the processing pipeline upon receiving files.
2.  **Processing Pipeline:**
    *   **Document Loading (`src/documentLoader.ts`):** Reads text content from uploaded files (`.txt`, `.md`). PDF text extraction is handled by calling the LlamaParse API.
    *   **Embedding Generation (`src/embeddingGenerator.ts`):** Uses the `Xenova/all-MiniLM-L6-v2` sentence transformer model (via `@xenova/transformers`) to generate a high-dimensional embedding vector for the content of each document.
    *   **Dimensionality Reduction (`src/dimensionReducer.ts`):** Employs the UMAP algorithm (via `umap-js`) to reduce the high-dimensional embeddings down to 3 dimensions.
    *   **Visualization Data Generation (`src/visualizer.ts`):** Prepares the data structure (traces and layout) required by Plotly.js for the 3D scatter plot.
3.  **Frontend (`public/index.html`):**
    *   Provides a simple HTML interface with a file upload form.
    *   On initial load, fetches pre-generated data (`public/initial-plot-data.json`) and displays the visualization for the default documents.
    *   When the form is submitted, sends the selected files to the `/api/upload` endpoint.
    *   Receives the new visualization data (as JSON) from the backend.
    *   Uses the Plotly.js library to render the interactive 3D scatter plot, replacing the initial one. Each point represents a document. Hovering over a point displays the filename and a link to view the source document (for pre-processed files).
4.  **Pre-processing (`scripts/generate-initial-data.ts`):**
    *   A script that processes documents placed in the `pre-pop` directory.
    *   Copies these documents to `public/served-docs` so they can be accessed via web links.
    *   Runs the full processing pipeline (LlamaParse for PDFs, embeddings, UMAP) on these documents.
    *   Saves the resulting Plotly data to `public/initial-plot-data.json`.

## Setup

1.  **Prerequisites:** Node.js and npm installed.
2.  **Clone Repository:** `git clone <repository-url>`
3.  **Install Dependencies:** Navigate to the project root directory and run:
    ```bash
    npm install
    ```
4.  **API Key:** You need an API key from LlamaParse (LlamaIndex Cloud).
5.  **Environment File:** Create a `.env` file in the project root:
    ```bash
    touch .env
    ```
6.  **Add API Key to `.env`:** Open the `.env` file and add your key:
    ```
    LLAMAPARSE_API_KEY=your_llamaparse_api_key_here
    ```
    *(Note: The `.env` file is listed in `.gitignore` and should not be committed.)*

## Pre-processing Initial Data

The application includes a set of default documents in the `pre-pop` directory. To generate the initial visualization data displayed on page load:

1.  **Run the script:**
    ```bash
    npm run generate-initial
    ```
    This script will:
    *   Copy files from `pre-pop` to `public/served-docs`.
    *   Call the LlamaParse API (using the key from `.env`) to process PDFs.
    *   Generate embeddings locally using `@xenova/transformers`.
    *   Generate the Plotly data and save it to `public/initial-plot-data.json`.
2.  **Commit the results:** Commit the generated `public/initial-plot-data.json` file and the contents of `public/served-docs` to your repository.

*(Note: The first time you run this script or generate embeddings, the `@xenova/transformers` model will be downloaded and cached, which may take some time.)*

## Running Locally

1.  **Ensure you have run the pre-processing step** (`npm run generate-initial`) at least once.
2.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
    This uses `ts-node` to run the server directly from TypeScript source files and watches for changes. It loads the API key from your `.env` file.
3.  **Access the Application:** Open your web browser and navigate to `http://localhost:3000`. You should see the initial visualization. You can then upload new files.

## Deployment (Vercel)

This project is configured for easy deployment on Vercel.

1.  **Connect Repository:** Connect your GitHub/GitLab/Bitbucket repository to Vercel.
2.  **Configure Environment Variables:** In your Vercel project settings (Settings -> Environment Variables), add the following:
    *   `LLAMAPARSE_API_KEY`: Your LlamaParse API key.
    *   `TRANSFORMERS_CACHE`: Set the value to `/tmp/transformers_cache`. (This provides a writable directory for the embedding model cache).
    Ensure these variables are enabled for the Production environment (and Preview/Development if needed).
3.  **Deploy:** Vercel will automatically build and deploy the project when you push changes to your connected branch (e.g., `main`). Ensure you have committed the `public/initial-plot-data.json` file and the `public/served-docs` directory.

## Testing

Unit tests can be run using:

```bash
npm test
```
*(Note: Tests may need updates to reflect the current architecture).*

## Future Plans

(Content from previous README about Phase 2 can be kept here if still relevant).

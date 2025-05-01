import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import axios from 'axios'; // Import axios
import FormData from 'form-data'; // Import form-data
// Remove pdfjs-dist import
// import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { marked } from 'marked'; // Use named import for marked

// Define the structure for our document objects
export interface Document {
  filepath: string;
  content: string;
  filetype: 'txt' | 'md' | 'pdf' | 'unknown';
}

// Function to load documents
export async function loadDocuments(directoryPath: string): Promise<Document[]> {
  // Basic check if directory exists
  try {
    await fs.access(directoryPath);
  } catch (error) {
    // console.error(`Error accessing directory: ${directoryPath}`, error); // Keep console clean for tests
    throw new Error(`Directory not found or inaccessible: ${directoryPath}`);
  }

  // Find relevant files using glob
  const files = await glob(`${directoryPath}/**/*.{txt,md,pdf}`, { nodir: true });

  const documents: Document[] = [];

  for (const filepath of files) {
    const filetype = getFileType(filepath);
    if (filetype !== 'unknown') {
      try {
        const content = await readFileContent(filepath, filetype);
        documents.push({ filepath, content, filetype });
      } catch (readError) {
        console.error(`Failed to read or parse file: ${filepath}`, readError);
        // Optionally skip the file or handle the error differently
      }
    }
  }

  return documents;
}

// Function to load documents from multer upload data
export async function loadUploadedDocuments(files: Express.Multer.File[]): Promise<Document[]> {
    console.log(`[loadUploadedDocuments] Starting processing for ${files.length} files.`); // Added log
    const documents: Document[] = [];

    for (const file of files) {
        console.log(`[loadUploadedDocuments] Processing file: ${file.originalname}, Path: ${file.path}, Size: ${file.size}`); // Added log
        // file.path now points to the permanent location in input_docs
        // file.originalname is the original name of the uploaded file
        const filetype = getFileType(file.originalname); // Still use originalname for type detection
        console.log(`[loadUploadedDocuments] Detected filetype: ${filetype}`); // Added log

        if (filetype !== 'unknown') {
            try {
                console.log(`[loadUploadedDocuments] Reading content for ${file.originalname}...`); // Added log
                // Read content from the permanent path provided by multer's diskStorage
                const content = await readFileContent(file.path, filetype);
                console.log(`[loadUploadedDocuments] Successfully read content for ${file.originalname}. Length: ${content.length}`); // Added log

                // Construct the server-accessible path relative to the project root
                // Use path.relative to get the path from the project root (__dirname is dist/src, so go up two levels)
                // Or simply use the known structure 'input_docs/filename'
                const relativePath = path.join('input_docs', file.filename).replace(/\\/g, '/'); // Use file.filename as set by diskStorage

                // Use the relative path for the document's 'filepath' identifier
                documents.push({ filepath: relativePath, content, filetype });

            } catch (readError) {
                console.error(`Failed to read or parse uploaded file: ${file.originalname} (path: ${file.path})`, readError);
                // Optionally skip the file or handle the error differently
            }
            // No finally block needed to delete the file, as it's permanent now.
        } else {
             console.warn(`Skipping unsupported file type: ${file.originalname}`);
             // Optionally delete the unsupported file if it shouldn't be kept
             // try { await fs.unlink(file.path); } catch (e) {}
         }
    }

    return documents;
}


// Helper function to get file type
function getFileType(filepath: string): Document['filetype'] {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.txt') return 'txt';
  if (ext === '.md') return 'md';
  if (ext === '.pdf') return 'pdf';
  return 'unknown';
}

// Helper function to read content based on file type
async function readFileContent(filepath: string, filetype: Document['filetype']): Promise<string> {
  console.log(`[readFileContent] Reading file: ${filepath}, Type: ${filetype}`); // Added log
  try {
    if (filetype === 'txt') {
      console.log(`[readFileContent] Reading as text: ${filepath}`); // Added log
      return await fs.readFile(filepath, 'utf-8');
    } else if (filetype === 'md') {
      console.log(`[readFileContent] Reading as markdown: ${filepath}`); // Added log
      const rawContent = await fs.readFile(filepath, 'utf-8');
      // Use marked.parse for async parsing
      const parsedContent = await marked.parse(rawContent);
      console.log(`[readFileContent] Parsed markdown. Length: ${parsedContent.length}`); // Added log
      return parsedContent;
    } else if (filetype === 'pdf') {
      console.log(`[readFileContent] Processing PDF via LlamaParse API: ${filepath}`); // Updated log
      const apiKey = process.env.LLAMAPARSE_API_KEY;
      const LlamaParseBaseUrl = 'https://api.cloud.llamaindex.ai/api/v1'; // Assuming base URL

      if (!apiKey) {
        console.error("[readFileContent] LLAMAPARSE_API_KEY environment variable not set.");
        throw new Error("LLAMAPARSE_API_KEY environment variable not set.");
      }

      const dataBuffer = await fs.readFile(filepath);
      console.log(`[readFileContent] PDF read into buffer. Length: ${dataBuffer.length}`);

      const formData = new FormData();
      formData.append('file', dataBuffer, path.basename(filepath)); // LlamaParse might expect 'file' field
      // LlamaParse specific parameters if needed, e.g.:
      // formData.append('parsing_instruction', 'Extract text content');

      console.log(`[readFileContent] Starting LlamaParse job for ${path.basename(filepath)}...`);
      try {
        // 1. Start Job
        const startJobResponse = await axios.post(
          `${LlamaParseBaseUrl}/parsing/upload`, // Assuming endpoint
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${apiKey}`,
              'accept': 'application/json',
            },
            timeout: 30000 // Timeout for starting the job (30s)
           }
         );

         // Add type assertion for the response data
         const jobId = (startJobResponse.data as { id: string }).id;
         if (!jobId) {
             throw new Error('LlamaParse did not return a job ID.');
        }
        console.log(`[readFileContent] LlamaParse job started. Job ID: ${jobId}`);

        // 2. Poll Job Status
        let jobStatus = '';
        const maxAttempts = 20; // Poll for ~5 minutes max (20 * 15s)
        const pollInterval = 15000; // 15 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`[readFileContent] Checking LlamaParse job status (Attempt ${attempt}/${maxAttempts})...`);
          const statusResponse = await axios.get(
            `${LlamaParseBaseUrl}/parsing/job/${jobId}`, // Assuming endpoint
            {
              headers: { 'Authorization': `Bearer ${apiKey}`, 'accept': 'application/json' },
              timeout: 10000 // Timeout for status check (10s)
             }
           );
           // Add type assertion for the response data
           jobStatus = (statusResponse.data as { status: string }).status;
           console.log(`[readFileContent] LlamaParse job status: ${jobStatus}`);

          if (jobStatus === 'SUCCESS') break;
          if (jobStatus === 'FAILURE') throw new Error(`LlamaParse job ${jobId} failed.`);

          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        if (jobStatus !== 'SUCCESS') {
          throw new Error(`LlamaParse job ${jobId} timed out after ${maxAttempts * pollInterval / 1000} seconds.`);
        }

        // 3. Get Job Result
        console.log(`[readFileContent] Fetching LlamaParse result for job ${jobId}...`);
        const resultResponse = await axios.get(
          `${LlamaParseBaseUrl}/parsing/job/${jobId}/result/text`, // Assuming text result endpoint
          {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'accept': 'application/json' }, // Or 'text/plain'? Check docs
            timeout: 30000 // Timeout for getting result (30s)
           }
         );

         // Add type assertion for the response data
         // Assuming the result endpoint returns JSON with a 'text' field or similar
         // Adjust based on actual LlamaParse API documentation
         const responseData = resultResponse.data as { text?: string };
         const fullText = responseData.text || JSON.stringify(responseData); // Fallback
         console.log(`[readFileContent] Extracted text from LlamaParse API. Length: ${fullText.length}`);
         return fullText;

      } catch (apiError: any) {
        console.error(`[readFileContent] Error calling LlamaParse API for ${filepath}:`, apiError.response?.data || apiError.message);
        throw new Error(`Failed to process PDF via LlamaParse API: ${apiError.message}`);
      }
    } else {
      console.warn(`[readFileContent] Attempted to read unsupported file type: ${filepath}`);
      return ''; // Or throw an error
    }
  } catch (error) {
    console.error(`Error reading content from ${filepath}:`, error);
    throw error; // Re-throw the error to be caught in loadDocuments
  }
}

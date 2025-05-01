import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
// Remove pdf-parse import
// import pdf from 'pdf-parse';
// Import pdfjs-dist using the recommended path for ESM/Node
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
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
      console.log(`[readFileContent] Reading as PDF: ${filepath}`); // Added log
      const dataBuffer = await fs.readFile(filepath);
      console.log(`[readFileContent] PDF read into buffer. Length: ${dataBuffer.length}`); // Added log
      // Convert Node.js Buffer to Uint8Array for pdfjs-dist
      const uint8Array = new Uint8Array(dataBuffer);
      console.log(`[readFileContent] Converted PDF buffer to Uint8Array. Length: ${uint8Array.length}`); // Added log
      // Use pdfjs-dist to load the document
      console.log(`[readFileContent] Calling pdfjsLib.getDocument...`); // Added log
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdfDoc = await loadingTask.promise;
      console.log(`[readFileContent] PDF document loaded. Pages: ${pdfDoc.numPages}`); // Added log
      let fullText = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        console.log(`[readFileContent] Processing PDF page ${i}...`); // Added log
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        console.log(`[readFileContent] Extracted text content from page ${i}. Items: ${textContent.items.length}`); // Added log
        // Concatenate text items, adding spaces or newlines as needed
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      console.log(`[readFileContent] Finished processing PDF. Total text length: ${fullText.length}`); // Added log
      return fullText.trim();
    } else {
      console.warn(`[readFileContent] Attempted to read unsupported file type: ${filepath}`);
      return ''; // Or throw an error
    }
  } catch (error) {
    console.error(`Error reading content from ${filepath}:`, error);
    throw error; // Re-throw the error to be caught in loadDocuments
  }
}

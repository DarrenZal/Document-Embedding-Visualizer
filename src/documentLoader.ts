import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import pdf from 'pdf-parse'; // Use default import for pdf-parse
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
    const documents: Document[] = [];

    for (const file of files) {
        // file.path now points to the permanent location in input_docs
        // file.originalname is the original name of the uploaded file
        const filetype = getFileType(file.originalname); // Still use originalname for type detection

        if (filetype !== 'unknown') {
            try {
                // Read content from the permanent path provided by multer's diskStorage
                const content = await readFileContent(file.path, filetype);

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
  try {
    if (filetype === 'txt') {
      return await fs.readFile(filepath, 'utf-8');
    } else if (filetype === 'md') {
      const rawContent = await fs.readFile(filepath, 'utf-8');
      // Use marked.parse for async parsing
      return await marked.parse(rawContent);
    } else if (filetype === 'pdf') {
      const dataBuffer = await fs.readFile(filepath);
      const data = await pdf(dataBuffer);
      return data.text; // Extract text content from pdf-parse result
    } else {
      console.warn(`Attempted to read unsupported file type: ${filepath}`);
      return ''; // Or throw an error
    }
  } catch (error) {
    console.error(`Error reading content from ${filepath}:`, error);
    throw error; // Re-throw the error to be caught in loadDocuments
  }
}

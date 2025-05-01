import { loadDocuments } from '../documentLoader'; // This will initially fail as the file doesn't exist
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock pdf-parse and marked
jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ text: 'Mock PDF content' }),
}));
jest.mock('marked', () => ({
  marked: {
    parse: jest.fn().mockResolvedValue('Mock Markdown content parsed'),
  },
}));

const TEST_DIR = path.join(__dirname, 'test_docs');

describe('documentLoader', () => {
  beforeAll(async () => {
    // Create a temporary directory and dummy files for testing
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'doc1.txt'), 'Plain text content.');
    await fs.writeFile(path.join(TEST_DIR, 'doc2.md'), '# Markdown Header');
    await fs.writeFile(path.join(TEST_DIR, 'doc3.pdf'), 'dummy pdf data'); // Content doesn't matter due to mock
    await fs.writeFile(path.join(TEST_DIR, 'other.log'), 'Ignore this file.');
  });

  afterAll(async () => {
    // Clean up the temporary directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should load documents from a directory', async () => {
    const documents = await loadDocuments(TEST_DIR);
    expect(documents).toBeDefined();
    expect(Array.isArray(documents)).toBe(true);
  });

  it('should load .txt, .md, and .pdf files', async () => {
    const documents = await loadDocuments(TEST_DIR);
    expect(documents.length).toBe(3); // txt, md, pdf
    const filenames = documents.map(doc => path.basename(doc.filepath));
    expect(filenames).toContain('doc1.txt');
    expect(filenames).toContain('doc2.md');
    expect(filenames).toContain('doc3.pdf');
  });

  it('should ignore unsupported file types', async () => {
    const documents = await loadDocuments(TEST_DIR);
    const filenames = documents.map(doc => path.basename(doc.filepath));
    expect(filenames).not.toContain('other.log');
  });

  it('should extract correct content for .txt files', async () => {
    const documents = await loadDocuments(TEST_DIR);
    const txtDoc = documents.find(doc => doc.filepath.endsWith('.txt'));
    expect(txtDoc?.content).toBe('Plain text content.');
  });

  it('should extract correct content for .md files using marked', async () => {
    const documents = await loadDocuments(TEST_DIR);
    const mdDoc = documents.find(doc => doc.filepath.endsWith('.md'));
    // Note: We check against the mocked marked output
    expect(mdDoc?.content).toBe('Mock Markdown content parsed');
    expect(require('marked').marked.parse).toHaveBeenCalledWith('# Markdown Header');
  });

  it('should extract correct content for .pdf files using pdf-parse', async () => {
    const documents = await loadDocuments(TEST_DIR);
    const pdfDoc = documents.find(doc => doc.filepath.endsWith('.pdf'));
    expect(pdfDoc?.content).toBe('Mock PDF content');
    // Check the mocked default function specifically
    expect(require('pdf-parse').default).toHaveBeenCalled();
  });

  it('should handle errors gracefully (e.g., non-existent directory)', async () => {
    await expect(loadDocuments(path.join(__dirname, 'non_existent_dir')))
      .rejects // Or resolve to empty array, depending on desired behavior
      .toThrow(); // Adjust expectation based on how errors should be handled
  });
});

export {
  extractText,
  countOccurrences,
  getAllIndices,
  parseColor,
  readDocument,
  createDocument,
  getDocumentInfo,
  listDocuments,
  getDocumentStructure
} from './docs-core.js';

export {
  editDocument,
  insertDocument,
  deleteText,
  insertTable,
  batchUpdate
} from './docs-edit.js';

export {
  formatDocument
} from './docs-format.js';

export {
  getSections,
  deleteSection,
  moveSection,
  replaceSection
} from './docs-sections.js';

export {
  insertImage,
  listImages,
  deleteImage,
  replaceImage
} from './docs-media.js';

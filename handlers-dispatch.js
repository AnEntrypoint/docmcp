import * as sections from './docs-sections.js';
import * as media from './docs-media.js';

export async function handleDocsImageActions(name, args, auth) {
  if (args.action === 'insert') {
    const result = await media.insertImage(auth, args.doc_id, args.image_url, args.position || 'end', args.width, args.height);
    return { content: [{ type: 'text', text: `Inserted image at index ${result.index}` }] };
  } else if (args.action === 'list') {
    const result = await media.listImages(auth, args.doc_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } else if (args.action === 'delete') {
    const result = await media.deleteImage(auth, args.doc_id, args.image_index);
    return { content: [{ type: 'text', text: `Deleted image at index ${result.imageIndex}` }] };
  } else if (args.action === 'replace') {
    const result = await media.replaceImage(auth, args.doc_id, args.image_index, args.image_url, args.width, args.height);
    return { content: [{ type: 'text', text: `Replaced image at index ${result.imageIndex}` }] };
  }
  throw new Error(`Unknown image action: ${args.action}`);
}

export async function handleDocsSectionActions(name, args, auth) {
  if (args.action === 'delete') {
    const result = await sections.deleteSection(auth, args.doc_id, args.section);
    return { content: [{ type: 'text', text: `Deleted section "${result.deleted}"` }] };
  } else if (args.action === 'move') {
    const result = await sections.moveSection(auth, args.doc_id, args.section, args.target);
    return { content: [{ type: 'text', text: `Moved section "${result.moved}"` }] };
  } else if (args.action === 'replace') {
    const result = await sections.replaceSection(auth, args.doc_id, args.section, args.content, args.preserve_heading !== false);
    return { content: [{ type: 'text', text: `Replaced section "${result.replaced}" (heading preserved: ${result.preservedHeading})` }] };
  }
  throw new Error(`Unknown section action: ${args.action}`);
}

import * as gmail from './gmail.js';
import { formatJsonResponse, buildLabelConfig } from './handlers-utils.js';

export async function handleGmailToolCall(name, args, auth) {
  switch (name) {
    case 'gmail_list': return { content: [{ type: 'text', text: JSON.stringify(await gmail.listEmails(auth, args.max_results || 20, args.query || null, args.label_ids || null), null, 2) }] };
    case 'gmail_search': return { content: [{ type: 'text', text: JSON.stringify(await gmail.searchEmails(auth, args.query, args.max_results || 20), null, 2) }] };
    case 'gmail_read': return { content: [{ type: 'text', text: JSON.stringify(await gmail.readEmail(auth, args.message_id, args.format || 'full'), null, 2) }] };
    case 'gmail_get_attachments': return { content: [{ type: 'text', text: JSON.stringify(await gmail.getEmailAttachments(auth, args.message_id), null, 2) }] };
    case 'gmail_download_attachment': return { content: [{ type: 'text', text: JSON.stringify(await gmail.downloadAttachment(auth, args.message_id, args.attachment_id), null, 2) }] };
    case 'gmail_get_labels': return { content: [{ type: 'text', text: JSON.stringify(await gmail.getLabels(auth), null, 2) }] };
    case 'gmail_create_label': return formatJsonResponse(await gmail.createLabel(auth, buildLabelConfig(args)));
    case 'gmail_update_label': {
      const config = buildLabelConfig(args);
      delete config.name; if (args.name) config.name = args.name;
      return formatJsonResponse(await gmail.updateLabel(auth, args.label_id, config));
    }
    case 'gmail_delete_label': return { content: [{ type: 'text', text: `Deleted label ${(await gmail.deleteLabel(auth, args.label_id)).deleted}` }] };
    case 'gmail_list_filters': return { content: [{ type: 'text', text: JSON.stringify(await gmail.listFilters(auth), null, 2) }] };
    case 'gmail_get_filter': return { content: [{ type: 'text', text: JSON.stringify(await gmail.getFilter(auth, args.filter_id), null, 2) }] };
    case 'gmail_create_filter': {
      const criteria = gmail.normalizeFilterCriteriaInput(args.criteria || {});
      const action = gmail.normalizeFilterActionInput(args.action || {});
      return { content: [{ type: 'text', text: JSON.stringify(await gmail.createFilter(auth, criteria, action), null, 2) }] };
    }
    case 'gmail_delete_filter': return { content: [{ type: 'text', text: `Deleted filter ${(await gmail.deleteFilter(auth, args.filter_id)).deleted}` }] };
    case 'gmail_replace_filter': {
      const criteria = gmail.normalizeFilterCriteriaInput(args.criteria || {});
      const action = gmail.normalizeFilterActionInput(args.action || {});
      return { content: [{ type: 'text', text: JSON.stringify(await gmail.replaceFilter(auth, args.filter_id, criteria, action), null, 2) }] };
    }
    case 'gmail_send': {
      const result = await gmail.sendEmail(auth, args.to, args.subject, args.body, args.cc || null, args.bcc || null);
      return { content: [{ type: 'text', text: `Sent email to ${args.to}\nMessage ID: ${result.id}` }] };
    }
    case 'gmail_delete': return { content: [{ type: 'text', text: `Permanently deleted email ${(await gmail.deleteEmail(auth, args.message_id)).deleted}` }] };
    case 'gmail_trash': return { content: [{ type: 'text', text: `Moved email ${(await gmail.trashEmail(auth, args.message_id)).id} to trash` }] };
    case 'gmail_modify_labels': return { content: [{ type: 'text', text: `Modified labels for email ${(await gmail.modifyLabels(auth, args.message_id, args.add_labels || [], args.remove_labels || [])).id}` }] };
    case 'gmail_bulk_modify_labels': return { content: [{ type: 'text', text: JSON.stringify(await gmail.bulkModifyLabelsByQuery(auth, args.query, args.add_labels || [], args.remove_labels || [], args.max_results || 2000), null, 2) }] };
    default: return null;
  }
}

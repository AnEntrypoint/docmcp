export function formatDocsResponse(msg) {
  return { content: [{ type: 'text', text: msg }] };
}

export function formatJsonResponse(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function buildFormattingConfig(args, configMap) {
  const config = {};
  Object.entries(configMap).forEach(([argKey, configKey]) => {
    if (argKey in args && args[argKey] !== undefined) {
      config[configKey] = args[argKey];
    }
  });
  return config;
}

export function buildColorConfig(args) {
  if (!args.color) return null;
  const color = {};
  if (args.color.text_color) color.textColor = args.color.text_color;
  if (args.color.background_color) color.backgroundColor = args.color.background_color;
  return Object.keys(color).length > 0 ? color : null;
}

export function buildLabelConfig(args) {
  const config = { name: args.name };
  if (args.label_list_visibility) config.labelListVisibility = args.label_list_visibility;
  if (args.message_list_visibility) config.messageListVisibility = args.message_list_visibility;
  const color = buildColorConfig(args);
  if (color) config.color = color;
  return config;
}

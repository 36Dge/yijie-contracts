// Ordered producers. A family owns its specialized SDK names and source receipt.
export const families = [
  ['workflow-local', 'workflow-local', 'base'],
  ['chat-models', 'chat-models'], ['chat-models-v2', 'chat-models-v2'],
  ['scheduled-plan', 'scheduled-plan', 'base'],
  ['scheduled-plan-v2', 'scheduled-plan-v2', 'base'],
  ['scheduled-execution', 'scheduled-execution', 'base'],
  ['scheduled-draft', 'scheduled-draft'],
  ['scheduled-task-recovery', 'scheduled-task-recovery', 'base'],
  ['native-turn-timing', 'native-turn-timing'],
  ['artifact-media', 'artifact-media'],
  ['market-connectors', 'market-connectors'], ['market-provider', 'market-provider'],
  ['market-selection', 'market-selection'], ['market-broker-control', 'market-broker'],
  ['market-host', 'market-host'], ['experts', 'experts'],
  ['market-selection-v2', 'market-selection-v2'],
  ['market-host-v2', 'market-host-v2'], ['experts-v2', 'experts-v2'],
  ['web-retrieval', 'web-retrieval'],
  ['runtime-input-only', 'runtime-input-only'],
  ['runtime-chat-models', 'runtime-chat-models'],
  ['runtime-kimi-k31-pro', 'runtime-kimi-k31-pro'],
];
export const focused = new Set(['--native-conversation-only', '--native-mcp-only',
  '--runtime-permissions-only', '--artifact-files-only', '--workflow-local-only']);
export const artifactFamilies = new Set(['artifact-media', 'market-selection',
  'market-broker-control', 'market-host', 'experts', 'chat-models-v2',
  'market-selection-v2', 'market-host-v2', 'experts-v2']);

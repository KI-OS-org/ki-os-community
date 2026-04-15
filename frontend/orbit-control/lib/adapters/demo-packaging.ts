export function getDemoPackagingSnapshot() {
  return {
    category: 'Enterprise AI Control Plane',
    readiness: 'pilot-ready',
    visibility: {
      live: ['control-plane', 'governance', 'pilot'],
      partial: ['workspace-streaming', 'integrations'],
      demo: ['retail-pitch', 'investor-summary']
    }
  };
}

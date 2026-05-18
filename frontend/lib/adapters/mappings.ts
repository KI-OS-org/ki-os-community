export const mappingsAdapter = {
  async getStudio() {
    return {
      mappingObjects: ['Connection', 'Trigger', 'Action', 'Mapping', 'Credential Profile', 'Automation Run', 'Webhook Endpoint', 'Retry / Replay Job'],
      supports: ['field-mapping', 'transformation-preview', 'input-output-mapping']
    };
  },
  async getAutomationRuns() {
    return {
      monitor: ['success', 'failure', 'retryable', 'replayed'],
      supports: ['run-logs', 'retry', 'replay', 'automation-runs']
    };
  }
};

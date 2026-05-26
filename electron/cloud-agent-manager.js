const { spawn } = require('child_process');
const path = require('path');
const { getScriptRuntime } = require('./runtime');

let agentProcess = null;

function startEmbeddedCloudAgent(port = 3847) {
  if (agentProcess) return;

  const script = path.join(__dirname, '../cloud/agent/index.js');
  const runtime = getScriptRuntime();

  agentProcess = spawn(runtime.exec, [script], {
    env: {
      ...process.env,
      ...runtime.extraEnv,
      FACILITYOS_SERVER_URL: `http://127.0.0.1:${port}`,
      FACILITYOS_AGENT_TERMINAL: 'embedded-agent',
    },
    stdio: 'pipe',
    windowsHide: true,
  });

  agentProcess.stdout?.on('data', (d) => console.log('[cloud-agent]', d.toString().trim()));
  agentProcess.stderr?.on('data', (d) => console.error('[cloud-agent]', d.toString().trim()));
  agentProcess.on('exit', (code) => {
    console.log('[cloud-agent] exited', code);
    agentProcess = null;
  });
}

function stopEmbeddedCloudAgent() {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
}

module.exports = { startEmbeddedCloudAgent, stopEmbeddedCloudAgent };

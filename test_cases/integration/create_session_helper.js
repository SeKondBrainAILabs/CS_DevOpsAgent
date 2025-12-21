import { SessionCoordinator } from '../../src/session-coordinator.js';
import fs from 'fs';
import path from 'path';

// Override prompt methods to automate inputs
class AutomatedSessionCoordinator extends SessionCoordinator {
  async promptForTask() {
    return 'e2e-test-feature';
  }
  
  // Skip prompts by returning success/defaults
  async ensureHouseRulesSetup() {
    // Manually ensure house rules exist to satisfy check
    const houseRulesPath = path.join(this.repoRoot, 'houserules.md');
    if (!fs.existsSync(houseRulesPath)) {
        // Fallback if not created by test script
        console.log('Automated: Creating houserules.md');
        fs.writeFileSync(houseRulesPath, '# Automated House Rules');
    }
    return;
  }
  
  async ensureGlobalSetup() {
    // Assume global settings mocked by shell script
    return;
  }
  
  async ensureProjectSetup() {
    // Assume project settings mocked by shell script
    return;
  }
  
  async ensureGroqApiKey() {
    // Skip AI key prompt
    return;
  }
  
  // Skip Docker prompt
  async ensureDockerConfig() {
    return { enabled: false };
  }
  
  // Skip Auto-merge prompt
  async promptForMergeConfig() {
    return { autoMerge: false };
  }
  
  async waitForConfirmation(sessionId) {
    console.log(`Automated: Skipping confirmation for session ${sessionId}`);
    return;
  }
  
  // Override displayInstructions to avoid clutter
  displayInstructions(instructions, sessionId, task) {
    console.log(`Automated: Instructions generated for ${sessionId}`);
  }
}

async function run() {
  console.log('Starting Automated Session Creation...');
  const coordinator = new AutomatedSessionCoordinator();
  
  try {
    const session = await coordinator.createAndStart({ 
        task: 'e2e-test-feature', 
        agent: 'test-agent' 
    });
    
    console.log('Session Created Successfully');
    console.log(JSON.stringify(session, null, 2));
    
    // We need to keep the process alive if the agent is running in background?
    // createAndStart calls startAgent which uses fork.
    // The child process is detached? No, fork is attached.
    // But startAgent puts a listener on exit.
    
    // In test environment, we want to verify session creation and then exit.
    // But if we exit, the forked agent might die if not detached.
    // However, for the purpose of checking "Session lock created", we just need to wait a bit.
    
    // Let's wait 5 seconds then exit
    setTimeout(() => {
        console.log('Automated: Exiting helper');
        process.exit(0);
    }, 5000);
    
  } catch (err) {
    console.error('Failed to create session:', err);
    process.exit(1);
  }
}

run();

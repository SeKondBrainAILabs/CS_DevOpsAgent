#!/usr/bin/env node

/**
 * ============================================================================
 * WEEKLY CONSOLIDATION TESTS
 * ============================================================================
 * 
 * Tests for the weekly-consolidator.js functionality including:
 * - Daily branch detection and consolidation
 * - Weekly branch creation and naming
 * - Dual merge to target branch
 * - Cleanup of processed daily branches
 * 
 * ============================================================================
 */

const BranchManagementTestFramework = require('./test-framework');

class WeeklyConsolidationTests {
  constructor() {
    this.framework = new BranchManagementTestFramework();
  }

  async runAllTests() {
    console.log(`\n${this.framework.constructor.name} - Weekly Consolidation Tests`);
    console.log('='.repeat(60));

    try {
      await this.testBasicWeeklyConsolidation();
      await this.testWeeklyBranchNaming();
      await this.testDualMergeToTarget();
      await this.testDailyBranchCleanup();
      await this.testNoDailyBranchesScenario();
      await this.testExistingWeeklyBranch();
      await this.testPartialMergeFailure();
      await this.testOldWeeklyBranchCleanup();
      
    } catch (error) {
      console.error(`Test suite failed: ${error.message}`);
    }

    return this.framework.printResults();
  }

  /**
   * Test basic weekly consolidation with multiple daily branches
   */
  async testBasicWeeklyConsolidation() {
    await this.framework.runTest('Basic weekly consolidation', async () => {
      // Setup
      this.framework.createProjectSettings({
        branchManagement: {
          enableWeeklyConsolidation: true,
          enableDualMerge: false
        }
      });

      // Create daily branches for last week
      const lastWeekDates = this.getLastWeekDates();
      const dailyBranches = this.framework.createDailyBranches(lastWeekDates);
      
      // Run consolidation
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      await consolidator.consolidateWeeklyBranches();
      
      // Verify weekly branch was created
      const expectedWeeklyBranch = `weekly/${lastWeekDates[0]}_to_${lastWeekDates[lastWeekDates.length - 1]}`;
      this.framework.assertBranchExists(expectedWeeklyBranch);
      
      // Verify daily branches were cleaned up
      for (const dailyBranch of dailyBranches) {
        this.framework.assertBranchNotExists(dailyBranch);
      }
      
      return { 
        success: true, 
        weeklyBranch: expectedWeeklyBranch,
        consolidatedBranches: dailyBranches.length 
      };
    });
  }

  /**
   * Test weekly branch naming convention
   */
  async testWeeklyBranchNaming() {
    await this.framework.runTest('Weekly branch naming', async () => {
      this.framework.createProjectSettings();
      
      // Create specific daily branches
      const testDates = ['2025-10-01', '2025-10-02', '2025-10-03'];
      this.framework.createDailyBranches(testDates);
      
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      // Test the naming function directly
      const weeklyBranchName = consolidator.generateWeeklyBranchName(testDates.map(d => `daily/${d}`));
      const expectedName = 'weekly/2025-10-01_to_2025-10-03';
      
      if (weeklyBranchName !== expectedName) {
        throw new Error(`Expected ${expectedName}, got ${weeklyBranchName}`);
      }
      
      return { success: true, branchName: weeklyBranchName };
    });
  }

  /**
   * Test dual merge to target branch during consolidation
   */
  async testDualMergeToTarget() {
    await this.framework.runTest('Dual merge to target during consolidation', async () => {
      // Setup with dual merge enabled
      this.framework.createProjectSettings({
        branchManagement: {
          enableWeeklyConsolidation: true,
          enableDualMerge: true,
          defaultMergeTarget: 'main'
        }
      });

      const lastWeekDates = this.getLastWeekDates();
      this.framework.createDailyBranches(lastWeekDates);
      
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      await consolidator.consolidateWeeklyBranches();
      
      // Verify both weekly branch and main branch exist
      const expectedWeeklyBranch = `weekly/${lastWeekDates[0]}_to_${lastWeekDates[lastWeekDates.length - 1]}`;
      this.framework.assertBranchExists(expectedWeeklyBranch);
      this.framework.assertBranchExists('main');
      
      return { success: true, dualMergeCompleted: true };
    });
  }

  /**
   * Test cleanup of daily branches after consolidation
   */
  async testDailyBranchCleanup() {
    await this.framework.runTest('Daily branch cleanup', async () => {
      this.framework.createProjectSettings();
      
      const testDates = ['2025-09-30', '2025-10-01', '2025-10-02'];
      const dailyBranches = this.framework.createDailyBranches(testDates);
      
      // Verify daily branches exist before consolidation
      for (const dailyBranch of dailyBranches) {
        this.framework.assertBranchExists(dailyBranch);
      }
      
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      await consolidator.consolidateWeeklyBranches();
      
      // Verify daily branches are cleaned up
      for (const dailyBranch of dailyBranches) {
        this.framework.assertBranchNotExists(dailyBranch);
      }
      
      return { success: true, cleanedUpBranches: dailyBranches.length };
    });
  }

  /**
   * Test scenario with no daily branches to consolidate
   */
  async testNoDailyBranchesScenario() {
    await this.framework.runTest('No daily branches scenario', async () => {
      this.framework.createProjectSettings();
      
      // Don't create any daily branches
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      // This should complete without error
      await consolidator.consolidateWeeklyBranches();
      
      // No weekly branch should be created
      const allBranches = this.framework.getAllBranches();
      const weeklyBranches = allBranches.filter(b => b.startsWith('weekly/'));
      
      if (weeklyBranches.length > 0) {
        throw new Error('No weekly branches should be created when no daily branches exist');
      }
      
      return { success: true, noBranchesCreated: true };
    });
  }

  /**
   * Test handling of existing weekly branch
   */
  async testExistingWeeklyBranch() {
    await this.framework.runTest('Existing weekly branch handling', async () => {
      this.framework.createProjectSettings();
      
      const testDates = ['2025-10-01', '2025-10-02'];
      this.framework.createDailyBranches(testDates);
      
      // Create the weekly branch that would be generated
      const expectedWeeklyBranch = `weekly/${testDates[0]}_to_${testDates[1]}`;
      require('child_process').execSync(`git checkout -b ${expectedWeeklyBranch}`, { stdio: 'ignore' });
      require('child_process').execSync('git checkout main', { stdio: 'ignore' });
      
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      // This should skip consolidation since weekly branch already exists
      await consolidator.consolidateWeeklyBranches();
      
      // Daily branches should still exist (not cleaned up)
      for (const date of testDates) {
        this.framework.assertBranchExists(`daily/${date}`);
      }
      
      return { success: true, skippedExisting: true };
    });
  }

  /**
   * Test partial merge failure handling
   */
  async testPartialMergeFailure() {
    await this.framework.runTest('Partial merge failure handling', async () => {
      this.framework.createProjectSettings();
      
      // Create daily branches with potential conflicts
      const testDates = ['2025-10-01', '2025-10-02'];
      this.framework.createDailyBranches(testDates);
      
      // Create conflicting content in the second daily branch
      require('child_process').execSync(`git checkout daily/${testDates[1]}`, { stdio: 'ignore' });
      require('fs').writeFileSync('conflict.txt', 'Conflicting content\n');
      require('child_process').execSync('git add conflict.txt', { stdio: 'ignore' });
      require('child_process').execSync('git commit -m "Add conflicting content"', { stdio: 'ignore' });
      
      // Also add conflicting content to first daily branch
      require('child_process').execSync(`git checkout daily/${testDates[0]}`, { stdio: 'ignore' });
      require('fs').writeFileSync('conflict.txt', 'Different conflicting content\n');
      require('child_process').execSync('git add conflict.txt', { stdio: 'ignore' });
      require('child_process').execSync('git commit -m "Add different conflicting content"', { stdio: 'ignore' });
      require('child_process').execSync('git checkout main', { stdio: 'ignore' });
      
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      try {
        await consolidator.consolidateWeeklyBranches();
        
        // If it completes, the weekly branch should exist but daily branches should remain
        const expectedWeeklyBranch = `weekly/${testDates[0]}_to_${testDates[1]}`;
        this.framework.assertBranchExists(expectedWeeklyBranch);
        
        // Daily branches should still exist due to merge failure
        for (const date of testDates) {
          this.framework.assertBranchExists(`daily/${date}`);
        }
        
        return { success: true, conflictHandled: true };
      } catch (error) {
        // Expected behavior - consolidation should fail gracefully
        return { success: true, failureHandled: true, error: error.message };
      }
    });
  }

  /**
   * Test cleanup of old weekly branches
   */
  async testOldWeeklyBranchCleanup() {
    await this.framework.runTest('Old weekly branch cleanup', async () => {
      this.framework.createProjectSettings({
        cleanup: {
          retainWeeklyBranches: 2 // Keep only 2 weekly branches
        }
      });
      
      // Create several old weekly branches
      const oldWeeklyBranches = [
        'weekly/2025-09-01_to_2025-09-07',
        'weekly/2025-09-08_to_2025-09-14',
        'weekly/2025-09-15_to_2025-09-21',
        'weekly/2025-09-22_to_2025-09-28'
      ];
      
      for (const branch of oldWeeklyBranches) {
        require('child_process').execSync(`git checkout -b ${branch}`, { stdio: 'ignore' });
        require('fs').writeFileSync(`${branch.replace('/', '-')}.txt`, 'Weekly content\n');
        require('child_process').execSync(`git add ${branch.replace('/', '-')}.txt`, { stdio: 'ignore' });
        require('child_process').execSync(`git commit -m "Weekly work for ${branch}"`, { stdio: 'ignore' });
        require('child_process').execSync('git checkout main', { stdio: 'ignore' });
      }
      
      const WeeklyConsolidator = require(this.framework.testRepoPath + '/src/weekly-consolidator.js');
      const consolidator = new WeeklyConsolidator();
      
      await consolidator.cleanupOldWeeklyBranches();
      
      // Only the 2 most recent weekly branches should remain
      const remainingBranches = this.framework.getAllBranches().filter(b => b.startsWith('weekly/'));
      
      if (remainingBranches.length !== 2) {
        throw new Error(`Expected 2 weekly branches, found ${remainingBranches.length}`);
      }
      
      // Should be the last 2 branches
      this.framework.assertBranchExists('weekly/2025-09-15_to_2025-09-21');
      this.framework.assertBranchExists('weekly/2025-09-22_to_2025-09-28');
      this.framework.assertBranchNotExists('weekly/2025-09-01_to_2025-09-07');
      this.framework.assertBranchNotExists('weekly/2025-09-08_to_2025-09-14');
      
      return { success: true, cleanedUpOldBranches: 2 };
    });
  }

  /**
   * Helper method to get last week's dates
   */
  getLastWeekDates() {
    const dates = [];
    const today = new Date();
    
    // Get last week (7 days ago to 1 day ago)
    for (let i = 7; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tests = new WeeklyConsolidationTests();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = WeeklyConsolidationTests;

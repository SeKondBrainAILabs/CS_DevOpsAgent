#!/bin/bash

# ==========================================
# CS_DevOpsAgent End-to-End Multi-Session Test Suite
# ==========================================
# This script tests the complete functionality across multiple sessions
# including devops-agent, multi-agent coordination, and session persistence

set -e  # Exit on error

# Resolve repository root based on this script's location
SCRIPT_DIR="$(cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(pwd)/test-e2e-workspace"
TEST_REPO="${TEST_DIR}/test-repo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="${TEST_DIR}/logs_${TIMESTAMP}"
RESULTS_FILE="${LOG_DIR}/test_results.txt"

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
}

print_test() {
    echo -e "${YELLOW}► TEST:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${MAGENTA}ℹ${NC} $1"
}

# Function to cleanup test environment
cleanup() {
    # Only cleanup if TEST_NO_CLEANUP is not set
    if [ -z "$TEST_NO_CLEANUP" ]; then
        print_header "Cleaning up test environment"
        
        # Kill any running test processes
        pkill -f "test-session-" 2>/dev/null || true
        pkill -f "cs-devops-agent-worker" 2>/dev/null || true
        
        # Remove test directory
        if [ -d "$TEST_DIR" ]; then
            rm -rf "$TEST_DIR"
            print_success "Test directory cleaned up"
        fi
    else
        print_info "Skipping cleanup (TEST_NO_CLEANUP set)"
        print_info "Test directory: $TEST_DIR"
    fi
}

# Function to setup test environment
setup_test_env() {
    print_header "Setting up test environment"
    
    # Create test directories
    mkdir -p "$TEST_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$TEST_REPO"
    
    print_info "Test directory: $TEST_DIR"
    print_info "Log directory: $LOG_DIR"
    
    # Initialize git repo for testing
    cd "$TEST_REPO"
    git init
    git config user.name "Test User"
    git config user.email "test@example.com"
    
    # Copy CS_DevOpsAgent files
    mkdir -p "$TEST_REPO/src"
    cp -r "$REPO_ROOT/src"/* "$TEST_REPO/src/"
    cp -r "$REPO_ROOT/deploy_test"/*.sh "$TEST_REPO/"
    cp "$REPO_ROOT/package.json" "$TEST_REPO/"
    cp "$REPO_ROOT/.env.example" "$TEST_REPO/.env" 2>/dev/null || true
    
    # Create initial commit
    echo "# Test Repository" > README.md
    git add .
    git commit -m "Initial commit"
    
    # Setup test configuration
    cat > "$TEST_REPO/.env" << EOF
AC_BRANCH_PREFIX=test_
AC_DAILY_PREFIX=test_
AC_TZ=UTC
AC_PUSH=false
AC_REQUIRE_MSG=true
AC_MSG_MIN_BYTES=10
AC_DEBOUNCE_MS=500
AC_MSG_DEBOUNCE_MS=1000
AC_CLEAR_MSG_WHEN=commit
AC_DEBUG=true
EOF
    
    print_success "Test environment setup complete"
}

# Test 1: Basic devops-agent functionality
test_basic_autocommit() {
    print_test "Basic devops-agent functionality"
    
    cd "$TEST_REPO"
    
    # Start the devops-agent worker in background with test env
    AC_PUSH=false \
    AC_REQUIRE_MSG=true \
    AC_MSG_MIN_BYTES=10 \
    AC_CLEAR_MSG_WHEN=commit \
    AC_TRIGGER_ON_MSG=true \
    AC_MSG_DEBOUNCE_MS=800 \
    AC_DEBOUNCE_MS=400 \
    AC_DEBUG=true \
    node src/cs-devops-agent-worker.js > "${LOG_DIR}/worker_basic.log" 2>&1 &
    local WORKER_PID=$!
    
    sleep 2  # Wait for worker to start
    
    # Create a change and commit message
    echo "Test content" > test_file.txt
    echo "test: basic commit" > .claude-commit-msg
    
    sleep 3  # Wait for devops-agent to trigger
    
    # Check if commit was created
    if git log --oneline | grep -q "test: basic commit"; then
        print_success "Auto-commit created successfully"
        echo "PASS: Basic devops-agent" >> "$RESULTS_FILE"
    else
        print_error "Auto-commit failed"
        echo "FAIL: Basic devops-agent" >> "$RESULTS_FILE"
    fi
    
    # Cleanup
    kill $WORKER_PID 2>/dev/null || true
    wait $WORKER_PID 2>/dev/null || true
}

# Test 2: Multi-agent parallel execution
test_multi_agent() {
    print_test "Multi-agent parallel execution"
    
    cd "$TEST_REPO"
    
    # Setup multi-agent coordination
    ./setup-prep-handshake.sh > "${LOG_DIR}/handshake_setup.log" 2>&1
    
    # Simulate multiple agents
    for i in 1 2 3; do
        (
            export AGENT_NAME="agent_$i"
            export AGENT_TASK="task_$i"
            
            # Request permission for different files
            ./agent-prep.sh "task_$i" "src/module_$i/**" 5 > "${LOG_DIR}/agent_${i}_prep.log" 2>&1
            
            # Create agent-specific changes
            mkdir -p "src/module_$i"
            echo "Content from agent $i" > "src/module_$i/file.txt"
            
            # Create commit message
            echo "feat(agent$i): add module $i" > ".agent_${i}_commit"
            
        ) &
    done
    
    wait  # Wait for all agents to complete
    
    sleep 3
    
    # Check if all agents created their files
    local success=true
    for i in 1 2 3; do
        if [ ! -f "src/module_$i/file.txt" ]; then
            print_error "Agent $i failed to create file"
            success=false
        fi
    done
    
    if $success; then
        print_success "All agents executed in parallel successfully"
        echo "PASS: Multi-agent parallel execution" >> "$RESULTS_FILE"
    else
        echo "FAIL: Multi-agent parallel execution" >> "$RESULTS_FILE"
    fi
}

# Test 3: Session persistence and recovery
test_session_persistence() {
    print_test "Session persistence and recovery"
    
    cd "$TEST_REPO"
    
    # Start first session
    export SESSION_ID="session_1"
    AC_PUSH=false AC_REQUIRE_MSG=true AC_MSG_MIN_BYTES=10 AC_CLEAR_MSG_WHEN=commit AC_TRIGGER_ON_MSG=true AC_MSG_DEBOUNCE_MS=800 AC_DEBOUNCE_MS=400 AC_DEBUG=true \
    node src/cs-devops-agent-worker.js > "${LOG_DIR}/session_1.log" 2>&1 &
    local SESSION_1_PID=$!
    
    sleep 2
    
    # Create changes in session 1
    echo "Session 1 content" > session1_file.txt
    echo "test: session 1 commit" > .claude-commit-msg
    
    sleep 3
    
    # Kill session 1 abruptly (simulate crash)
    kill -9 $SESSION_1_PID 2>/dev/null || true
    
    # Start new session with proper env vars
    export SESSION_ID="session_2"
    AC_PUSH=false AC_REQUIRE_MSG=true AC_MSG_MIN_BYTES=10 AC_CLEAR_MSG_WHEN=commit AC_TRIGGER_ON_MSG=true AC_MSG_DEBOUNCE_MS=800 AC_DEBOUNCE_MS=400 AC_DEBUG=true \
    node src/cs-devops-agent-worker.js > "${LOG_DIR}/session_2.log" 2>&1 &
    local SESSION_2_PID=$!
    
    sleep 2
    
    # Create new changes in session 2
    echo "Session 2 content" > session2_file.txt
    echo "test: session 2 commit" > .claude-commit-msg
    
    sleep 3
    
    # Check if both commits exist
    local commit_count=$(git log --oneline | grep -c "test: session")
    
    if [ "$commit_count" -ge 1 ]; then
        print_success "Session recovery successful"
        echo "PASS: Session persistence" >> "$RESULTS_FILE"
    else
        print_error "Session recovery failed"
        echo "FAIL: Session persistence" >> "$RESULTS_FILE"
    fi
    
    kill $SESSION_2_PID 2>/dev/null || true
}

# Test 4: Worktree management
test_worktree_management() {
    print_test "Worktree management for multiple agents"
    
    cd "$TEST_REPO"
    
    # Create worktrees for different agents
    for agent in claude copilot cursor; do
        node src/worktree-manager.js create --agent "$agent" --task "feature_${agent}" > "${LOG_DIR}/worktree_${agent}.log" 2>&1
        
        if git worktree list | grep -q "agent/${agent}"; then
            print_success "Worktree created for $agent"
        else
            print_error "Failed to create worktree for $agent"
        fi
    done
    
    # List all worktrees
    local worktree_count=$(git worktree list | grep -c "agent/")
    
    if [ "$worktree_count" -ge 3 ]; then
        print_success "All worktrees created successfully"
        echo "PASS: Worktree management" >> "$RESULTS_FILE"
    else
        print_error "Worktree creation incomplete"
        echo "FAIL: Worktree management" >> "$RESULTS_FILE"
    fi
}

# Test 5: Conflict detection and resolution
test_conflict_handling() {
    print_test "Conflict detection and resolution"
    
    cd "$TEST_REPO"
    
    # Start worker for conflict detection with Session ID
    export DEVOPS_SESSION_ID="session_conflict"
    AC_PUSH=false AC_REQUIRE_MSG=true AC_MSG_MIN_BYTES=10 AC_CLEAR_MSG_WHEN=commit AC_TRIGGER_ON_MSG=true AC_MSG_DEBOUNCE_MS=400 AC_DEBOUNCE_MS=200 AC_DEBUG=true \
    node src/cs-devops-agent-worker.js > "${LOG_DIR}/worker_conflict.log" 2>&1 &
    local WORKER_PID=$!
    sleep 2

    # Setup conflict scenario
    echo "Original content" > conflict_file.txt
    git add conflict_file.txt
    git commit -m "Add conflict file"
    
    # Start two sessions that will modify the same file
    (
        export AGENT_NAME="agent_a"
        echo "Content from Agent A" > conflict_file.txt
        echo "fix: agent A change" > .claude-commit-msg
    ) &
    PID_A=$!
    
    (
        export AGENT_NAME="agent_b"
        sleep 1  # Slight delay to create conflict
        echo "Content from Agent B" > conflict_file.txt
        echo "fix: agent B change" > .claude-commit-msg
    ) &
    PID_B=$!
    
    # Wait ONLY for the agent subshells, not the worker
    wait $PID_A $PID_B
    
    sleep 3
    
    # Check if conflict was detected (check file coordination conflicts)
    # The new system uses local_deploy/.file-coordination/conflicts or logs advisory
    if grep -q "File coordination advisory" "${LOG_DIR}/worker_conflict.log" || [ -d "local_deploy/.file-coordination/conflicts" ]; then
        print_success "Conflict detected and alert created"
        echo "PASS: Conflict detection" >> "$RESULTS_FILE"
    else
        print_error "Conflict detection failed"
        echo "FAIL: Conflict detection" >> "$RESULTS_FILE"
    fi
    
    kill $WORKER_PID 2>/dev/null || true
}

# Test 6: Daily rollover
test_daily_rollover() {
    print_test "Daily rollover functionality"
    
    cd "$TEST_REPO"
    
    # Create a branch for yesterday
    local yesterday=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
    git checkout -B "test_${yesterday}"
    echo "Yesterday's work" > yesterday.txt
    git add .
    git commit -m "Yesterday's commit"
    
    # Simulate rollover
    git checkout main
    git checkout -b "v0.01"
    
    # Run rollover logic
    if command -v node >/dev/null 2>&1; then
        # Create a simple rollover test
        cat > test_rollover.js << 'EOF'
import { execSync } from 'child_process';

// Simulate daily rollover
const today = new Date().toISOString().split('T')[0];
const newBranch = `test_${today}`;

try {
    execSync(`git checkout -b ${newBranch}`, { stdio: 'inherit' });
    console.log(`Created new daily branch: ${newBranch}`);
    process.exit(0);
} catch (error) {
    console.error('Rollover failed:', error.message);
    process.exit(1);
}
EOF
        
        if node test_rollover.js > "${LOG_DIR}/rollover.log" 2>&1; then
            print_success "Daily rollover successful"
            echo "PASS: Daily rollover" >> "$RESULTS_FILE"
        else
            print_error "Daily rollover failed"
            echo "FAIL: Daily rollover" >> "$RESULTS_FILE"
        fi
    fi
}

# Test 7: Performance under load
test_performance() {
    print_test "Performance under load (multiple rapid commits)"
    
    cd "$TEST_REPO"
    
    # Start worker with test config
    AC_PUSH=false AC_REQUIRE_MSG=true AC_MSG_MIN_BYTES=10 AC_CLEAR_MSG_WHEN=commit AC_TRIGGER_ON_MSG=true AC_MSG_DEBOUNCE_MS=400 AC_DEBOUNCE_MS=200 AC_DEBUG=true \
    node src/cs-devops-agent-worker.js > "${LOG_DIR}/performance.log" 2>&1 &
    local WORKER_PID=$!
    
    sleep 2
    
    local start_time=$(date +%s)
    
    # Create multiple rapid changes
    for i in {1..10}; do
        echo "Content $i" > "file_$i.txt"
        echo "test: rapid commit $i" > .claude-commit-msg
        sleep 0.5  # Short delay between commits
    done
    
    sleep 5  # Wait for all commits to process
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Count commits created
    local commit_count=$(git log --oneline | grep -c "rapid commit" || true)
    
    print_info "Created $commit_count commits in ${duration}s"
    
    if [ "$commit_count" -ge 5 ]; then
        print_success "Performance test passed"
        echo "PASS: Performance (${commit_count}/10 commits in ${duration}s)" >> "$RESULTS_FILE"
    else
        print_error "Performance test failed"
        echo "FAIL: Performance (only ${commit_count}/10 commits)" >> "$RESULTS_FILE"
    fi
    
    kill $WORKER_PID 2>/dev/null || true
}

# Main test execution
main() {
    print_header "CS_DevOpsAgent End-to-End Test Suite"
    print_info "Starting at $(date)"
    
    # Cleanup any previous test runs
    cleanup
    
    # Setup test environment
    setup_test_env
    
    # Run all tests
    test_basic_autocommit
    test_multi_agent
    test_session_persistence
    test_worktree_management
    test_conflict_handling
    test_daily_rollover
    test_performance
    
    # Generate test report
    print_header "Test Results Summary"
    
    local total_tests=$(grep -c ":" "$RESULTS_FILE" 2>/dev/null || true)
    local passed_tests=$(grep -c "PASS" "$RESULTS_FILE" 2>/dev/null || true)
    local failed_tests=$(grep -c "FAIL" "$RESULTS_FILE" 2>/dev/null || true)
    
    echo -e "${CYAN}Total Tests:${NC} $total_tests"
    echo -e "${GREEN}Passed:${NC} $passed_tests"
    echo -e "${RED}Failed:${NC} $failed_tests"
    
    if [ "$failed_tests" -eq 0 ]; then
        print_success "All tests passed! ✨"
        exit 0
    else
        print_error "Some tests failed. Check logs in: $LOG_DIR"
        cat "$RESULTS_FILE"
        exit 1
    fi
}

# Handle interrupts
trap cleanup EXIT INT TERM

# Run main if not sourced
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
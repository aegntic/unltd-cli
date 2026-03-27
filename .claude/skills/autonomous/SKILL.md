---
name: Autonomous Workflow
description: Enable autonomous task continuation with task-based checkpoints and rollback capability
---

# Autonomous Workflow Skill

Enable OpenCode to work autonomously with automatic task continuation, checkpoints, and rollback.

## Usage

```
/autonomous init      # Initialize the autonomous system
/autonomous enable     # Enable autonomous mode
/autonomous add       # Add task to queue
/autonomous next      # Show/execute next task
/autonomous done      # Mark task complete
/autonomous checkpoints  # List checkpoints
/autonomous rollback  # Rollback to checkpoint
```

## Commands

### `/autonomous init`
Initialize the autonomous workflow system for the current session.

### `/autonomous enable`
Enable autonomous mode. When enabled, completing a task automatically shows the next task.

### `/autonomous add <task>`
Add a task to the queue. Tasks are executed sequentially.

### `/autonomous next`
Show the next task in the queue. In autonomous mode, this executes automatically after task completion.

### `/autonomous done`
Mark the current task as complete. Creates a checkpoint and shows the next task (if autonomous mode is enabled).

### `/autonomous checkpoints`
List all task-based checkpoints. Each checkpoint captures the workspace state.

### `/autonomous rollback <checkpoint-id>`
Rollback to a specific checkpoint. Restores workspace and task queue.

### `/autonomous rollback-last-good`
Rollback to the last successful checkpoint.

## How It Works

1. **Task-based checkpoints**: Snapshots are created when tasks complete, not on a timer
2. **Automatic continuation**: Next suggested step becomes the next prompt
3. **Rollback capability**: Revert to any checkpoint when things go wrong

## Examples

### Feature Development
```
/autonomous init
/autonomous enable
/autonomous add "Create database schema"
/autonomous add "Build API endpoints"
/autonomous add "Write tests"
/autonomous next  # Start first task
```

### Bug Fix Flow
```
/autonomous init
/autonomous add "Reproduce the bug"
/autonomous add "Identify root cause"
/autonomous add "Implement fix"
/autonomous add "Verify fix works"
```

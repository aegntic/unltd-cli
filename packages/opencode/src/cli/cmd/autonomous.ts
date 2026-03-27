import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

const AUTONOMOUS_DIR = path.join(os.homedir(), ".opencode", "autonomous")
const STATE_FILE = path.join(AUTONOMOUS_DIR, "state.json")
const TASK_QUEUE_FILE = path.join(AUTONOMOUS_DIR, "task_queue.json")
const CHECKPOINT_DIR = path.join(AUTONOMOUS_DIR, "checkpoints")

interface Task {
  id: string
  description: string
  status: "pending" | "in_progress" | "completed"
}

interface Checkpoint {
  id: string
  taskId: string
  taskDescription: string
  status: "completed" | "failed"
  timestamp: number
  gitHead?: string
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function readJson<T>(file: string, defaultValue: T): Promise<T> {
  try {
    const content = await readFile(file, "utf-8")
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

async function writeJson(file: string, data: unknown) {
  await ensureDir(path.dirname(file))
  await writeFile(file, JSON.stringify(data, null, 2), "utf-8")
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function createCheckpoint(taskId: string, taskDescription: string, status: "completed" | "failed"): Promise<string> {
  await ensureDir(AUTONOMOUS_DIR)
  await ensureDir(CHECKPOINT_DIR)

  const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const checkpoint: Checkpoint = {
    id: checkpointId,
    taskId,
    taskDescription,
    status,
    timestamp: Date.now(),
  }

  const checkpointPath = path.join(CHECKPOINT_DIR, checkpointId)
  await ensureDir(checkpointPath)
  await writeJson(path.join(checkpointPath, "checkpoint.json"), checkpoint)

  return checkpointId
}

async function listCheckpoints(): Promise<Checkpoint[]> {
  await ensureDir(CHECKPOINT_DIR)
  const checkpoints: Checkpoint[] = []

  try {
    const entries = await readdir(CHECKPOINT_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const checkpointFile = path.join(CHECKPOINT_DIR, entry.name, "checkpoint.json")
        if (existsSync(checkpointFile)) {
          const checkpoint = await readJson<Checkpoint>(checkpointFile, null as any)
          if (checkpoint) checkpoints.push(checkpoint)
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return checkpoints.sort((a, b) => b.timestamp - a.timestamp)
}

export const AutonomousCommand = cmd({
  command: "autonomous",
  describe: "autonomous task workflow with checkpoints and rollback",
  builder: (yargs: Argv) =>
    yargs
      .command(AutonomousInitCommand)
      .command(AutonomousEnableCommand)
      .command(AutonomousDisableCommand)
      .command(AutonomousAddCommand)
      .command(AutonomousNextCommand)
      .command(AutonomousStartCommand)
      .command(AutonomousDoneCommand)
      .command(AutonomousListCommand)
      .command(AutonomousCheckpointsCommand)
      .command(AutonomousRollbackCommand)
      .command(AutonomousStatusCommand)
      .demandCommand(),
  handler: () => {},
})

const AutonomousInitCommand = cmd({
  command: "init",
  describe: "initialize autonomous system",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      await ensureDir(AUTONOMOUS_DIR)
      const sessionId = Date.now()
      await writeJson(STATE_FILE, {
        sessionId,
        autonomousEnabled: false,
        lastCheckpoint: null,
        currentTask: null,
      })
      await writeJson(TASK_QUEUE_FILE, [])
      const checkpointId = await createCheckpoint("session_start", "Session initialized", "completed")
      UI.println(UI.Style.TEXT_SUCCESS + "Autonomous system initialized" + UI.Style.TEXT_NORMAL)
      UI.println(UI.Style.TEXT_INFO + `Initial checkpoint: ${checkpointId}` + UI.Style.TEXT_NORMAL)
    })
  },
})

const AutonomousEnableCommand = cmd({
  command: "enable",
  describe: "enable autonomous mode",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      await ensureDir(AUTONOMOUS_DIR)
      const state = await readJson(STATE_FILE, { autonomousEnabled: false })
      state.autonomousEnabled = true
      await writeJson(STATE_FILE, state)
      UI.println(UI.Style.TEXT_SUCCESS + "Autonomous mode enabled" + UI.Style.TEXT_NORMAL)
    })
  },
})

const AutonomousDisableCommand = cmd({
  command: "disable",
  describe: "disable autonomous mode",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const state = await readJson(STATE_FILE, { autonomousEnabled: true })
      state.autonomousEnabled = false
      await writeJson(STATE_FILE, state)
      UI.println(UI.Style.TEXT_SUCCESS + "Autonomous mode disabled" + UI.Style.TEXT_NORMAL)
    })
  },
})

const AutonomousAddCommand = cmd({
  command: "add <task>",
  describe: "add task to queue",
  builder: (yargs: Argv) => {
    return yargs.positional("task", {
      describe: "task description",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      await ensureDir(AUTONOMOUS_DIR)
      const tasks = await readJson<Task[]>(TASK_QUEUE_FILE, [])
      const newTask: Task = {
        id: generateId(),
        description: args.task,
        status: "pending",
      }
      tasks.push(newTask)
      await writeJson(TASK_QUEUE_FILE, tasks)
      UI.println(UI.Style.TEXT_SUCCESS + `Task added: ${args.task}` + UI.Style.TEXT_NORMAL)
    })
  },
})

const AutonomousNextCommand = cmd({
  command: "next",
  describe: "show next task",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const tasks = await readJson<Task[]>(TASK_QUEUE_FILE, [])
      const pending = tasks.filter((t) => t.status === "pending")

      if (pending.length === 0) {
        UI.println("No pending tasks in queue.")
        return
      }

      const nextTask = pending[0]
      UI.println(UI.Style.TEXT_NORMAL_BOLD + "\nNext Task:" + UI.Style.TEXT_NORMAL)
      UI.println(UI.Style.TEXT_SUCCESS + nextTask.description + UI.Style.TEXT_NORMAL)
      UI.println(`\nTask ID: ${nextTask.id}`)
      UI.println("\nTo start this task, use: opencode autonomous start")
    })
  },
})

const AutonomousStartCommand = cmd({
  command: "start",
  describe: "start the next pending task",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const tasks = await readJson<Task[]>(TASK_QUEUE_FILE, [])
      const pending = tasks.filter((t) => t.status === "pending")

      if (pending.length === 0) {
        UI.println("No pending tasks to start.")
        return
      }

      const nextTask = pending[0]
      const taskIndex = tasks.findIndex((t) => t.id === nextTask.id)
      tasks[taskIndex].status = "in_progress"
      await writeJson(TASK_QUEUE_FILE, tasks)

      UI.println(UI.Style.TEXT_SUCCESS + `Starting task: ${nextTask.description}` + UI.Style.TEXT_NORMAL)
      UI.println(UI.Style.TEXT_INFO + "\nWhen done, use: opencode autonomous done" + UI.Style.TEXT_NORMAL)
    })
  },
})

const AutonomousDoneCommand = cmd({
  command: "done",
  describe: "mark current task as complete",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const tasks = await readJson<Task[]>(TASK_QUEUE_FILE, [])
      const state = await readJson(STATE_FILE, { autonomousEnabled: false })

      const taskIndex = tasks.findIndex((t) => t.status === "in_progress")
      if (taskIndex === -1) {
        UI.error("No task in progress. Use 'opencode autonomous start' first.")
        return
      }

      const completedTask = tasks[taskIndex]
      completedTask.status = "completed"
      await writeJson(TASK_QUEUE_FILE, tasks)

      const checkpointId = await createCheckpoint(completedTask.id, completedTask.description, "completed")
      UI.println(UI.Style.TEXT_SUCCESS + `Checkpoint created: ${checkpointId}` + UI.Style.TEXT_NORMAL)
      UI.println(UI.Style.TEXT_SUCCESS + `Task completed: ${completedTask.description}` + UI.Style.TEXT_NORMAL)

      if (state.autonomousEnabled) {
        const nextTasks = tasks.filter((t) => t.status === "pending")
        if (nextTasks.length > 0) {
          UI.println(UI.Style.TEXT_NORMAL_BOLD + "\nNext Task:" + UI.Style.TEXT_NORMAL)
          UI.println(UI.Style.TEXT_SUCCESS + nextTasks[0].description + UI.Style.TEXT_NORMAL)
        } else {
          UI.println(UI.Style.TEXT_SUCCESS + "\nAll tasks completed!" + UI.Style.TEXT_NORMAL)
        }
      }
    })
  },
})

const AutonomousListCommand = cmd({
  command: "list",
  describe: "list task queue",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const tasks = await readJson<Task[]>(TASK_QUEUE_FILE, [])

      if (tasks.length === 0) {
        UI.println("Task queue is empty.")
        return
      }

      UI.println(UI.Style.TEXT_NORMAL_BOLD + "\nTask Queue:" + UI.Style.TEXT_NORMAL)
      for (const task of tasks) {
        const statusIcon = task.status === "completed" ? "✓" : task.status === "in_progress" ? "→" : "○"
        const statusColor = task.status === "completed" ? UI.Style.TEXT_SUCCESS : task.status === "in_progress" ? UI.Style.TEXT_WARNING : ""
        UI.println(`${statusColor}${statusIcon} ${task.description}${UI.Style.TEXT_NORMAL}`)
      }
    })
  },
})

const AutonomousCheckpointsCommand = cmd({
  command: "checkpoints",
  describe: "list checkpoints",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const checkpoints = await listCheckpoints()

      if (checkpoints.length === 0) {
        UI.println("No checkpoints found.")
        return
      }

      UI.println(UI.Style.TEXT_NORMAL_BOLD + "\nCheckpoints:" + UI.Style.TEXT_NORMAL)
      for (const cp of checkpoints) {
        const statusIcon = cp.status === "completed" ? "✓" : "✗"
        const date = new Date(cp.timestamp).toLocaleString()
        UI.println(`${UI.Style.TEXT_SUCCESS}${statusIcon} [${cp.id}] ${date}${UI.Style.TEXT_NORMAL}`)
        UI.println(`   Task: ${cp.taskDescription}`)
      }
    })
  },
})

const AutonomousRollbackCommand = cmd({
  command: "rollback <checkpoint>",
  describe: "rollback to checkpoint",
  builder: (yargs: Argv) => {
    return yargs.positional("checkpoint", {
      describe: "checkpoint ID",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const checkpoints = await listCheckpoints()
      const target = checkpoints.find((c) => c.id === args.checkpoint)

      if (!target) {
        UI.error(`Checkpoint not found: ${args.checkpoint}`)
        return
      }

      UI.println(UI.Style.TEXT_SUCCESS + `Rolling back to: ${target.taskDescription}` + UI.Style.TEXT_NORMAL)
      UI.println(`Checkpoint ID: ${target.id}`)
      UI.println("Note: Full workspace rollback requires git operations.")
    })
  },
})

const AutonomousStatusCommand = cmd({
  command: "status",
  describe: "show autonomous system status",
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      const state = await readJson(STATE_FILE, { sessionId: null, autonomousEnabled: false })
      const tasks = await readJson<Task[]>(TASK_QUEUE_FILE, [])
      const checkpoints = await listCheckpoints()

      UI.println(UI.Style.TEXT_NORMAL_BOLD + "\nAutonomous System Status" + UI.Style.TEXT_NORMAL)
      UI.println(`Session: ${state.sessionId || "not initialized"}`)
      UI.println(`Autonomous: ${state.autonomousEnabled ? UI.Style.TEXT_SUCCESS + "enabled" : UI.Style.TEXT_NORMAL + "disabled"}`)
      UI.println(`Tasks: ${tasks.filter((t) => t.status === "pending").length} pending, ${tasks.filter((t) => t.status === "completed").length} completed`)
      UI.println(`Checkpoints: ${checkpoints.length}`)
    })
  },
})

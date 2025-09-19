import { Controller, Get, Param } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import path from 'node:path'

function resolveQuestionsDir() {
  const envDir = process.env.QUESTIONS_DIR
  const candidates = [
    envDir && path.resolve(envDir),
    // When running from repo root
    path.resolve(process.cwd(), 'questions'),
    // When backend cwd is ./backend
    path.resolve(process.cwd(), '..', 'questions'),
    // When resolving relative to compiled JS output
    path.resolve(__dirname, '..', 'questions'),
    path.resolve(__dirname, '..', '..', 'questions'),
  ].filter(Boolean) as string[]
  return candidates.find(syncDirExists) || candidates[0] || path.resolve(process.cwd(), 'questions')
}

function syncDirExists(p: string) {
  try {
    const st = require('fs').statSync(p)
    return st.isDirectory()
  } catch { return false }
}

function isAllowedFile(name: string) {
  const ext = path.extname(name).toLowerCase()
  return ext === '.txt' || ext === '.md'
}

@Controller('questions')
export class QuestionsController {
  private baseDir: string
  constructor() {
    this.baseDir = resolveQuestionsDir()
  }

  @Get()
  async list() {
    try {
      const items = await fs.readdir(this.baseDir)
      const files = [] as { name: string }[]
      for (const it of items) {
        if (!isAllowedFile(it)) continue
        const full = path.join(this.baseDir, it)
        const st = await fs.stat(full).catch(() => null)
        if (st && st.isFile()) files.push({ name: it })
      }
      return { files }
    } catch {
      // Directory absent or unreadable — return empty list
      return { files: [] }
    }
  }

  @Get(':name')
  async get(@Param('name') name: string) {
    // Prevent path traversal; only allow base filenames with allowed extensions
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\') || !isAllowedFile(name)) {
      return { statusCode: 400, statusMessage: 'invalid file name' }
    }
    const full = path.join(this.baseDir, name)
    try {
      const content = await fs.readFile(full, 'utf8')
      // Normalize newlines
      const normalized = content.replace(/\r\n?/g, '\n')
      const questions = normalized
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
      return { content: normalized, questions }
    } catch {
      return { statusCode: 404, statusMessage: 'file not found' }
    }
  }
}

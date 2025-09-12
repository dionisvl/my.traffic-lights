import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { createGame, getSnapshot } from './store'

@Controller('game')
export class GameController {
  @Post()
  async create(@Body() body: { questions: string[] }) {
    if (!Array.isArray(body?.questions) || body.questions.length < 1) {
      return { statusCode: 400, statusMessage: 'questions must be non-empty array' }
    }
    const gameId = await createGame(body.questions)
    return { gameId }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return await getSnapshot(id)
  }
}


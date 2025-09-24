import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { chooseAnswer, joinGame, setOnline, setReady, startGame, submitComment } from './store'

type Role = 'p1'|'p2'

@WebSocketGateway({ cors: { origin: '*'} })
export class GameGateway {
  @WebSocketServer()
  io!: Server

  private room(gameId: string) { return `room:game:${gameId}` }

  handleConnection(_socket: Socket) {
    // no-op
  }

  handleDisconnect(socket: Socket) {
    const { gameId, role } = (socket.data || {}) as { gameId?: string; role?: Role }
    if (gameId && role) {
      Promise.resolve(setOnline(gameId, role, false))
        .then(() => this.io.to(this.room(gameId)).emit('player_status', { player: role, online: false }))
        .catch(() => {})
    }
  }

  @SubscribeMessage('join_game')
  async onJoin(@ConnectedSocket() socket: Socket, @MessageBody() body: { gameId: string; playerId: string }) {
    try {
      const role = await joinGame(body.gameId, body.playerId)
      socket.data = { ...(socket.data||{}), gameId: body.gameId, role }
      socket.join(this.room(body.gameId))
      socket.emit('joined', { role })
      await setOnline(body.gameId, role, true)
      this.io.to(this.room(body.gameId)).emit('player_status', { player: role, online: true })
      this.io.to(this.room(body.gameId)).emit('player_joined', { player: role })
    } catch (e: any) {
      socket.emit('error', { code: 'join_failed', message: e?.message || 'join failed' })
    }
  }

  @SubscribeMessage('start_game')
  async onStart(@ConnectedSocket() socket: Socket, @MessageBody() body: { gameId: string }) {
    const role = ((socket.data||{}).role || 'p1') as Role
    try {
      await startGame(body.gameId, role)
      this.io.to(this.room(body.gameId)).emit('game_started', {})
      this.io.to(this.room(body.gameId)).emit('question_show', { questionIndex: 0 })
    } catch (e: any) {
      socket.emit('error', { code: 'start_failed', message: e?.message || 'start failed' })
    }
  }

  @SubscribeMessage('choose_answer')
  async onChoose(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { gameId: string; questionIndex: number; answer: 'red'|'yellow'|'green' },
  ) {
    const role = ((socket.data||{}).role || 'p1') as Role
    try {
      await chooseAnswer(body.gameId, role, body.questionIndex, body.answer)
      socket.to(this.room(body.gameId)).emit('answer_updated', { questionIndex: body.questionIndex })
    } catch (e: any) {
      socket.emit('error', { code: 'choose_failed', message: e?.message || 'choose failed' })
    }
  }

  @SubscribeMessage('submit_comment')
  async onComment(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { gameId: string; questionIndex: number; comment: string },
  ) {
    const role = ((socket.data||{}).role || 'p1') as Role
    try {
      await submitComment(body.gameId, role, body.questionIndex, body.comment)
      // Notify all players including the author about comment change
      this.io.to(this.room(body.gameId)).emit('comment_received', { questionIndex: body.questionIndex, player: role })
    } catch (e: any) {
      socket.emit('error', { code: 'comment_failed', message: e?.message || 'comment failed' })
    }
  }

  @SubscribeMessage('ready_next')
  async onReady(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { gameId: string; questionIndex: number; ready: boolean },
  ) {
    const role = ((socket.data||{}).role || 'p1') as Role
    try {
      const s = await setReady(body.gameId, role, body.questionIndex, body.ready)
      // Inform clients about readiness change even if no transition happens
      this.io.to(this.room(body.gameId)).emit('ready_updated', { questionIndex: body.questionIndex, player: role, ready: body.ready })
      const idx = s.currentQuestionIndex
      if (s.status === 'completed') {
        this.io.to(this.room(body.gameId)).emit('game_completed', { })
      } else if (idx > body.questionIndex) {
        // Only send next_question if we actually moved to next question
        this.io.to(this.room(body.gameId)).emit('next_question', { questionIndex: idx })
      }
      // If idx === body.questionIndex, no transition happened, don't send next_question
    } catch (e: any) {
      socket.emit('error', { code: 'ready_failed', message: e?.message || 'ready failed' })
    }
  }

}

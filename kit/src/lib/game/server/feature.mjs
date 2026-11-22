import { randomUUID } from 'node:crypto';
import * as game from '../domain.ts';
import { Failure, requireThat } from '../../server/failure.mjs';
import { repository } from './repository.mjs';

async function body(req) {
  let size=0; const chunks=[];
  for await (const chunk of req.iterator({destroyOnReturn:false})) {
    size+=chunk.length; requireThat(size<=131072,413,'Request too large'); chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks));} catch {throw new Failure(400,'Invalid JSON');}
}

export function createGameFeature({ pool, io, origin }) {
  const repo = repository(pool);
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
  const member = (state, id) => ['p1','p2'].find(role => state.players[role].id === id);
  const room = id => `game:${id}`;
  const queues = new Map();
  function serialize(id, fn) {
    const task = (queues.get(id) ?? Promise.resolve()).then(fn);
    const tail = task.catch(() => {});
    queues.set(id, tail);
    void tail.then(() => { if (queues.get(id) === tail) queues.delete(id); });
    return task;
  }
  function result(r) { requireThat(r.ok, r.error?.code === 'forbidden' ? 403 : 409, r.error?.message); return r.value; }
  async function get(id, source=repo) {
    requireThat(uuid(id),400,'Invalid game');
    const state=await source.get(id);
    requireThat(state,404,'Game not found');
    return state;
  }
  async function transaction(fn) {
    const db=await pool.connect();
    try { await db.query('BEGIN'); const value=await fn(repository(db)); await db.query('COMMIT'); return value; }
    catch(error) { await db.query('ROLLBACK').catch(() => {}); throw error; }
    finally { db.release(); }
  }
  const online = (id, role) => [...(io.sockets.adapter.rooms.get(room(id)) ?? [])].some(socketId => io.sockets.sockets.get(socketId)?.data.role===role);
  function view(state, role) {
    return game.toPlayerView(state, role, { p1: online(state.id, 'p1'), p2: online(state.id, 'p2') });
  }

  async function http(req, path, reply) {
    const id=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    requireThat(uuid(id),401,'Player identity required');
    if(req.method==='POST' && path==='/api/game') {
      requireThat(!req.headers.origin || req.headers.origin===origin,403,'Invalid origin');
      const {questions}=await body(req) ?? {};
      requireThat(Array.isArray(questions)&&questions.length>0&&questions.length<=100&&questions.every(x=>typeof x==='string'&&x.trim()&&x.length<=500),400,'Enter 1–100 questions, up to 500 characters each');
      const state=result(game.createGame(randomUUID(),questions.map(x=>x.trim())));
      state.players.p1.id=id;
      await transaction(r=>r.put(state));
      return reply(201,{gameId:state.id});
    }
    const match=path.match(/^\/api\/game\/([^/]+)$/);
    requireThat(req.method==='GET'&&match,404,'Not found');
    const snapshot=await serialize(match[1],async()=>{
      const state=await get(match[1]); const role=member(state,id);
      requireThat(role,403,'Not a player in this game'); return view(state,role);
    });
    return reply(200,snapshot);
  }

  io.use((socket,next)=>uuid(socket.handshake.auth.playerId) ? next() : next(new Error('Player identity required')));
  async function publish(id) {
    const state=await get(id);
    for(const socketId of io.sockets.adapter.rooms.get(room(id)) ?? []) {
      const socket=io.sockets.sockets.get(socketId); const role=socket && member(state,socket.handshake.auth.playerId);
      if(role) socket.emit('snapshot',view(state,role));
    }
  }
  io.on('connection',socket=>{
    const playerId=socket.handshake.auth.playerId;
    function event(name,fn) {
      socket.on(name,(data,ack)=>{
        if(typeof ack!=='function') return;
        if(!uuid(data?.gameId)) return ack({ok:false,error:'Invalid game'});
        void serialize(data.gameId,()=>fn(data)).then(value=>ack({ok:true,...value})).catch(error=>{
          if(!error.status) console.error(error.message);
          ack({ok:false,error:error.status?error.message:'Server error'});
        });
      });
    }
    event('join_game',async ({gameId})=>{
      requireThat(!socket.data.gameId||socket.data.gameId===gameId,403,'Connection belongs to another game');
      const {state,role}=await transaction(async r=>{
        const state=await get(gameId,r); const existing=member(state,playerId);
        if(existing) return {state,role:existing};
        requireThat(state.status==='waiting',403,'Game already started');
        const joined=result(game.joinGame(state,playerId)); await r.put(joined.state); return joined;
      });
      if(socket.connected){socket.data={gameId,role}; await socket.join(room(gameId)); await publish(gameId);}
      return {role,snapshot:view(state,role)};
    });
    const actions={
      start_game:(state,role)=>{requireThat(online(state.id,'p1')&&online(state.id,'p2'),409,'Both players must be connected');return game.startGame(state,role);},
      choose_answer:(state,role,x)=>{requireThat(['red','yellow','green'].includes(x.answer),400,'Invalid answer'); return game.chooseAnswer(state,role,x.questionIndex,x.answer);},
      submit_comment:(state,role,x)=>{requireThat(typeof x.comment==='string'&&x.comment.length<=2000,400,'Invalid comment');return game.submitComment(state,role,x.questionIndex,x.comment);},
      ready_next:(state,role,x)=>{requireThat(typeof x.ready==='boolean',400,'Invalid ready status');return game.setReady(state,role,x.questionIndex,x.ready);}
    };
    for(const [name,action] of Object.entries(actions)) event(name,async data=>{
      requireThat(socket.connected&&socket.data.gameId===data.gameId&&socket.rooms.has(room(data.gameId)),403,'Join this game first');
      const snapshot=await transaction(async r=>{
        const state=await get(data.gameId,r);const role=member(state,playerId);
        requireThat(role&&role===socket.data.role,403,'Not a player in this game');
        const next=result(action(state,role,data)); await r.put(next); return view(next,role);
      });
      await publish(data.gameId);
      return {snapshot};
    });
    socket.on('disconnect',()=>{
      const {gameId}=socket.data;
      if(gameId) void serialize(gameId,()=>publish(gameId)).catch(error=>console.error(error.message));
    });
  });

  async function ready() {
    await pool.query('SELECT id FROM public.games LIMIT 0');
    await pool.query('SELECT id FROM public.game_answers LIMIT 0');
  }

  return { http, ready, drain: () => Promise.all(queues.values()) };
}

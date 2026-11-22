import { createServer } from 'node:http';
import pg from 'pg';
import { Server } from 'socket.io';
import { handler } from './build/handler.js';
import { createGameFeature } from './src/lib/game/server/feature.mjs';
import { questionsHttp } from './src/lib/questions/server/http.mjs';

const { DATABASE_URL, ORIGIN, QUESTIONS_DIR = '/app/questions', PORT = '3000' } = process.env;
if (!DATABASE_URL || !ORIGIN) throw new Error('DATABASE_URL and ORIGIN are required');
const pool = new pg.Pool({connectionString:DATABASE_URL, connectionTimeoutMillis:3000, statement_timeout:5000});
pool.on('error', error => console.error('PostgreSQL pool:', error.message));

const http=createServer((req,res)=>{
  const path=(req.url ?? '/').split('?')[0];
  if(path!=='/health'&&!path.startsWith('/api/')) return handler(req,res);
  const reply=(status,data)=>{
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(data));
    return true;
  };
  void dispatch(req,path,reply).catch(error=>{
    if(!error.status) console.error(error.message);
    if(!res.headersSent) reply(error.status??500,{error:error.status?error.message:'Server error'});
  });
});
const io=new Server(http,{transports:['websocket'],maxHttpBufferSize:16384,allowRequest:(req,cb)=>cb(null,!req.headers.origin||req.headers.origin===ORIGIN)});
const game = createGameFeature({ pool, io, origin: ORIGIN });

async function dispatch(req, path, reply) {
  if (req.method==='GET' && path==='/health') {
    await pool.query('SELECT 1');
    return reply(200,{ok:true});
  }
  if (await questionsHttp(req,path,{directory:QUESTIONS_DIR,reply})) return;
  return game.http(req,path,reply);
}

await game.ready();
http.listen(Number(PORT),'0.0.0.0');
for(const signal of ['SIGTERM','SIGINT']) process.once(signal,async()=>{
  const timer=setTimeout(()=>process.exit(1),8000);timer.unref();
  await io.close(); await game.drain(); await pool.end(); clearTimeout(timer);
});

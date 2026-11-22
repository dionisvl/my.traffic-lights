import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
const url=process.env.TEST_URL;
assert.ok(url);
const ids=[randomUUID(),randomUUID()];
const call=(path,id,options={})=>fetch(url+path,{...options,headers:{...(id?{authorization:`Bearer ${id}`} : {}),...options.headers}});
assert.match(await (await call('/')).text(),/Create Game/);
const q=await call('/api/questions'); assert.equal(q.status,200); assert.ok((await q.json()).files.length);
const created=await call('/api/game',ids[0],{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({questions:['First','Second']})});
assert.equal(created.status,201); const {gameId}=await created.json();
assert.equal((await call(`/api/game/${gameId}`)).status,401);
const clients=[];
async function connect(id){
 const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false,timeout:2000,auth:{playerId:id}}); clients.push(s);
 await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject)});
 return s;
}
function command(s,event,body={}){return s.timeout(3000).emitWithAck(event,{gameId,...body});}
try {
 const p1=await connect(ids[0]); const p2=await connect(ids[1]);
 assert.equal((await command(p1,'join_game')).role,'p1');
 assert.equal((await command(p2,'join_game')).role,'p2');
 assert.equal((await command(p1,'start_game')).ok,true);
 assert.equal((await command(p1,'choose_answer',{questionIndex:0,answer:'green'})).ok,true);
 assert.equal((await command(p1,'submit_comment',{questionIndex:0,comment:'Test comment'})).ok,true);
 const snapshot=async(id)=>(await call(`/api/game/${gameId}`,id)).json();
 const hidden=(await snapshot(ids[1])).answers[0].player1;
 assert.equal(hidden.answer,undefined); assert.equal(hidden.comment,undefined);
 p2.disconnect(); const p2again=await connect(ids[1]);
 const restored=await command(p2again,'join_game'); assert.equal(restored.role,'p2'); assert.equal(restored.snapshot.game.currentQuestionIndex,0);
 for (const i of [0,1]) {
   if(i===1) assert.equal((await command(p1,'choose_answer',{questionIndex:i,answer:'yellow'})).ok,true);
   assert.equal((await command(p2again,'choose_answer',{questionIndex:i,answer:'red'})).ok,true);
   const results=await Promise.all([command(p1,'ready_next',{questionIndex:i,ready:true}),command(p2again,'ready_next',{questionIndex:i,ready:true})]);
   assert.ok(results.every(x=>x.ok));
 }
 const result=await snapshot(ids[1]); assert.equal(result.game.status,'completed'); assert.equal(result.answers[0].player1.comment,'Test comment');
 console.log('PASS: UI/API, two players, private round, reconnect, concurrent ready, final results');
} finally { for (const s of clients) s.close(); }

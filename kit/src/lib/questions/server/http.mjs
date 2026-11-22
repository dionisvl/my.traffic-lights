import { readdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { Failure, requireThat } from '../../server/failure.mjs';

const questionName = name => /^[^/\\]+\.(txt|md)$/i.test(name) && !name.startsWith('.') && !name.includes('\0');

export async function questionsHttp(req, path, { directory, reply }) {
  if (req.method==='GET' && path==='/api/questions') {
    const entries=await readdir(directory,{withFileTypes:true});
    return reply(200,{files:entries.filter(x=>x.isFile()&&questionName(x.name)).map(x=>({name:x.name}))});
  }
  if(req.method==='GET' && path.startsWith('/api/questions/')) {
    let name; try {name=decodeURIComponent(path.slice('/api/questions/'.length));} catch {throw new Failure(400,'Invalid file name');}
    requireThat(questionName(name),400,'Invalid file name');
    let file; try {file=await open(join(resolve(directory),name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);} catch {throw new Failure(404,'File not found');}
    try {const stat=await file.stat(); requireThat(stat.isFile()&&stat.size<=131072,404,'File not found'); const content=(await file.readFile('utf8')).replace(/\r\n?/g,'\n'); return reply(200,{content});} finally {await file.close();}
  }
  return null;
}

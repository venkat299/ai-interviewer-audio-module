import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fetch from 'node-fetch';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { ASRMessage } from '../../packages/proto/index.js';

const PG_URL = process.env.PG_URL || 'postgres://postgres:postgres@localhost:5432/ai_interviewer';
const JWT_DEV_TOKEN = process.env.JWT_DEV_TOKEN || 'dev-token';
const ASR_URL = process.env.ASR_URL || 'http://asr:8000';
const NLP_URL = process.env.NLP_URL || 'http://nlp:8000';
const BIO_URL = process.env.BIO_URL || 'http://biometrics:8000';

const fastify = Fastify();
fastify.register(websocket);

const pg = new Client({ connectionString: PG_URL });
await pg.connect();
await pg.query(`CREATE TABLE IF NOT EXISTS interview(id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(), status TEXT);
CREATE TABLE IF NOT EXISTS asr_segment(id SERIAL PRIMARY KEY, interview_id TEXT, stage TEXT, text TEXT, start_ms INT, end_ms INT, words JSONB);
CREATE TABLE IF NOT EXISTS nlp_utterance(id SERIAL PRIMARY KEY, interview_id TEXT, text TEXT, entities JSONB, intents JSONB, topics JSONB, start_ms INT, end_ms INT);
CREATE TABLE IF NOT EXISTS biometrics_window(id SERIAL PRIMARY KEY, interview_id TEXT, start_ms INT, end_ms INT, features JSONB);`);

const sessions = new Map();

fastify.post('/api/v1/interviews', async (req, reply) => {
  const id = 'ivw_' + randomUUID();
  await pg.query('INSERT INTO interview(id,status) VALUES($1,$2)', [id, 'active']);
  return { interview_id: id, ws_url: `/ws/interview?id=${id}` };
});

fastify.post('/api/v1/interviews/:id/complete', async (req, reply) => {
  const id = req.params.id;
  const session = sessions.get(id);
  if (session && !session.finalized) {
    const res = await fetch(`${ASR_URL}/stream/${session.streamId}/finalize`, { method: 'POST' });
    const final = await res.json();
    await pg.query('INSERT INTO asr_segment(interview_id,stage,text,start_ms,end_ms,words) VALUES($1,$2,$3,$4,$5,$6)', [id, final.stage, final.text, final.start_ms, final.end_ms, JSON.stringify(final.words)]);
    broadcast(session.ws, final);
    // NLP
    const nlpRes = await fetch(`${NLP_URL}/analyze`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({text: final.text, start_ms: final.start_ms, end_ms: final.end_ms})});
    const nlp = await nlpRes.json();
    broadcast(session.ws, nlp);
    await pg.query('INSERT INTO nlp_utterance(interview_id,text,entities,intents,topics,start_ms,end_ms) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, final.text, JSON.stringify(nlp.entities), JSON.stringify(nlp.intents), JSON.stringify(nlp.topics), final.start_ms, final.end_ms]);
    // Biometrics
    const pcm_b64 = session.lastChunk ? session.lastChunk.toString('base64') : '';
    const bioRes = await fetch(`${BIO_URL}/analyze-window`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({pcm_b64, sample_rate:48000, start_ms:0, end_ms:final.end_ms, words: final.words.map(w=>w.w)})});
    const bio = await bioRes.json();
    broadcast(session.ws, bio);
    await pg.query('INSERT INTO biometrics_window(interview_id,start_ms,end_ms,features) VALUES($1,$2,$3,$4)', [id, bio.window_ms[0], bio.window_ms[1], JSON.stringify({pitch_hz_mean: bio.pitch_hz_mean, speaking_rate_wpm: bio.speaking_rate_wpm})]);
    session.finalized = true;
  }
  await pg.query('UPDATE interview SET status=$1 WHERE id=$2', ['completed', id]);
  return { ok: true };
});

fastify.get('/api/v1/interviews/:id/report', async (req, reply) => {
  const id = req.params.id;
  const asr = await pg.query('SELECT * FROM asr_segment WHERE interview_id=$1', [id]);
  const nlp = await pg.query('SELECT * FROM nlp_utterance WHERE interview_id=$1', [id]);
  const bio = await pg.query('SELECT * FROM biometrics_window WHERE interview_id=$1', [id]);
  return {
    interview_id: id,
    transcript: asr.rows,
    nlp: {
      entities: nlp.rows.flatMap(r=>r.entities),
      intents: nlp.rows.flatMap(r=>r.intents),
      topics: nlp.rows.flatMap(r=>r.topics)
    },
    biometrics: bio.rows.length? bio.rows[bio.rows.length-1].features : {}
  };
});

fastify.register(async function (fastify) {
  fastify.get('/ws/interview', { websocket: true }, (connection, req) => {
    const id = req.query.id;
    let authed = false;
    let buffer = [];
    let bufferMs = 0;
    let streamId = null;
    sessions.set(id, { ws: connection.socket });

    connection.socket.on('message', async (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!authed) {
        if (msg.type === 'auth' && msg.jwt === JWT_DEV_TOKEN) {
          authed = true;
          const res = await fetch(`${ASR_URL}/stream/start`, { method: 'POST' });
          const js = await res.json();
          streamId = js.stream_id;
          const s = sessions.get(id);
          s.streamId = streamId;
        } else {
          connection.socket.close();
        }
        return;
      }
      if (msg.type === 'audio') {
        const buf = Buffer.from(msg.payload_b64, 'base64');
        buffer.push(buf);
        bufferMs += msg.ms;
        if (bufferMs >= 320) {
          const chunk = Buffer.concat(buffer);
          const res = await fetch(`${ASR_URL}/stream/${streamId}/chunk`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({pcm_b64: chunk.toString('base64'), ms: bufferMs})});
          const arr = await res.json();
          arr.forEach(m=>broadcast(connection.socket, m));
          sessions.get(id).lastChunk = chunk;
          buffer = [];
          bufferMs = 0;
        }
      }
    });

    connection.socket.on('close', () => {
      sessions.delete(id);
    });
  });
});

function broadcast(ws, msg){
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

fastify.listen({ port: 8080, host:'0.0.0.0' });

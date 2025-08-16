import base64
import uuid
from typing import Dict, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from packages.proto.models import ASRMessage, ASRWord

app = FastAPI()

class StartResponse(BaseModel):
    stream_id: str

class ChunkRequest(BaseModel):
    pcm_b64: str
    ms: int

streams: Dict[str, Dict] = {}
word_list = ["hello","world","example","interview","openai","agent","testing"]

@app.post("/stream/start", response_model=StartResponse)
def start_stream():
    sid = str(uuid.uuid4())
    streams[sid] = {"ms": 0, "words": [], "word_index": 0}
    return {"stream_id": sid}

@app.post("/stream/{sid}/chunk", response_model=List[ASRMessage])
def chunk_stream(sid: str, req: ChunkRequest):
    if sid not in streams:
        raise HTTPException(404, "stream not found")
    state = streams[sid]
    pcm = base64.b64decode(req.pcm_b64)
    state["ms"] += req.ms
    # generate a fake word every 320ms
    messages = []
    while state["ms"] // 320 > len(state["words"]):
        w = word_list[state["word_index"] % len(word_list)]
        state["word_index"] += 1
        start = (len(state["words"]) * 400)
        end = start + 400
        state["words"].append(ASRWord(w=w, s=start, e=end, conf=0.9))
        msg = ASRMessage(stage="partial", segment_id="seg-1", text=" ".join(word.w for word in state["words"]), start_ms=0, end_ms=end, words=state["words"])
        messages.append(msg)
    return messages

@app.post("/stream/{sid}/finalize", response_model=ASRMessage)
def finalize_stream(sid: str):
    if sid not in streams:
        raise HTTPException(404, "stream not found")
    state = streams.pop(sid)
    end = state["words"][-1].e if state["words"] else 0
    return ASRMessage(stage="final", segment_id="seg-1", text=" ".join(w.w for w in state["words"]), start_ms=0, end_ms=end, words=state["words"])

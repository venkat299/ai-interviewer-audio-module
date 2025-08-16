import base64
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from packages.proto.models import BiometricsMessage

app = FastAPI()

class AnalyzeRequest(BaseModel):
    pcm_b64: str
    sample_rate: int
    start_ms: int
    end_ms: int
    words: list[str] | None = None

@app.post('/analyze-window', response_model=BiometricsMessage)
def analyze(req: AnalyzeRequest):
    pcm = np.frombuffer(base64.b64decode(req.pcm_b64), dtype=np.int16)
    if len(pcm) == 0:
        pitch = 0.0
    else:
        # autocorrelation
        corr = np.correlate(pcm, pcm, mode='full')[len(pcm)-1:]
        min_lag = int(req.sample_rate/400)
        max_lag = int(req.sample_rate/80)
        lag = np.argmax(corr[min_lag:max_lag]) + min_lag
        pitch = req.sample_rate/lag if lag>0 else 0.0
    duration_ms = req.end_ms - req.start_ms
    if req.words and duration_ms>0:
        speaking_rate = len(req.words) / (duration_ms/60000)
    else:
        speaking_rate = 0.0
    return BiometricsMessage(window_ms=[req.start_ms, req.end_ms], pitch_hz_mean=pitch, speaking_rate_wpm=speaking_rate)

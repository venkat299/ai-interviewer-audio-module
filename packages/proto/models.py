from pydantic import BaseModel
from typing import List, Tuple

class ASRWord(BaseModel):
  w: str
  s: int
  e: int
  conf: float

class ASRMessage(BaseModel):
  type: str = 'asr'
  stage: str
  segment_id: str
  text: str
  start_ms: int
  end_ms: int
  words: List[ASRWord]

class NLPEntity(BaseModel):
  type: str
  text: str
  start: int
  end: int

class NLPIntent(BaseModel):
  name: str
  conf: float

class NLPMessage(BaseModel):
  type: str = 'nlp'
  utterance_id: str
  entities: List[NLPEntity]
  intents: List[NLPIntent]
  topics: List[str]

class BiometricsMessage(BaseModel):
  type: str = 'biometrics'
  window_ms: Tuple[int, int]
  pitch_hz_mean: float
  speaking_rate_wpm: float

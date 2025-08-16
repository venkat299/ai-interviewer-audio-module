import re
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from packages.proto.models import NLPMessage, NLPEntity, NLPIntent

app = FastAPI()

class AnalyzeRequest(BaseModel):
    text: str
    start_ms: int
    end_ms: int

keywords = {
    'led': 'leadership',
    'designed': 'experience_example',
    'resolved': 'experience_example'
}

email_re = re.compile(r'[\w.-]+@[\w.-]+')
phone_re = re.compile(r'\b\d{3}[\- ]?\d{3}[\- ]?\d{4}\b')

@app.post('/analyze', response_model=NLPMessage)
def analyze(req: AnalyzeRequest):
    entities: List[NLPEntity] = []
    for m in email_re.finditer(req.text):
        entities.append(NLPEntity(type='EMAIL', text=m.group(), start=m.start(), end=m.end()))
    for m in phone_re.finditer(req.text):
        entities.append(NLPEntity(type='PHONE', text=m.group(), start=m.start(), end=m.end()))
    for m in re.finditer(r'\b[A-Z][a-z]+\b', req.text):
        entities.append(NLPEntity(type='ORG', text=m.group(), start=m.start(), end=m.end()))

    intents: List[NLPIntent] = []
    for word, name in keywords.items():
        if word in req.text.lower():
            intents.append(NLPIntent(name=name, conf=0.8))

    tokens = [t.lower() for t in re.findall(r'[a-zA-Z]+', req.text)]
    uniq = []
    for t in tokens:
        if t not in uniq:
            uniq.append(t)
    topics = uniq[:3]

    return NLPMessage(utterance_id='utt-1', entities=entities, intents=intents, topics=topics)

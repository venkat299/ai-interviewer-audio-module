export interface ASRWord {
  w: string;
  s: number;
  e: number;
  conf: number;
}
export interface ASRMessage {
  type: 'asr';
  stage: 'partial' | 'final';
  segment_id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  words: ASRWord[];
}
export interface NLPMessage {
  type: 'nlp';
  utterance_id: string;
  entities: { type: string; text: string; start: number; end: number }[];
  intents: { name: string; conf: number }[];
  topics: string[];
}
export interface BiometricsMessage {
  type: 'biometrics';
  window_ms: [number, number];
  pitch_hz_mean: number;
  speaking_rate_wpm: number;
}
export type ServerMessage = ASRMessage | NLPMessage | BiometricsMessage;

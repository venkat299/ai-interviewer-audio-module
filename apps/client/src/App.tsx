import React, { useRef, useState } from 'react';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [caption, setCaption] = useState('');
  const [partial, setPartial] = useState('');
  const [pitch, setPitch] = useState<number | null>(null);
  const [wpm, setWpm] = useState<number | null>(null);
  const interviewId = useRef('');
  const wsRef = useRef<WebSocket | null>(null);
  const seq = useRef(0);

  const connect = async () => {
    const res = await fetch('/api/v1/interviews', { method: 'POST' });
    const data = await res.json();
    interviewId.current = data.interview_id;
    const ws = new WebSocket(`ws://${window.location.hostname}:8080${data.ws_url}`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', jwt: 'dev-token' }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'asr') {
        if (msg.stage === 'partial') setPartial(msg.text);
        else {
          setCaption((c) => c + ' ' + msg.text);
          setPartial('');
        }
      } else if (msg.type === 'biometrics') {
        setPitch(msg.pitch_hz_mean);
        setWpm(msg.speaking_rate_wpm);
      }
    };
    wsRef.current = ws;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext({ sampleRate: 48000 });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(960, 1, 1);
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const buf = new ArrayBuffer(input.length * 2);
      const view = new DataView(buf);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      ws.send(
        JSON.stringify({
          type: 'audio',
          seq: seq.current++,
          codec: 'pcm_s16le',
          sample_rate: 48000,
          channels: 1,
          ms: 20,
          payload_b64: b64,
        })
      );
    };
    source.connect(processor);
    processor.connect(context.destination);
    setConnected(true);
  };

  const endInterview = async () => {
    wsRef.current?.close();
    await fetch(`/api/v1/interviews/${interviewId.current}/complete`, { method: 'POST' });
    const res = await fetch(`/api/v1/interviews/${interviewId.current}/report`);
    const report = await res.json();
    alert(JSON.stringify(report, null, 2));
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={connect} disabled={connected}>Connect</button>
      <button onClick={endInterview} disabled={!connected}>End Interview</button>
      <div style={{ marginTop: 20, minHeight: 40 }}>
        <span>{caption} </span>
        <span style={{ color: '#888' }}>{partial}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        {pitch !== null && <span>Pitch: {pitch.toFixed(1)} Hz </span>}
        {wpm !== null && <span>WPM: {wpm.toFixed(1)}</span>}
      </div>
    </div>
  );
}

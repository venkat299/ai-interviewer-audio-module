import fetch from 'node-fetch';
import WebSocket from 'ws';

async function main(){
  const create = await fetch('http://localhost:8080/api/v1/interviews',{method:'POST'});
  const {interview_id, ws_url} = await create.json();
  const ws = new WebSocket(`ws://localhost:8080${ws_url}`);
  let partials=0, finals=0, nlps=0, bios=0;
  ws.on('open', async ()=>{
    ws.send(JSON.stringify({type:'auth', jwt:'dev-token'}));
    const sampleRate=48000;
    const totalMs=10000;
    const totalSamples=sampleRate*totalMs/1000;
    const pcm=new Int16Array(totalSamples);
    for(let i=0;i<totalSamples;i++){
      const t=i/sampleRate;
      pcm[i]=Math.floor(Math.sin(2*Math.PI*1000*t)*32767);
    }
    let seq=0;
    for(let i=0;i<pcm.length;i+=960){
      const frame=pcm.slice(i,i+960);
      const buf=Buffer.from(frame.buffer);
      ws.send(JSON.stringify({type:'audio',seq:seq++,codec:'pcm_s16le',sample_rate:48000,channels:1,ms:20,payload_b64:buf.toString('base64')}));
    }
    setTimeout(async()=>{
      ws.close();
      await fetch(`http://localhost:8080/api/v1/interviews/${interview_id}/complete`,{method:'POST'});
      const rep=await fetch(`http://localhost:8080/api/v1/interviews/${interview_id}/report`);
      console.log(await rep.json());
      process.exit(0);
    },2000);
  });
  ws.on('message', (data)=>{
    const msg=JSON.parse(data.toString());
    if(msg.type==='asr'){
      if(msg.stage==='partial') partials++; else finals++;
    } else if(msg.type==='nlp') nlps++; else if(msg.type==='biometrics') bios++;
  });
  setTimeout(()=>{
    if(partials<3||finals<1||nlps<1||bios<1){
      console.error('missing messages', {partials, finals, nlps, bios});
      process.exit(1);
    }
  },5000);
}
main();

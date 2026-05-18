/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: media.provider.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */


'use strict';
const fetch = (...args)=>import('node-fetch').then(({default: fetch})=>fetch(...args));

// ---------- Replicate ----------
// ENV: REPLICATE_API_TOKEN
async function runReplicate(model, input){
  const key = process.env.REPLICATE_API_TOKEN;
  if(!key) throw new Error('REPLICATE_API_TOKEN not set');
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method:'POST',
    headers:{ 'authorization':`Bearer ${key}`, 'content-type':'application/json' },
    body: JSON.stringify({ version: model, input })
  });
  if(!res.ok){ const t=await res.text().catch(()=>'');
    throw new Error(`Replicate HTTP ${res.status}: ${t.slice(0,300)}`); }
  const j = await res.json();
  return j; // { id,status,output,error,urls: { get } }
}

async function pollReplicate(id){
  const key = process.env.REPLICATE_API_TOKEN;
  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
    headers:{ 'authorization':`Bearer ${key}` }
  });
  if(!res.ok){ const t=await res.text().catch(()=>''); throw new Error(`Replicate poll ${res.status}: ${t.slice(0,300)}`); }
  return await res.json();
}

// ---------- Vertex Veo ----------
// ENV: VERTEX_ACCESS_TOKEN, VERTEX_PROJECT, VERTEX_LOCATION (europe-west4)
// Uses predictLongRunning per docs
async function runVeo({ model='veo-3.0-generate-001', prompt, duration=8, aspectRatio='16:9', resolution='720p', outputGcsUri=null }){
  const token = process.env.VERTEX_ACCESS_TOKEN;
  const project = process.env.VERTEX_PROJECT;
  const location = process.env.VERTEX_LOCATION || 'europe-west4';
  if(!token || !project) throw new Error('VERTEX_ACCESS_TOKEN and VERTEX_PROJECT required');
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:predictLongRunning`;
  const body = {
    instances: [ { prompt } ],
    parameters: {
      duration,
      aspectRatio,
      resolution
    }
  };
  if(outputGcsUri){
    body.parameters.outputStorageUri = outputGcsUri;
  }
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'authorization':`Bearer ${token}`, 'content-type':'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok){ const t=await res.text().catch(()=>'');
    throw new Error(`Veo HTTP ${res.status}: ${t.slice(0,500)}`); }
  const j = await res.json(); // long-running operation { name: operations/... }
  return j;
}

// ---------- Runway ----------
// ENV: RUNWAY_API_KEY
async function runRunway({ prompt, model='gen3-alpha-turbo', duration=8, ratio='16:9', resolution='1080p' }){
  const key = process.env.RUNWAY_API_KEY;
  if(!key) throw new Error('RUNWAY_API_KEY not set');
  const res = await fetch('https://api.runwayml.com/v1/tasks', {
    method:'POST',
    headers:{ 'authorization':`Bearer ${key}`, 'content-type':'application/json' },
    body: JSON.stringify({ model, prompt, duration, ratio, resolution })
  });
  if(!res.ok){ const t=await res.text().catch(()=>'');
    throw new Error(`Runway HTTP ${res.status}: ${t.slice(0,300)}`); }
  return await res.json(); // {id,status,...}
}

async function pollRunway(id){
  const key = process.env.RUNWAY_API_KEY;
  const res = await fetch(`https://api.runwayml.com/v1/tasks/${encodeURIComponent(id)}`, {
    headers:{ 'authorization':`Bearer ${key}` }
  });
  if(!res.ok){ const t=await res.text().catch(()=>'');
    throw new Error(`Runway poll ${res.status}: ${t.slice(0,300)}`); }
  return await res.json();
}

// ---------- Luma (Dream Machine) ----------
// ENV: LUMA_API_KEY
async function runLuma({ prompt, mode='text-to-video', duration=8, ratio='16:9' }){
  const key = process.env.LUMA_API_KEY;
  if(!key) throw new Error('LUMA_API_KEY not set');
  const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/videos', {
    method:'POST',
    headers:{ 'authorization':`Bearer ${key}`, 'content-type':'application/json' },
    body: JSON.stringify({ prompt, duration, aspect_ratio: ratio, mode })
  });
  if(!res.ok){ const t=await res.text().catch(()=>'');
    throw new Error(`Luma HTTP ${res.status}: ${t.slice(0,300)}`); }
  return await res.json(); // { id,status }
}

async function pollLuma(id){
  const key = process.env.LUMA_API_KEY;
  const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/videos/${encodeURIComponent(id)}`, {
    headers:{ 'authorization':`Bearer ${key}` }
  });
  if(!res.ok){ const t=await res.text().catch(()=>'');
    throw new Error(`Luma poll ${res.status}: ${t.slice(0,300)}`); }
  return await res.json();
}


// ---------- OpenAI Sora (official API) ----------
// Uses OpenAI Responses API for video generation.
// ENV: OPENAI_API_KEY
async function runOpenAISora({ prompt, model='sora-2', duration_seconds=null, aspect_ratio=null, seed=null }){
  const key = process.env.OPENAI_API_KEY;
  if(!key) throw new Error('OPENAI_API_KEY not set');
  const body = {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt }
        ]
      }
    ],
    modalities: ["video"],
    video: {}
  };
  if(duration_seconds) body.video.duration_seconds = duration_seconds;
  if(aspect_ratio) body.video.aspect_ratio = aspect_ratio;
  if(seed !== null && seed !== undefined) body.video.seed = seed;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{ 'authorization': `Bearer ${key}`, 'content-type':'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok){
    const t=await res.text().catch(()=>'');
    throw new Error(`OpenAI Sora HTTP ${res.status}: ${t.slice(0,500)}`);
  }
  const j = await res.json();
  return j; // return raw; may include output video url(s) or job id depending on account
}

// ---------- Sora (feature gate / not public API) ----------
async function runSora(){
  const enabled = (process.env.SORA_API_BASE || '') && (process.env.SORA_API_KEY || '');
  if(!enabled){
    return { success:false, message:'Sora API not publicly available; provider disabled per OpenAI. Enable when API is released.' };
  }
  throw new Error('Sora provider pending: enable when OpenAI releases API.');
}

// Public API
async function mediaImageRun(provider, body){
  if(provider === 'replicate'){
    const { model='stability-ai/sdxl', input={} } = body || {};
    const job = await runReplicate(model, input);
    return { success:true, provider, job };
  }
  // could add other image providers here (OpenAI gpt-image-1, Vertex Imagen 3)
  throw new Error(`Image provider not supported: ${provider}`);
}

async function mediaVideoRun(provider, body){
  if(provider === 'replicate'){
    const { model, input } = body || {};
    const job = await runReplicate(model, input);
    return { success:true, provider, job };
  }
  if(provider === 'vertex_veo'){
    const { prompt, duration=8, aspectRatio='16:9', resolution='720p', model='veo-3.0-generate-001', outputGcsUri=null } = body || {};
    const op = await runVeo({ model, prompt, duration, aspectRatio, resolution, outputGcsUri });
    return { success:true, provider, operation: op };
  }
  if(provider === 'runway'){
    const { prompt, duration=8, ratio='16:9', resolution='1080p', model='gen3-alpha-turbo' } = body || {};
    const job = await runRunway({ prompt, duration, ratio, resolution, model });
    return { success:true, provider, job };
  }
  if(provider === 'luma'){
    const { prompt, duration=8, ratio='16:9', mode='text-to-video' } = body || {};
    const job = await runLuma({ prompt, duration, ratio, mode });
    return { success:true, provider, job };
  }
  if(provider === 'sora'){
    return await runSora();
  }
  if(provider === 'openai_sora'){
    const { prompt, model='sora-2', duration_seconds=null, aspect_ratio=null, seed=null } = body || {};
    const r = await runOpenAISora({ prompt, model, duration_seconds, aspect_ratio, seed });
    return { success:true, provider, result: r };
  }
  throw new Error(`Video provider not supported: ${provider}`);
}

async function mediaJobStatus(provider, id){
  if(provider === 'replicate'){
    const r = await pollReplicate(id);
    return { success:true, provider, status: r.status, output: r.output||null, raw: r };
  }
  if(provider === 'runway'){
    const r = await pollRunway(id);
    return { success:true, provider, status: r.status, output: r.output||null, raw: r };
  }
  if(provider === 'luma'){
    const r = await pollLuma(id);
    return { success:true, provider, status: r.status, output: r.output||null, raw: r };
  }
  // Vertex Veo long-running operations can be polled on operations endpoint
  if(provider === 'vertex_veo'){
    const token = process.env.VERTEX_ACCESS_TOKEN;
    const location = process.env.VERTEX_LOCATION || 'europe-west4';
    if(!token) throw new Error('VERTEX_ACCESS_TOKEN required');
    const res = await fetch(`https://${location}-aiplatform.googleapis.com/v1/${encodeURIComponent(id)}`, {
      headers:{ 'authorization':`Bearer ${token}` }
    });
    if(!res.ok){ const t=await res.text().catch(()=>'');
      throw new Error(`Veo operation poll ${res.status}: ${t.slice(0,300)}`); }
    const j = await res.json();
    return { success:true, provider, status: j.done ? 'done' : 'running', output: j.response||null, raw: j };
  }
  throw new Error(`Status not supported for provider: ${provider}`);
}

module.exports = { mediaImageRun, mediaVideoRun, mediaJobStatus };

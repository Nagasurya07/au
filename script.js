// ================= New Enhanced Script =================
let extractedText = "";
let lastFrame = performance.now();
let frameCount = 0;
let fps = 0;
let analyzing = false;
let t0Process = 0;
let highlightIndex = 0;
let utterance = null;
let tokens = [];
let smoothProgress = 0;
let targetProgress = 0;

const el = id => document.getElementById(id);
const outputEl = el('output');
const progressRing = el('progressRing');
const progressPercent = el('progressPercent');
const statusText = el('statusText');
const procTime = el('procTime');
const fpsVal = el('fpsVal');
const dropZone = el('dropZone');
const previewImg = el('preview');
const readBtn = el('readBtn');
const pauseBtn = el('pauseBtn');
const copyBtn = el('copyBtn');
const downloadBtn = el('downloadBtn');
const analyzeBtn = el('analyzeBtn');
const themeToggle = el('themeToggle');
const voiceSelect = el('voiceSelect');
const rateRange = el('rateRange');
const rateVal = el('rateVal');
const highlightToggle = el('highlightToggle');
const mentorToggle = el('mentorToggle');
const reframeBtn = el('reframeBtn');
const boxesToggle = el('boxesToggle');
const minimalToggle = el('minimalToggle');
const wordCountEl = el('wordCount');
const readTimeEl = el('readTime');
const clarityBadge = el('clarityBadge');
const snackbar = el('snackbar');

const stages = [ 'stageLoad','stageDetect','stageRecognize','stageAssemble' ].map(el);

function setStage(idx, done=false){
  stages.forEach((s,i)=>{ s.classList.remove('active','done'); if(i<idx) s.classList.add('done'); });
  if(idx < stages.length) stages[idx].classList.add(done? 'done':'active');
}
function setProgress(p){ targetProgress = Math.min(100,Math.max(0,p)); }
function renderProgress(){
  smoothProgress += (targetProgress - smoothProgress)*0.12;
  const deg = smoothProgress*3.6;
  progressRing.style.background = `conic-gradient(var(--pg-color,#2563eb) ${deg}deg, var(--track-color,rgba(0,0,0,0.07)) 0deg)`;
  progressPercent.textContent = `${Math.round(smoothProgress)}%`;
  progressRing.setAttribute('data-progress', Math.round(smoothProgress));
  requestAnimationFrame(renderProgress);
}
requestAnimationFrame(renderProgress);

function resetUI(){
  setProgress(0); smoothProgress=0;
  setStage(0,false);
  statusText.textContent = 'Idle';
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '🔍 Analyze & Extract';
  outputEl.classList.remove('skeleton');
}

function analyzeImage(image){
  analyzing = true;
  t0Process = performance.now();
  setProgress(0); setStage(0,true); setStage(1,false);
  statusText.textContent = 'Initializing';
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Processing...';
  readBtn.disabled = true; copyBtn.disabled = true; downloadBtn.disabled = true; pauseBtn.disabled = true;
  outputEl.textContent='';
  outputEl.classList.add('skeleton');
  tokens=[]; highlightIndex=0;
  Tesseract.recognize(image,'eng',{ logger: info => {
    if(info.status) statusText.textContent = info.status.replace(/_/g,' ');
    if(typeof info.progress==='number'){
      const prog = info.progress*100;
      setProgress(prog*0.96);
      if(/detect/.test(info.status||'')) setStage(1,false);
      if(/recognize/.test(info.status||'')) { setStage(1,true); setStage(2,false);} 
    }
  }}).then(({ data:{ text, blocks } })=>{
      extractedText = text.trim();
      setStage(2,true); setStage(3,false);
      setProgress(98); statusText.textContent='Assembling';
      tokens = extractedText.split(/(\s+)/).filter(t=>t.length>0);
      outputEl.innerHTML = tokens.map(t=>`<span class="tok">${escapeHtml(t)}</span>`).join('');
      outputEl.classList.remove('skeleton');
      setProgress(100); setStage(3,true); statusText.textContent='Done';
      analyzeBtn.textContent='Done ✔';
      readBtn.disabled = !extractedText; copyBtn.disabled = !extractedText; downloadBtn.disabled = !extractedText; reframeBtn.disabled = !extractedText;
      analyzing = false;
      procTime.textContent = (performance.now()-t0Process).toFixed(0)+'ms';
      updateStats();
      if(boxesToggle.checked) drawBoxes(blocks);
  }).catch(err=>{ console.error(err); alert('OCR error: '+err.message); analyzing=false; resetUI(); });
}

function escapeHtml(t){return t.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}

dropZone.addEventListener('click',()=> el('imageUpload').click());
dropZone.addEventListener('dragover',e=>{e.preventDefault(); dropZone.classList.add('dragover');});
dropZone.addEventListener('dragleave',()=> dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop',e=>{ e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
el('imageUpload').addEventListener('change', e=> handleFiles(e.target.files));
function handleFiles(files){ if(!files||!files[0]) return; const f=files[0]; if(!/image\//.test(f.type)) { alert('Please select an image file'); return;} const url=URL.createObjectURL(f); previewImg.src=url; previewImg.style.display='block'; analyzeImage(f); }

analyzeBtn.addEventListener('click', ()=>{ const f=el('imageUpload').files[0]; if(!f){ alert('Please choose an image'); return;} analyzeImage(f); });

readBtn.addEventListener('click', ()=>{
  if(!extractedText) return; if(window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  highlightIndex=0; updateHighlights();
  utterance = new SpeechSynthesisUtterance(extractedText);
  const selected = speechSynthesis.getVoices().find(v=> v.name===voiceSelect.value); if(selected) utterance.voice=selected;
  utterance.rate=parseFloat(rateRange.value); utterance.pitch=1; utterance.lang=(selected&&selected.lang)||'en-US';
  let boundaryWords=0;
  utterance.onboundary = e=>{ if(!highlightToggle.checked) return; if(e.name==='word'|| e.charIndex!==undefined){ boundaryWords++; if(boundaryWords%1===0){ highlightIndex++; updateHighlights(); }} };
  utterance.onend = ()=>{ pauseBtn.disabled=true; pauseBtn.textContent='⏸ Pause'; readBtn.disabled=false; };
  window.speechSynthesis.speak(utterance);
  readBtn.disabled=true; pauseBtn.disabled=false; pauseBtn.textContent='⏸ Pause';
});

pauseBtn.addEventListener('click', ()=>{ if(!utterance) return; if(window.speechSynthesis.speaking && !window.speechSynthesis.paused){ window.speechSynthesis.pause(); pauseBtn.textContent='▶ Resume'; } else if(window.speechSynthesis.paused){ window.speechSynthesis.resume(); pauseBtn.textContent='⏸ Pause'; } });

function updateHighlights(){ const spans=outputEl.querySelectorAll('.tok'); spans.forEach(s=>s.classList.remove('reading-highlight')); if(highlightToggle.checked && highlightIndex<spans.length) spans[highlightIndex].classList.add('reading-highlight'); if(highlightIndex<spans.length){ const target=spans[highlightIndex]; const top=target.offsetTop; if(top<outputEl.scrollTop|| top> outputEl.scrollTop + outputEl.clientHeight - 80){ outputEl.scrollTo({top: top-40, behavior:'smooth'}); } } }

copyBtn.addEventListener('click', async ()=>{ try { await navigator.clipboard.writeText(extractedText); showSnack('Copied to clipboard'); } catch(e){ alert('Copy failed'); } });
downloadBtn.addEventListener('click', ()=>{ const blob=new Blob([extractedText],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ocr-text.txt'; a.click(); showSnack('Saved text file'); });

reframeBtn.addEventListener('click', ()=>{ if(!extractedText) return; const principles = derivePrinciples(extractedText,{max:10}); const html = `<div class="mentor-block"><h3>Principles</h3>${principles.map(p=>`<div class='mentor-line'>${escapeHtml(p)}</div>`).join('')}</div>`; const ex=outputEl.querySelector('.mentor-block'); if(ex) ex.remove(); outputEl.insertAdjacentHTML('beforebegin', html); if(mentorToggle.checked) speakMentor(principles); });
mentorToggle.addEventListener('change', ()=>{ if(mentorToggle.checked && !reframeBtn.disabled) reframeBtn.click(); });

boxesToggle.addEventListener('change', ()=>{ if(boxesToggle.checked && extractedText){ showSnack('Re-run Analyze to show boxes'); } else clearBoxes(); });
minimalToggle.addEventListener('change', ()=>{ document.body.classList.toggle('minimal', minimalToggle.checked); });

function derivePrinciples(text,{max=8}={}){ const sentences=text.split(/[.!?\n]+/).map(s=>s.trim()).filter(s=>s.length>8); const freq=new Map(); const stop=new Set('the a an and or but that this with from into over to of for in on at by as is are was were be been being you your we our it its their they them he she his her not just can will'.split(/\s+/)); sentences.forEach(s=>{ s.toLowerCase().split(/[^a-z0-9']+/).forEach(w=>{ if(!w||stop.has(w)||w.length<3) return; freq.set(w,(freq.get(w)||0)+1); });}); function scoreSentence(s){ const words=s.toLowerCase().split(/[^a-z0-9']+/).filter(w=>w && !stop.has(w)); if(!words.length) return 0; let sc=0; words.forEach(w=> sc += (freq.get(w)||0)); return sc/Math.sqrt(words.length);} const ranked=sentences.map(s=>({s,score:scoreSentence(s)})).sort((a,b)=>b.score-a.score).slice(0,max*2); const principles=[]; const seen=new Set(); for(const {s} of ranked){ if(principles.length>=max) break; let phrase=s.replace(/^["'“”]+|["'“”]+$/g,'').replace(/^(You|We|I) should\s+/i,'').replace(/^(You|We|I) can\s+/i,'').replace(/^(The key is to|The key is)\s+/i,'').replace(/^(Remember to|Try to|Aim to)\s+/i,'').replace(/^(It is important to)\s+/i,'').trim(); phrase=phrase.replace(/\b(you|your)\b/ig,'').replace(/\s{2,}/g,' ').trim(); if(phrase.length>120) phrase=phrase.slice(0,117).trim()+'…'; phrase=phrase.charAt(0).toUpperCase()+phrase.slice(1); phrase=phrase.replace(/[,;:]$/,''); if(phrase.length<12) continue; if(seen.has(phrase.toLowerCase())) continue; seen.add(phrase.toLowerCase()); principles.push(phrase);} return principles.slice(0,max); }
function speakMentor(lines){ const txt=lines.join('. '); if(window.speechSynthesis.speaking) window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(txt); const sel=speechSynthesis.getVoices().find(v=> v.name===voiceSelect.value); if(sel) u.voice=sel; u.rate=Math.min(1.05, parseFloat(rateRange.value)+0.05); u.pitch=1; window.speechSynthesis.speak(u); }

themeToggle.addEventListener('click',()=>{ document.body.classList.toggle('dark'); localStorage.setItem('theme', document.body.classList.contains('dark')? 'dark':'light'); });
if(localStorage.getItem('theme')==='dark') document.body.classList.add('dark');
if(!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');

function loop(ts){ frameCount++; if(ts-lastFrame>=1000){ fps=frameCount; frameCount=0; lastFrame=ts; fpsVal.textContent=fps; } requestAnimationFrame(loop);} requestAnimationFrame(loop);

// Background
const canvas = document.getElementById('bgfx'); const ctx = canvas.getContext('2d'); let w=canvas.width=window.innerWidth; let h=canvas.height=window.innerHeight; window.addEventListener('resize',()=>{ w=canvas.width=window.innerWidth; h=canvas.height=window.innerHeight; }); const particles=Array.from({length:70},()=>({ a:Math.random()*Math.PI*2, r:40+Math.random()*Math.min(w,h)/2, spd:(0.3+Math.random()*0.6)*(Math.random()<.5?-1:1), sz:1+Math.random()*2.2, hue:210+Math.random()*50, off:Math.random()*2000 })); function bgAnim(t){ ctx.clearRect(0,0,w,h); ctx.save(); ctx.translate(w/2,h/2); particles.forEach(p=>{ const a=p.a+(t/16000)*p.spd; const x=Math.cos(a)*p.r; const y=Math.sin(a)*p.r*0.55; const alpha=0.15+0.5*(Math.sin((t+p.off)/1400)*0.5+0.5); ctx.fillStyle=`hsla(${p.hue},85%,65%,${alpha})`; ctx.beginPath(); ctx.arc(x,y,p.sz+(Math.sin((t+p.off)/900)+1)*0.6,0,Math.PI*2); ctx.fill(); }); ctx.restore(); requestAnimationFrame(bgAnim);} requestAnimationFrame(bgAnim);

document.addEventListener('keydown', e=>{ if(e.key===' ' && !e.target.matches('input,textarea')){ e.preventDefault(); if(readBtn.disabled===false) readBtn.click(); else if(!pauseBtn.disabled) pauseBtn.click(); } if((e.ctrlKey||e.metaKey)&& e.key==='c'){ if(!copyBtn.disabled) copyBtn.click(); } if(e.key==='Escape'){ window.speechSynthesis.cancel(); pauseBtn.disabled=true; readBtn.disabled=!extractedText; }});

function populateVoices(){ const voices=speechSynthesis.getVoices().filter(v=> /en|US|UK|India|English/i.test(v.lang)).sort((a,b)=> a.lang.localeCompare(b.lang)|| a.name.localeCompare(b.name)); const prev=voiceSelect.value; voiceSelect.innerHTML=voices.map(v=>`<option value="${v.name}">${v.name.replace(/Google |Microsoft |English /g,'')} (${v.lang})</option>`).join(''); if(voices.length){ const prefer=voices.find(v=>/Natural|Neural|Premium|Jenny|Aria|Emma|Sarah/i.test(v.name))||voices[0]; voiceSelect.value= (prev && voices.some(v=>v.name===prev))? prev: prefer.name; }} speechSynthesis.onvoiceschanged=populateVoices; populateVoices();

rateRange.addEventListener('input', ()=>{ rateVal.textContent=parseFloat(rateRange.value).toFixed(2)+'×'; });
highlightToggle.addEventListener('change', ()=>{ if(!highlightToggle.checked){ outputEl.querySelectorAll('.reading-highlight').forEach(n=>n.classList.remove('reading-highlight')); }});

// Helpers
function updateStats(){ const words=extractedText.split(/\s+/).filter(Boolean); wordCountEl.textContent=`${words.length} words`; const wpm=180; const secs=Math.ceil(words.length/wpm*60); readTimeEl.textContent= secs<60? secs+'s' : (Math.round(secs/60*10)/10)+'m'; const clarity=estimateClarity(extractedText); clarityBadge.textContent=`Clarity: ${clarity.label}`; clarityBadge.className='clarity '+clarity.className; }
function estimateClarity(text){ if(!text) return {label:'–',score:0,className:'clarity-na'}; const words=text.toLowerCase().match(/[a-z0-9']+/g)||[]; const avg=words.reduce((a,w)=>a+w.length,0)/(words.length||1); const lex=new Set(words).size/(words.length||1); const score=(avg/8)*0.4 + lex*0.6; if(score>0.62) return {label:'High',score,className:'clarity-good'}; if(score>0.45) return {label:'Medium',score,className:'clarity-mid'}; return {label:'Low',score,className:'clarity-poor'}; }
function showSnack(msg){ snackbar.textContent=msg; snackbar.classList.add('show'); setTimeout(()=> snackbar.classList.remove('show'),2500); }
function clearBoxes(){ const layer=document.querySelector('.boxes-layer'); if(layer) layer.remove(); }
function drawBoxes(blocks){ clearBoxes(); if(!blocks||!blocks.length) return; const parent=outputEl.parentElement; parent.style.position='relative'; const layer=document.createElement('div'); layer.className='boxes-layer'; parent.appendChild(layer); const maxW=Math.max(...blocks.map(b=> b.bbox?.x1||0)); const baseW=outputEl.clientWidth; blocks.slice(0,120).forEach(b=>{ if(!b.bbox) return; const bb=b.bbox; const div=document.createElement('div'); div.className='box-rect'; const wRatio=baseW/(maxW||1); const left=bb.x0*wRatio; const width=(bb.x1-bb.x0)*wRatio; const top=(bb.y0/(bb.y1+20))* (outputEl.clientHeight*0.85); const height=Math.max(12,(bb.y1-bb.y0)*0.25); Object.assign(div.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'}); layer.appendChild(div); }); }

window.addEventListener('beforeunload',()=>{ if(window.speechSynthesis.speaking) window.speechSynthesis.cancel(); });
resetUI();


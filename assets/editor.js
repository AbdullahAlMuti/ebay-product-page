window.EditorApp = (function(){
  const state = {
    frame: null,
    doc: null,
    templatesKey: 'visual-editor-templates',
    currentName: null,
    accent: '#16a34a',
    baselineHtml: null,
    historyKey: 'visual-editor-history',
    lastTemplateKey: 'visual-editor-last',
  };

  function loadTemplates(){
    try{
      return JSON.parse(localStorage.getItem(state.templatesKey) || '{}');
    }catch{ return {}; }
  }
  function saveTemplates(templates){
    try{ localStorage.setItem(state.templatesKey, JSON.stringify(templates)); }catch(e){ /* storage may be unavailable */ }
  }

  function minimalStub(title){
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+ (title||'Template') +'</title></head><body style="font-family: Arial, sans-serif; padding: 16px;">'+ (title||'Template') +' content</body></html>';
  }

  // Load list of admin templates from manifest with graceful fallback
  async function loadAdminTemplatesList(){
    try{
      const res = await fetch('admin_templates/manifest.json', { cache:'no-store' });
      if(!res.ok) throw new Error('no manifest');
      const data = await res.json();
      const items = Array.isArray(data.templates) ? data.templates : [];
      return items.filter(it => it && it.name && it.file).map(it => ({ name: it.name, file: it.file }));
    }catch{
      const candidates = ['admin_templates/template.html','admin_templates/template2.html'];
      const found = [];
      await Promise.all(candidates.map(async p => {
        try{ const r = await fetch(p); if(r.ok){ found.push({ name: 'Admin: ' + (p.split('/').pop()||'').replace(/\.html?$/,''), file: p }); } }catch{}
      }));
      return found;
    }
  }

  // No longer auto-seeding default templates; we rely on admin templates or user-saved items
  function seedDefaultTemplatesIfMissing(){ return Promise.resolve(); }

  async function populateTemplateList(){
    const select = document.getElementById('template-list');
    let templates = loadTemplates();
    let names = Object.keys(templates);
    select.innerHTML = '';
    // Build Admin Templates group first
    let admin = [];
    try{ admin = await loadAdminTemplatesList(); }catch{}
    if(admin && admin.length){
      const group = document.createElement('optgroup');
      group.label = 'Admin Templates';
      admin.forEach(item => {
        const opt = document.createElement('option');
        opt.value = 'file:' + item.file;
        opt.textContent = item.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
    // Build Saved Templates group
    if(names.length){
      const savedGroup = document.createElement('optgroup');
      savedGroup.label = 'Saved Templates';
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        savedGroup.appendChild(opt);
      });
      select.appendChild(savedGroup);
    }
    // Choose selection: last -> first admin -> first saved -> create minimal stub in-place
    let last = null; try{ last = localStorage.getItem(state.lastTemplateKey); }catch{}
    const values = Array.from(select.options).map(o=>o.value);
    let chosen = (last && values.includes(last)) ? last : null;
    if(!chosen && admin && admin.length){ chosen = 'file:' + admin[0].file; }
    if(!chosen && names.length){ chosen = names[0]; }
    if(!chosen){
      // Fallback: create an in-memory temporary template
      const name = 'Untitled';
      const html = minimalStub(name);
      const temp = document.createElement('option'); temp.value = name; temp.textContent = name;
      select.appendChild(temp); chosen = name; templates[name] = html; saveTemplates(templates);
    }
    select.value = chosen;
    // load chosen
    if(chosen && chosen.startsWith('file:')){
      const file = chosen.replace('file:','');
      state.currentName = chosen;
      fetch(file).then(r=>r.text()).then(html=>{ state.baselineHtml = html; loadHtmlIntoFrame(html); });
    } else {
      const html = templates[chosen];
      state.currentName = chosen; state.baselineHtml = html; loadHtmlIntoFrame(html);
    }
  }

  function setStatus(text){
    document.getElementById('status').textContent = text;
  }

  function ensureEditable(){
    try{
      state.doc.designMode = 'on';
    }catch(e){ /* noop */ }
  }

  function loadHtmlIntoFrame(html){
    state.currentHtml = html;
    state.frame.srcdoc = html;
    setTimeout(() => {
      state.doc = state.frame.contentDocument || state.frame.contentWindow.document;
      ensureEditable();
      setStatus(state.currentName ? `Editing: ${state.currentName}` : 'Editing: Untitled');
      // click to select images for replacement
      state.doc.addEventListener('click', ev => {
        if(ev.target && ev.target.tagName === 'IMG'){
          state.doc.querySelectorAll('img').forEach(img=>img.style.outline='');
          ev.target.style.outline = '2px solid #16a34a';
          state.doc.__selectedImage = ev.target;
        }
      });
      // apply current accent to the template
      applyAccentToFrame(state.accent);
    }, 50);
  }

  function getEditedHtml(){
    const doc = state.frame.contentDocument;
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  function copy(text){
    navigator.clipboard.writeText(text);
  }

  function showSuccessOverlay(){
    const overlay = document.getElementById('success-overlay');
    if(!overlay) return;

    // Show overlay
    overlay.classList.add('show');

    // Auto hide after 2 seconds
    setTimeout(() => {
      overlay.classList.remove('show');
    }, 2000);

    // Hide on click outside
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) {
        overlay.classList.remove('show');
      }
    });
  }

  function openGeminiInBlankPage(){
    // Create a simple, working Gemini interface
    const geminiHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini AI Assistant</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .gemini-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 1px solid rgba(66, 133, 244, 0.1);
        }
        .gemini-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        .gemini-title {
            font-size: 32px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 16px;
        }
        .gemini-description {
            font-size: 18px;
            color: #666;
            margin-bottom: 32px;
            line-height: 1.6;
        }
        .open-btn {
            background: linear-gradient(135deg, #4285f4, #34a853);
            color: white;
            border: none;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 24px rgba(66, 133, 244, 0.3);
            margin-bottom: 20px;
            display: inline-block;
            text-decoration: none;
        }
        .open-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(66, 133, 244, 0.4);
        }
        .info-text {
            font-size: 16px;
            color: #888;
            margin-bottom: 24px;
        }
        .security-notice {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        .security-notice strong {
            color: #1a1a1a;
        }
        .progress-container {
            margin: 24px 0;
            text-align: center;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 12px;
            position: relative;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #4285f4, #34a853);
            border-radius: 4px;
            width: 0%;
            transition: width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            position: relative;
            overflow: hidden;
        }
        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            animation: shimmer 2s infinite;
        }
        .progress-text {
            font-size: 14px;
            color: #666;
            font-weight: 500;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            opacity: 0.9;
        }
        .progress-text.connected {
            color: #34a853;
            font-weight: 600;
            opacity: 1;
            transform: scale(1.05);
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
        }
        .success-message {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4285f4, #34a853);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(66, 133, 244, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            display: none;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="gemini-container">
        <div class="gemini-icon">🤖</div>
        <h1 class="gemini-title">Gemini AI Assistant</h1>
        <p class="gemini-description">
            Your AI-powered assistant is ready to help with your eBay product listings, 
            content optimization, and creative tasks.
        </p>
        
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressText">Connecting to Gemini AI...</div>
        </div>
        
        <button class="open-btn" onclick="openGemini()">
            🚀 Open Gemini AI Now
        </button>
        <p class="info-text">
            Gemini will automatically open when connection is complete
        </p>
        <div class="security-notice">
            <strong>Why a new tab?</strong><br>
            Google's security policies prevent embedding Gemini in iframes. 
            Opening in a new tab ensures full functionality and security.
        </div>
    </div>
    
    <div class="success-message" id="successMessage">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px;">✅</div>
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">Gemini AI Opened!</div>
                <div style="font-size: 14px; opacity: 0.9;">Check your new window</div>
            </div>
        </div>
    </div>

    <script>
        function openGemini() {
            const geminiUrl = 'https://gemini.google.com/gem/1abcyIu6_hz3GZFz2V93mMrjH1guaj09W?usp=sharing';
            const newTab = window.open(geminiUrl, '_blank');
            
            if (newTab) {
                // Focus the new tab
                newTab.focus();
                
                // Show success message
                showSuccessMessage();
            } else {
                alert('Please allow popups for this site to open Gemini AI');
            }
        }
        
        // Animate progress bar on page load
        function animateProgress() {
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            
            // Fast and smooth animation sequence
            setTimeout(() => {
                progressFill.style.width = '20%';
                progressText.textContent = 'Initializing...';
            }, 100);
            
            setTimeout(() => {
                progressFill.style.width = '40%';
                progressText.textContent = 'Connecting...';
            }, 400);
            
            setTimeout(() => {
                progressFill.style.width = '65%';
                progressText.textContent = 'Authenticating...';
            }, 700);
            
            setTimeout(() => {
                progressFill.style.width = '85%';
                progressText.textContent = 'Loading AI...';
            }, 1000);
            
            setTimeout(() => {
                progressFill.style.width = '95%';
                progressText.textContent = 'Finalizing...';
            }, 1300);
            
            setTimeout(() => {
                progressFill.style.width = '100%';
                progressText.textContent = 'Gemini is connected ✅';
                progressText.classList.add('connected');
                
                // Add a subtle pulse effect when complete
                progressFill.style.animation = 'pulse 0.6s ease-in-out';
                
                // Automatically open Gemini in new tab after completion
                setTimeout(() => {
                    const geminiUrl = 'https://gemini.google.com/gem/1abcyIu6_hz3GZFz2V93mMrjH1guaj09W?usp=sharing';
                    const newTab = window.open(geminiUrl, '_blank');
                    
                    if (newTab) {
                        newTab.focus();
                        showSuccessMessage();
                    } else {
                        alert('Please allow popups for this site to open Gemini AI');
                    }
                }, 800); // Wait 800ms after progress completion
            }, 1600);
        }
        
        // Start progress animation when page loads
        window.addEventListener('load', animateProgress);
        
        function showSuccessMessage() {
            const successMsg = document.getElementById('successMessage');
            successMsg.style.display = 'block';
            
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 4000);
        }
    </script>
</body>
</html>`;

    // Load the simple Gemini interface
    loadHtmlIntoFrame(geminiHtml);
    setStatus('Gemini AI Assistant ready');
  }

  function openDownloadImageInBlankPage(){
    // Create a simple, working download image interface
    const downloadHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download Image Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .download-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 1px solid rgba(255, 107, 107, 0.1);
        }
        .download-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        .download-title {
            font-size: 32px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 16px;
        }
        .download-description {
            font-size: 18px;
            color: #666;
            margin-bottom: 32px;
            line-height: 1.6;
        }
        .open-btn {
            background: linear-gradient(135deg, #ff6b6b, #ffa726);
            color: white;
            border: none;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 24px rgba(255, 107, 107, 0.3);
            margin-bottom: 20px;
            display: inline-block;
            text-decoration: none;
        }
        .open-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(255, 107, 107, 0.4);
        }
        .info-text {
            font-size: 16px;
            color: #888;
            margin-bottom: 24px;
        }
        .tool-notice {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        .tool-notice strong {
            color: #1a1a1a;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .success-message {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b, #ffa726);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(255, 107, 107, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            display: none;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="download-container">
        <div class="download-icon">📥</div>
        <h1 class="download-title">Download Image Tool</h1>
        <p class="download-description">
            Professional image download and editing tool for your eBay product listings. 
            Optimize, resize, and enhance your product images.
        </p>
        <button class="open-btn" onclick="openDownloadTool()">
            🚀 Open Download Tool
        </button>
        <p class="info-text">
            The download tool will open within this application
        </p>
        <div class="tool-notice">
            <strong>Professional Image Tool</strong><br>
            Access advanced image editing, downloading, and optimization features 
            specifically designed for eBay product listings. The tool will load directly here.
        </div>
    </div>
    
    <div class="success-message" id="successMessage">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 20px;">✅</div>
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">Download Tool Opened!</div>
                <div style="font-size: 14px; opacity: 0.9;">Check your new tab</div>
            </div>
        </div>
    </div>

    <script>
        function openDownloadTool() {
            const downloadUrl = 'https://almutillc-amzedit.netlify.app/';
            
            // Create an iframe to load the download tool within the application
            const iframe = document.createElement('iframe');
            iframe.src = downloadUrl;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.background = 'white';
            iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals allow-downloads';
            iframe.allow = 'camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen';
            
            // Replace the current content with the iframe
            const container = document.querySelector('.download-container').parentNode;
            container.innerHTML = '';
            container.appendChild(iframe);
            
            // Show success message
            showSuccessMessage();
        }
        
        function showSuccessMessage() {
            const successMsg = document.getElementById('successMessage');
            successMsg.style.display = 'block';
            
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 4000);
        }
    </script>
</body>
</html>`;

    // Load the simple download interface
    loadHtmlIntoFrame(downloadHtml);
    setStatus('Download Image Tool ready');
  }

  function download(filename, text){
    const blob = new Blob([text], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 0);
  }

  function wireToolbar(){
    // Handle toolbar buttons with data-cmd attribute
    document.querySelectorAll('[data-cmd]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(state.frame && state.frame.contentDocument){
          state.frame.contentDocument.execCommand(btn.dataset.cmd, false, null);
          state.frame.contentWindow.focus();
        }
      });
    });
    
    // Handle color inputs
    const colorText = document.getElementById('color-text');
    const colorBg = document.getElementById('color-bg');
    
    if(colorText){
      colorText.addEventListener('input', e=>{
        if(state.frame && state.frame.contentDocument){
          state.frame.contentDocument.execCommand('foreColor', false, e.target.value);
        }
      });
    }
    
    if(colorBg){
      colorBg.addEventListener('input', e=>{
        if(state.frame && state.frame.contentDocument){
          state.frame.contentDocument.execCommand('hiliteColor', false, e.target.value);
        }
      });
    }
    
    // Handle heading buttons
    const btnH1 = document.getElementById('btn-h1');
    const btnH2 = document.getElementById('btn-h2');
    const btnP = document.getElementById('btn-p');
    
    if(btnH1){
      btnH1.addEventListener('click', ()=> {
        if(state.frame && state.frame.contentDocument){
          state.frame.contentDocument.execCommand('formatBlock', false, 'H1');
        }
      });
    }
    
    if(btnH2){
      btnH2.addEventListener('click', ()=> {
        if(state.frame && state.frame.contentDocument){
          state.frame.contentDocument.execCommand('formatBlock', false, 'H2');
        }
      });
    }
    
    if(btnP){
      btnP.addEventListener('click', ()=> {
        if(state.frame && state.frame.contentDocument){
          state.frame.contentDocument.execCommand('formatBlock', false, 'P');
        }
      });
    }
  }

  function wireImages(){
    const picker = document.getElementById('img-file');
    document.getElementById('btn-replace-img').addEventListener('click', ()=> picker.click());
    picker.addEventListener('change', async () => {
      const file = picker.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = state.doc.__selectedImage;
        if(img){ img.src = reader.result; }
        picker.value = '';
      };
      reader.readAsDataURL(file);
    });
    // URL based replacement
    document.getElementById('btn-set-img-url').addEventListener('click', ()=>{
      const url = document.getElementById('img-url').value.trim();
      if(!url) return;
      const img = state.doc && state.doc.__selectedImage;
      if(img){
        applyImageOptions(img, { src:url, mode: document.getElementById('img-size-mode').value });
      }
    });

    // Advanced controls
    document.getElementById('btn-apply-img').addEventListener('click', ()=>{
      const img = state.doc && state.doc.__selectedImage; if(!img) return;
      applyImageOptions(img, collectImageOptions());
    });
    document.getElementById('btn-reset-img').addEventListener('click', ()=>{
      const img = state.doc && state.doc.__selectedImage; if(!img) return;
      img.removeAttribute('style');
    });
    document.getElementById('btn-apply-all-img').addEventListener('click', ()=>{
      const img = state.doc && state.doc.__selectedImage; if(!img) return;
      const opts = collectImageOptions();
      const all = Array.from(state.doc.querySelectorAll('img'));
      all.forEach(el=> applyImageOptions(el, opts));
    });

    // Delete selected image
    const delBtn = document.getElementById('btn-delete-img');
    if(delBtn){ delBtn.addEventListener('click', ()=>{
      const img = state.doc && state.doc.__selectedImage; if(!img){ alert('Select an image in the preview first.'); return; }
      const parent = img.parentElement;
      img.remove();
      if(parent && parent.childNodes.length === 0){ parent.remove(); }
      state.doc.__selectedImage = null;
    }); }

    // Keep ratio if requested when width/height edited
    const lock = document.getElementById('img-lock');
    const w = document.getElementById('img-w');
    const h = document.getElementById('img-h');
    function bindAspect(){
      const img = state.doc && state.doc.__selectedImage; if(!img) return;
      const natural = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : null;
      w.addEventListener('input', ()=>{
        if(lock.checked && natural && w.value){ h.value = Math.round(parseInt(w.value,10) / natural); }
      });
      h.addEventListener('input', ()=>{
        if(lock.checked && natural && h.value){ w.value = Math.round(parseInt(h.value,10) * natural); }
      });
    }
    state.frame.addEventListener('load', ()=> setTimeout(bindAspect, 50));
  }

  function collectImageOptions(){
    return {
      src: document.getElementById('img-url').value.trim() || null,
      alt: document.getElementById('img-alt').value.trim() || null,
      mode: document.getElementById('img-size-mode').value,
      w: document.getElementById('img-w').value,
      h: document.getElementById('img-h').value,
      fit: document.getElementById('img-fit').value,
      pos: document.getElementById('img-pos').value,
    };
  }

  function applyImageOptions(img, opts){
    const rect = img.getBoundingClientRect();
    const currentWidth = rect.width;
    const currentHeight = rect.height;
    if(opts.src){ img.src = opts.src; }
    if(opts.alt !== null){ img.alt = opts.alt; }
    img.style.objectFit = opts.fit || 'cover';
    img.style.objectPosition = opts.pos || 'center center';
    switch(opts.mode){
      case 'width':
        img.style.width = (opts.w || currentWidth || 0) + 'px';
        img.style.height = 'auto';
        break;
      case 'height':
        img.style.height = (opts.h || currentHeight || 0) + 'px';
        img.style.width = 'auto';
        break;
      case 'natural':
        img.style.width = '';
        img.style.height = '';
        break;
      case 'preserve':
      default:
        img.style.width = currentWidth ? currentWidth + 'px' : '';
        img.style.height = currentHeight ? currentHeight + 'px' : 'auto';
        break;
    }
  }

  // Accent color propagation into iframe document
  function applyAccentToFrame(hex){
    const doc = state.frame && state.frame.contentDocument; if(!doc) return;
    const css = `:root{--green-600:${hex};--green-700:${hex};--green-500:${hex}} .feature-icon,.benefit-icon{color:${hex}!important} .table-comparison th{background:${hex}!important}`;
    let styleTag = doc.getElementById('__accent_style__');
    if(!styleTag){ styleTag = doc.createElement('style'); styleTag.id='__accent_style__'; doc.head.appendChild(styleTag); }
    styleTag.textContent = css;
  }

  function wireCode(){
    const modal = document.getElementById('code-modal');
    const area = document.getElementById('code-area');
    document.getElementById('btn-code').addEventListener('click', ()=>{
      area.value = getEditedHtml();
      modal.showModal();
      area.select();
    });
    document.getElementById('btn-close-code').addEventListener('click', ()=> modal.close());
    document.getElementById('btn-copy-code').addEventListener('click', ()=> copy(area.value));
    const applyBtn = document.getElementById('btn-apply-code');
    if(applyBtn){ applyBtn.addEventListener('click', ()=> loadHtmlIntoFrame(area.value)); }
    const codeLive = document.getElementById('code-live');
    if(codeLive){
      area.addEventListener('input', ()=>{ if(codeLive.checked){ loadHtmlIntoFrame(area.value); } });
    }
  }

  function wireHeader(){
    document.getElementById('btn-copy').addEventListener('click', ()=> {
      copy(getEditedHtml());
      showSuccessOverlay();
    });
    document.getElementById('btn-download').addEventListener('click', ()=> download((state.currentName||'edited')+'.html', getEditedHtml()));
    document.getElementById('btn-save').addEventListener('click', ()=>{
      const name = prompt('Save as name:', state.currentName || 'template');
      if(!name) return;
      const templates = loadTemplates();
      templates[name] = getEditedHtml();
      saveTemplates(templates); state.currentName = name; try{ localStorage.setItem(state.lastTemplateKey, name); }catch{} populateTemplateList(); setStatus(`Saved: ${name}`);
    });
    
    // Quick access buttons
    document.getElementById('btn-import-clipboard').addEventListener('click', async ()=>{
      try{
        const text = await navigator.clipboard.readText();
        if(text){
          const name = 'Clipboard '+new Date().toLocaleString();
          state.currentName = name; state.baselineHtml = text; loadHtmlIntoFrame(text);
          const store = loadTemplates(); store[name] = text; saveTemplates(store);
          try{ localStorage.setItem(state.lastTemplateKey, state.currentName); }catch{}
          populateTemplateList();
        }
      }catch(err){ alert('Clipboard permission is required. Paste into code modal instead.'); }
    });
    
    document.getElementById('btn-sanitize').addEventListener('click', ()=>{
      const doc = state.frame.contentDocument;
      // lightweight sanitize
      doc.querySelectorAll('script, iframe, form, object, embed').forEach(n=>n.remove());
      Array.from(doc.querySelectorAll('*')).forEach(el=>{ for(const a of Array.from(el.attributes)) if(/^on/i.test(a.name)) el.removeAttribute(a.name); });
      doc.querySelectorAll('style').forEach(s=>{ s.textContent=(s.textContent||'').replace(/@keyframes[\s\S]*?\{[\s\S]*?\}/g,''); });
      alert('Document sanitized for eBay safety.');
    });
    
    document.getElementById('btn-change-url').addEventListener('click', ()=>{
      const url = prompt('Enter new product URL:', '');
      if(url && url.trim()){
        // This would typically update a product URL field or variable
        // For now, we'll just show a confirmation
        alert(`Product URL updated to: ${url}`);
      }
    });
    
    document.getElementById('btn-gemini').addEventListener('click', ()=>{
      openGeminiInBlankPage();
    });
    
    document.getElementById('btn-download-image').addEventListener('click', ()=>{
      openDownloadImageInBlankPage();
    });
    const exportBtn = document.getElementById('btn-export-safe');
    if(exportBtn){ exportBtn.addEventListener('click', ()=>{
      const doc = state.frame.contentDocument;
      // lightweight sanitize
      doc.querySelectorAll('script, iframe, form, object, embed').forEach(n=>n.remove());
      Array.from(doc.querySelectorAll('*')).forEach(el=>{ for(const a of Array.from(el.attributes)) if(/^on/i.test(a.name)) el.removeAttribute(a.name); });
      doc.querySelectorAll('style').forEach(s=>{ s.textContent=(s.textContent||'').replace(/@keyframes[\s\S]*?\{[\s\S]*?\}/g,''); });
      download((state.currentName||'edited')+'-ebay-safe.html', getEditedHtml());
    }); }

    const resetAll = document.getElementById('btn-reset-all');
    if(resetAll){ resetAll.addEventListener('click', ()=>{
      // theme
      const color = document.getElementById('accent-color'); if(color){ color.value = '#16a34a'; }
      state.accent = '#16a34a';
      document.documentElement.style.setProperty('--accent', '#16a34a');
      document.documentElement.classList.remove('dark');
      applyAccentToFrame(state.accent);
      // restore original HTML of current template if available
      const base = state.baselineHtml || state.currentHtml || '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
      loadHtmlIntoFrame(base);
      // zoom
      const range = document.getElementById('zoom-range'); if(range){ range.value = 100; }
      const resetZoom = document.getElementById('btn-reset-zoom'); if(resetZoom){ resetZoom.click(); }
      // sidebar width
      const sidebar = document.querySelector('.sidebar'); if(sidebar){ sidebar.style.width = ''; }
      // code modal
      const area = document.getElementById('code-area');
      const live = document.getElementById('code-live');
      if(live){ live.checked = false; }
      if(area){ area.value = base; }
      // panels scroll
      window.scrollTo({top:0, behavior:'smooth'});
      setStatus('Reset to base version');
    }); }
  }

  function wireSidebar(){
    const list = document.getElementById('template-list');
    list.addEventListener('change', ()=>{
      const templates = loadTemplates();
      if(list.value === '__default'){
        state.currentName = 'template';
        fetch('template.html').then(r=>r.text()).then(html=>{ state.baselineHtml = html; loadHtmlIntoFrame(html); });
      } else if(list.value.startsWith('file:')){
        const file = list.value.replace('file:','');
        state.currentName = list.value;
        fetch(file).then(r=>r.text()).then(html=>{ state.baselineHtml = html; loadHtmlIntoFrame(html); });
      } else {
        const html = templates[list.value];
        state.currentName = list.value;
        if(html){ state.baselineHtml = html; loadHtmlIntoFrame(html); }
      }
      try{ localStorage.setItem(state.lastTemplateKey, list.value); }catch{}
    });
    document.getElementById('btn-new').addEventListener('click', ()=>{
      const name = prompt('New template name:', 'New Template');
      const templateName = (name && name.trim()) || 'New Template';
      const blank='<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+templateName+'</title></head><body style="font-family: Arial, sans-serif; padding: 16px;">Start editing...</body></html>';
      const store = loadTemplates();
      store[templateName] = blank; saveTemplates(store);
      state.currentName = templateName; state.baselineHtml = blank;
      loadHtmlIntoFrame(blank);
      try{ localStorage.setItem(state.lastTemplateKey, templateName); }catch{}
      populateTemplateList();
      setStatus('Created: '+templateName);
    });
    document.getElementById('btn-delete').addEventListener('click', ()=>{
      const value = list.value; if(!value) return;
      // prevent deletion of default or admin file-backed templates
      if(value === '__default' || value.startsWith('file:')){
        alert('Default and admin templates cannot be deleted here.');
        return;
      }
      const templates = loadTemplates();
      if(!(value in templates)){
        alert('Only custom saved templates can be deleted.');
        return;
      }
      delete templates[value];
      saveTemplates(templates);
      populateTemplateList();
      setStatus('Deleted');
    });
    document.getElementById('btn-upload').addEventListener('click', ()=> document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', ()=>{
      const file = document.getElementById('file-input').files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        state.currentName = file.name.replace(/\.html?$/,'');
        state.baselineHtml = reader.result; loadHtmlIntoFrame(reader.result);
        // auto-save uploaded template to dropdown
        const store = loadTemplates();
        store[state.currentName] = reader.result; saveTemplates(store);
        try{ localStorage.setItem(state.lastTemplateKey, state.currentName); }catch{}
        populateTemplateList();
      };
      reader.readAsText(file);
    });
    document.getElementById('btn-import-clipboard').addEventListener('click', async ()=>{
      try{
        const text = await navigator.clipboard.readText();
        if(text){
          const name = 'Clipboard '+new Date().toLocaleString();
          state.currentName = name; state.baselineHtml = text; loadHtmlIntoFrame(text);
          const store = loadTemplates(); store[name] = text; saveTemplates(store);
          try{ localStorage.setItem(state.lastTemplateKey, state.currentName); }catch{}
          populateTemplateList();
        }
      }catch(err){ alert('Clipboard permission is required. Paste into code modal instead.'); }
    });
  }

  function wireZoom(){
    const range = document.getElementById('zoom-range');
    const reset = document.getElementById('btn-reset-zoom');
    function apply(){
      const scale = parseInt(range.value,10)/100;
      state.frame.style.transform = `scale(${scale})`;
      state.frame.style.transformOrigin = '0 0';
      state.frame.style.width = `${100/scale}%`;
      state.frame.style.height = `${100/scale}%`;
    }
    range.addEventListener('input', apply);
    reset.addEventListener('click', ()=>{ range.value = 100; apply(); });
    apply();
  }

  // Theme accent and dark mode
  (function theme(){
    const color = document.getElementById('accent-color');
    const darkBtn = document.getElementById('btn-dark');
    if(color){ color.addEventListener('input', ()=>{
      document.documentElement.style.setProperty('--accent', color.value);
      state.accent = color.value;
      applyAccentToFrame(state.accent);
    }); }
    if(darkBtn){ darkBtn.addEventListener('click', ()=>{
      document.documentElement.classList.toggle('dark');
    }); }
  })();

  // Sidebar splitter
  (function splitter(){
    const sp = document.getElementById('splitter');
    if(!sp) return;
    let dragging=false, startX=0, startWidth=0;
    sp.addEventListener('mousedown', (e)=>{ dragging=true; startX=e.clientX; startWidth=document.querySelector('.sidebar').offsetWidth; document.body.style.userSelect='none'; });
    window.addEventListener('mousemove', (e)=>{ if(!dragging) return; const dx=e.clientX-startX; const w=Math.max(240,Math.min(520,startWidth+dx)); document.querySelector('.sidebar').style.width=w+'px'; });
    window.addEventListener('mouseup', ()=>{ dragging=false; document.body.style.userSelect=''; });
  })();

  function loadInitialTemplate(){
    // Seed predefined templates once, then build list and load selection
    seedDefaultTemplatesIfMissing().finally(()=>{
      populateTemplateList();
    });
  }

  function init(){
    state.frame = document.getElementById('frame');
    wireToolbar();
    wireImages();
    wireCode();
    wireHeader();
    wireSidebar();
    wireZoom();
    wireAI();
    wireAIWriterPro();
    wireSanitize();
    wireHistory();
    wireAnalyzer();
    wireKeyboardShortcuts();
    loadInitialTemplate();
  }

  function wireKeyboardShortcuts(){
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S: Save
      if((e.ctrlKey || e.metaKey) && e.key === 's'){
        e.preventDefault();
        document.getElementById('btn-save').click();
      }
      
      // Ctrl/Cmd + C: Copy HTML
      if((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('input, textarea')){
        e.preventDefault();
        document.getElementById('btn-copy').click();
      }
      
      // Ctrl/Cmd + D: Download
      if((e.ctrlKey || e.metaKey) && e.key === 'd'){
        e.preventDefault();
        document.getElementById('btn-download').click();
      }
      
      // Ctrl/Cmd + Z: Undo (in editor)
      if((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey){
        if(state.frame && state.frame.contentDocument){
          e.preventDefault();
          state.frame.contentDocument.execCommand('undo');
        }
      }
      
      // Ctrl/Cmd + Y: Redo (in editor)
      if((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))){
        if(state.frame && state.frame.contentDocument){
          e.preventDefault();
          state.frame.contentDocument.execCommand('redo');
        }
      }
      
      // Escape: Close modals
      if(e.key === 'Escape'){
        const modal = document.getElementById('code-modal');
        if(modal && modal.open){
          modal.close();
        }
        const overlay = document.getElementById('success-overlay');
        if(overlay && overlay.classList.contains('show')){
          overlay.classList.remove('show');
        }
      }
    });
  }

  return { init };
})();

// --- AI (Gemini) ---
function wireAI(){
  const keyInput = document.getElementById('ai-key');
  const remember = document.getElementById('ai-remember');
  const modelSel = document.getElementById('ai-model');
  const promptArea = document.getElementById('ai-prompt');
  const outputArea = document.getElementById('ai-output');
  if(!keyInput) return; // AI section not present

  // Load stored key if opted
  const stored = localStorage.getItem('gemini_key');
  if(stored){ keyInput.value = stored; remember.checked = true; }

  async function callGemini(prompt){
    const key = keyInput.value.trim();
    if(!key){ alert('Please enter your Gemini API key.'); return ''; }
    const model = modelSel.value || 'gemini-1.5-flash';
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }]}]
    };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}` , {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const t = await res.text();
      throw new Error('Gemini error: ' + t);
    }
    const data = await res.json();
    const candidates = (data.candidates && data.candidates[0]) || {};
    const parts = (candidates.content && candidates.content.parts) || [];
    return parts.map(p=>p.text||'').join('\n');
  }

// ---- History ----
function historyLoad(){
  try{ return JSON.parse(localStorage.getItem(EditorApp && EditorApp.state ? EditorApp.state.historyKey : 'visual-editor-history') || '[]'); }catch{return []}
}
function historySave(list){ localStorage.setItem('visual-editor-history', JSON.stringify(list.slice(-30))); }
function wireHistory(){
  const listEl = document.getElementById('history-list');
  const btnSnap = document.getElementById('btn-history-snapshot');
  const btnRestore = document.getElementById('btn-history-restore');
  const btnDelete = document.getElementById('btn-history-delete');
  const auto = document.getElementById('history-auto');
  if(!listEl) return;

  function refresh(){
    const items = historyLoad();
    listEl.innerHTML='';
    items.forEach((it,idx)=>{
      const opt=document.createElement('option'); opt.value=String(idx); opt.textContent=`${new Date(it.t).toLocaleString()} - ${it.name}`; listEl.appendChild(opt);
    });
    if(items.length){ listEl.value=String(items.length-1); }
  }
  refresh();

  btnSnap.addEventListener('click', ()=>{
    const items = historyLoad();
    items.push({ t: Date.now(), name: (document.getElementById('template-list').value || 'Untitled'), html: document.getElementById('frame').contentDocument.documentElement.outerHTML });
    historySave(items); refresh();
  });
  btnRestore.addEventListener('click', ()=>{
    const items = historyLoad(); const idx=parseInt(listEl.value||'-1',10); if(idx<0||idx>=items.length) return;
    const html = '<!DOCTYPE html>\n'+items[idx].html; loadHtmlIntoFrame(html);
  });
  btnDelete.addEventListener('click', ()=>{
    const items = historyLoad(); const idx=parseInt(listEl.value||'-1',10); if(idx<0||idx>=items.length) return;
    items.splice(idx,1); historySave(items); refresh();
  });
  if(auto){ auto.addEventListener('change', ()=>{ localStorage.setItem('visual-editor-history-auto', auto.checked ? '1':'0'); }); auto.checked = localStorage.getItem('visual-editor-history-auto')==='1'; }
  // simple autosave on blur
  if(auto && auto.checked){ setInterval(()=>{
    const items = historyLoad(); items.push({ t: Date.now(), name: (document.getElementById('template-list').value || 'Untitled'), html: document.getElementById('frame').contentDocument.documentElement.outerHTML }); historySave(items);
  }, 60000); }
}

  function getSelectionHtml(){
    const doc = window.EditorApp && document.getElementById('frame').contentDocument;
    const sel = doc.getSelection();
    if(!sel || sel.rangeCount === 0) return '';
    const div = doc.createElement('div');
    for(let i=0;i<sel.rangeCount;i++){
      div.appendChild(sel.getRangeAt(i).cloneContents());
    }
    return div.innerText || div.textContent || '';
  }

  document.getElementById('btn-ai-run').addEventListener('click', async ()=>{
    try{
      if(remember.checked){ localStorage.setItem('gemini_key', keyInput.value.trim()); } else { localStorage.removeItem('gemini_key'); }
      const base = promptArea.value.trim();
      const selText = getSelectionHtml();
      const prompt = selText ? `${base}\n\nSelection:\n${selText}` : base;
      outputArea.value = 'Thinking...';
      outputArea.value = await callGemini(prompt);
    }catch(err){ outputArea.value = String(err); }
  });

  document.getElementById('btn-ai-copy').addEventListener('click', ()=> navigator.clipboard.writeText(outputArea.value||''));
  document.getElementById('btn-ai-insert').addEventListener('click', ()=>{
    const doc = document.getElementById('frame').contentDocument;
    doc.execCommand('insertText', false, outputArea.value||'');
  });
  document.getElementById('btn-ai-rewrite').addEventListener('click', ()=>{
    const doc = document.getElementById('frame').contentDocument;
    const sel = doc.getSelection();
    if(!sel || sel.rangeCount===0) return;
    sel.deleteFromDocument();
    doc.execCommand('insertText', false, outputArea.value||'');
  });
  document.getElementById('btn-ai-bullets').addEventListener('click', async ()=>{
    try{
      const selText = getSelectionHtml();
      const prompt = `Turn the following into 4-6 concise eBay-friendly bullet points with emojis where helpful, keep to plain text lines starting with - :\n\n${selText || 'Smart cupping massager benefits and features.'}`;
      outputArea.value = 'Thinking...';
      outputArea.value = await callGemini(prompt);
    }catch(err){ outputArea.value = String(err); }
  });
  document.getElementById('btn-ai-alt').addEventListener('click', async ()=>{
    const doc = document.getElementById('frame').contentDocument;
    const img = doc.__selectedImage;
    if(!img){ alert('Select an image in the preview first.'); return; }
    try{
      const ctx = `Generate a concise, descriptive ALT text (max 12 words) for an e-commerce image based on context. If unclear, infer a helpful description via filename or surrounding text. Filename: ${img.src.split('/').pop()}`;
      document.getElementById('ai-output').value = 'Thinking...';
      const text = await callGemini(ctx);
      document.getElementById('ai-output').value = text.trim();
      img.alt = text.trim();
    }catch(err){ document.getElementById('ai-output').value = String(err); }
  });
}

// --- AI Writer Pro ---
function wireAIWriterPro(){
  const btnGen = document.getElementById('btn-ai-generate');
  const btnApply = document.getElementById('btn-ai-apply');
  const toneSel = document.getElementById('ai-tone');
  const goalSel = document.getElementById('ai-goal');
  const srcArea = document.getElementById('ai-source');
  const outArea = document.getElementById('ai-result');
  if(!btnGen) return;

  async function run(){
    const key = (document.getElementById('ai-key')||{}).value||'';
    if(!key){ alert('Enter Gemini key in AI Assistant section.'); return; }
    const model = (document.getElementById('ai-model')||{value:'gemini-1.5-flash'}).value;
    const tone = toneSel.value;
    const goal = goalSel.value;
    const doc = document.getElementById('frame').contentDocument;
    const sel = doc.getSelection();
    const selectionText = sel && sel.rangeCount ? (function(){ const d=doc.createElement('div'); for(let i=0;i<sel.rangeCount;i++){ d.appendChild(sel.getRangeAt(i).cloneContents()); } return d.innerText; })() : '';
    const base = srcArea.value.trim() || selectionText || doc.body.innerText.slice(0,2000);
    const instructions = {
      bullets: `Create 5-7 short, skimmable bullet points for an eBay listing. Limit to 12 words each, start with an emoji where helpful, keep clear benefits. Tone: ${tone}. Content:\n${base}`,
      desc: `Write a concise, high-converting eBay product description (120-180 words). Use short paragraphs and a bullet list. Avoid claims that trigger policies. Tone: ${tone}. Content:\n${base}`,
      title: `Generate 3 optimized eBay titles (max 80 chars). Include top keywords, no symbols except hyphens. Tone: ${tone}. Content:\n${base}`,
      faq: `Generate 3-5 FAQs with brief answers (one sentence each). Tone: ${tone}. Content:\n${base}`,
      meta: `Generate meta title (≤60 chars) and description (≤155 chars) for SEO. Tone: ${tone}. Content:\n${base}`
    }[goal];

    outArea.value = 'Thinking...';
    try{
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contents:[{role:'user', parts:[{text: instructions}]}] })
      });
      const data = await res.json();
      const candidates = (data.candidates && data.candidates[0]) || {}; const parts = (candidates.content && candidates.content.parts)||[];
      outArea.value = parts.map(p=>p.text||'').join('\n').trim();
    }catch(err){ outArea.value = String(err); }
  }

  btnGen.addEventListener('click', run);
  btnApply.addEventListener('click', ()=>{
    const doc = document.getElementById('frame').contentDocument;
    const sel = doc.getSelection();
    if(sel && sel.rangeCount){ sel.deleteFromDocument(); }
    doc.execCommand('insertText', false, outArea.value||'');
  });
}

// --- Sanitize (eBay safe) ---
function wireSanitize(){
  const btn = document.getElementById('btn-sanitize');
  const btnStrip = document.getElementById('btn-remove-inline-scripts');
  if(!btn) return;
  function sanitize(doc){
    // remove scripts, iframes, forms, style keyframes and inline event handlers
    doc.querySelectorAll('script, iframe, form, object, embed').forEach(n=>n.remove());
    Array.from(doc.querySelectorAll('*')).forEach(el=>{
      // remove on* handlers
      for(const a of Array.from(el.attributes)){
        if(/^on/i.test(a.name)) el.removeAttribute(a.name);
        if(['autoplay','srcdoc'].includes(a.name)) el.removeAttribute(a.name);
      }
    });
    // strip @keyframes from styles
    doc.querySelectorAll('style').forEach(styleEl=>{
      const css = styleEl.textContent||'';
      const safe = css.replace(/@keyframes[\s\S]*?\{[\s\S]*?\}/g,'');
      styleEl.textContent = safe;
    });
    ensureResponsiveBase(doc);
  }
  btn.addEventListener('click', ()=>{
    const doc = document.getElementById('frame').contentDocument; sanitize(doc);
    alert('Sanitized. Active content removed.');
  });
  btnStrip.addEventListener('click', ()=>{
    const doc = document.getElementById('frame').contentDocument;
    Array.from(doc.querySelectorAll('*')).forEach(el=>{
      for(const a of Array.from(el.attributes)) if(/^on/i.test(a.name)) el.removeAttribute(a.name);
    });
    ensureResponsiveBase(doc);
    alert('Removed inline event handlers.');
  });
}

// inject responsive base CSS if missing
function ensureResponsiveBase(doc){
  let s = doc.getElementById('__responsive_base__');
  if(!s){ s = doc.createElement('style'); s.id='__responsive_base__'; doc.head.appendChild(s); }
  s.textContent = 'html{font-size:clamp(15px,1.1vw,16px)}img{max-width:100%;height:auto;display:block}*{box-sizing:border-box}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';
}

// --- Analyzer (SEO & Performance) ---
function wireAnalyzer(){
  const btn = document.getElementById('btn-analyze');
  if(!btn) return;
  const list = document.getElementById('analysis-list');
  const seoBar = document.getElementById('seo-bar');
  const perfBar = document.getElementById('perf-bar');
  const seoScoreEl = document.getElementById('seo-score');
  const perfScoreEl = document.getElementById('perf-score');

  function scoreSeo(doc){
    let score = 100; const tips=[];
    // title length
    const title=(doc.querySelector('title')||{}).textContent||''; if(!title){ score-=20; tips.push('Add a <title> tag.'); } else if(title.length>60){ score-=5; tips.push('Shorten the title (≤60 chars).'); }
    // meta description
    const meta=doc.querySelector('meta[name="description"]'); if(!meta||!(meta.getAttribute('content')||'').trim()){ score-=15; tips.push('Add a meta description (≤155 chars).'); }
    // h1 presence
    if(!doc.querySelector('h1,h2')){ score-=10; tips.push('Add an H1/H2 heading.'); }
    // image alts
    const imgs=[...doc.images]; const missingAlt = imgs.filter(i=>!(i.getAttribute('alt')||'').trim()).length; if(missingAlt>0){ score-=Math.min(15, missingAlt*2); tips.push(`${missingAlt} image(s) missing alt text.`); }
    // links text
    doc.querySelectorAll('a').forEach(a=>{ if(!a.textContent.trim()){ score-=2; tips.push('Some links lack anchor text.'); } });
    // bullets/paragraphs
    if(doc.body.innerText.trim().length<150){ score-=10; tips.push('Add more descriptive text.'); }
    return { score: Math.max(0,score), tips };
  }

  function scorePerf(doc){
    let score=100; const tips=[];
    const imgs=[...doc.images];
    const big=imgs.filter(i=> (i.naturalWidth||0)>1600 || (i.naturalHeight||0)>1600 ); if(big.length){ score-=15; tips.push('Resize large images (>1600px).'); }
    const many=imgs.length; if(many>12){ score-=10; tips.push('Too many images; consider fewer or optimize.'); }
    doc.querySelectorAll('style').forEach(s=>{ if((s.textContent||'').length>20000){ score-=10; tips.push('Stylesheet is very large.'); } });
    // long text without headings
    const headings=doc.querySelectorAll('h1,h2,h3').length; if(headings<1){ score-=5; tips.push('Add headings for readability.'); }
    return { score: Math.max(0,score), tips };
  }

  btn.addEventListener('click', ()=>{
    const doc = document.getElementById('frame').contentDocument;
    const seo = scoreSeo(doc); const perf = scorePerf(doc);
    seoBar.style.width = seo.score+'%'; perfBar.style.width = perf.score+'%';
    seoScoreEl.textContent = String(seo.score); perfScoreEl.textContent = String(perf.score);
    list.innerHTML='';
    [...new Set([...seo.tips, ...perf.tips])].forEach(t=>{ const li=document.createElement('li'); li.textContent=t; list.appendChild(li); });
  });
}




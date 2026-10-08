(function() {
  const sections = { explorer: document.getElementById('section-explorer'), palettes: document.getElementById('section-palettes'), contrast: document.getElementById('section-contrast'), library: document.getElementById('section-library'), prompt: document.getElementById('section-prompt') };
  function switchSection(name) {
    Object.keys(sections).forEach(k => sections[k].classList.toggle('active', k === name));
    if (name === 'prompt' && typeof renderPromptPalette === 'function') renderPromptPalette();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === name));
    document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  }
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); switchSection(el.dataset.section); });
  });

  function hslToHex(h, s, l) {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = n => { const k = (n + h / 30) % 12; const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * color).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  }
  function hslToRgb(h, s, l) {
    l /= 100; const a = s * Math.min(l, 1 - l) / 100;
    const f = n => { const k = (n + h / 30) % 12; const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * color); };
    return [f(0), f(8), f(4)];
  }
  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    let max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h=0, s=0, l=(max+min)/2;
    if (max !== min) { let d = max-min; s = l > 0.5 ? d/(2-max-min) : d/(max+min); switch(max) { case r: h = ((g-b)/d + (g<b ? 6 : 0))/6; break; case g: h = ((b-r)/d + 2)/6; break; case b: h = ((r-g)/d + 4)/6; break; } }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }
  function hexToRgb(hex) {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  }
  function getColorFromSpherePos(x, y, z) {
    const lightness = ((y + 1) / 2) * 100;
    const angle = Math.atan2(z, x);
    const hue = ((angle * 180 / Math.PI) + 360) % 360;
    const distFromAxis = Math.sqrt(x*x + z*z);
    const saturation = distFromAxis * 100;
    return { h: hue, s: saturation, l: lightness, hex: hslToHex(hue, saturation, lightness), rgb: hslToRgb(hue, saturation, lightness), hslStr: Math.round(hue) + '°, ' + Math.round(saturation) + '%, ' + Math.round(lightness) + '%' };
  }
  function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  function getContrastRatio(hex1, hex2) {
    const lum1 = getLuminance(...hexToRgb(hex1));
    const lum2 = getLuminance(...hexToRgb(hex2));
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // ===================== EXPLORER (3D) =====================
  const canvas = document.getElementById('three-canvas');
  const canvasArea = document.getElementById('canvas-area');
  const tooltip = document.getElementById('tooltip');
  const selectedSwatch = document.getElementById('selected-swatch');
  const panelHex = document.getElementById('panel-hex');
  const panelRgb = document.getElementById('panel-rgb');
  const panelHsl = document.getElementById('panel-hsl');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1326);
  const camera = new THREE.PerspectiveCamera(45, canvasArea.clientWidth / canvasArea.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(canvasArea.clientWidth, canvasArea.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(5, 5, 5); dirLight.castShadow = true; scene.add(dirLight);
  const backLight = new THREE.DirectionalLight(0xadc6ff, 0.3); backLight.position.set(-5, -3, -5); scene.add(backLight);

  const sphereGroup = new THREE.Group(); scene.add(sphereGroup);
  const count = 1200, radius = 1.8, hexSize = 0.12;
  const hexGeo = new THREE.CylinderGeometry(hexSize, hexSize, 0.04, 6);
  hexGeo.rotateX(Math.PI / 2);
  const hexMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, flatShading: false });
  const instancedMesh = new THREE.InstancedMesh(hexGeo, hexMat, count);
  instancedMesh.castShadow = true; instancedMesh.receiveShadow = true; sphereGroup.add(instancedMesh);

  const dummy = new THREE.Object3D();
  const colorData = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    const posX = x * radius, posY = y * radius, posZ = z * radius;
    dummy.position.set(posX, posY, posZ); dummy.lookAt(0, 0, 0); dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
    const colorInfo = getColorFromSpherePos(x, y, z);
    instancedMesh.setColorAt(i, new THREE.Color(colorInfo.hex));
    colorData.push({ index: i, hex: colorInfo.hex, rgb: colorInfo.rgb, hsl: colorInfo.hslStr, position: new THREE.Vector3(posX, posY, posZ), normal: new THREE.Vector3(x, y, z).normalize() });
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.instanceColor.needsUpdate = true;

  const wireGeo = new THREE.IcosahedronGeometry(radius * 1.01, 2);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1a2340, wireframe: true, transparent: true, opacity: 0.15 });
  sphereGroup.add(new THREE.Mesh(wireGeo, wireMat));

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredIndex = -1, selectedIndex = -1;
  let isDragging = false, previousMousePosition = { x: 0, y: 0 };
  let targetRotation = { x: 0, y: 0 }, currentRotation = { x: 0, y: 0 };
  let autoRotate = true, autoRotateSpeed = 0.002;

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (hoveredIndex >= 0) { tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY - 30) + 'px'; }
    if (isDragging) { targetRotation.y += (e.clientX - previousMousePosition.x) * 0.005; targetRotation.x += (e.clientY - previousMousePosition.y) * 0.005; targetRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, targetRotation.x)); previousMousePosition = { x: e.clientX, y: e.clientY }; autoRotate = false; }
  }
  function onMouseDown(e) { isDragging = true; previousMousePosition = { x: e.clientX, y: e.clientY }; canvas.style.cursor = 'grabbing'; }
  function onMouseUp() { isDragging = false; canvas.style.cursor = 'grab'; setTimeout(() => { if (!isDragging) autoRotate = true; }, 3000); }
  function onClick(e) { if (hoveredIndex >= 0) { selectedIndex = hoveredIndex; updatePanel(colorData[hoveredIndex]); } }
  function onWheel(e) { e.preventDefault(); camera.position.z += e.deltaY * 0.001; camera.position.z = Math.max(2.5, Math.min(8, camera.position.z)); autoRotate = false; setTimeout(() => { if (!isDragging) autoRotate = true; }, 3000); }

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', () => { isDragging = false; canvas.style.cursor = 'grab'; tooltip.classList.remove('visible'); hoveredIndex = -1; });
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { isDragging = true; previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (e.touches.length === 1 && isDragging) { targetRotation.y += (e.touches[0].clientX - previousMousePosition.x) * 0.008; targetRotation.x += (e.touches[0].clientY - previousMousePosition.y) * 0.008; previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }; autoRotate = false; } }, { passive: false });
  canvas.addEventListener('touchend', () => { isDragging = false; setTimeout(() => { if (!isDragging) autoRotate = true; }, 3000); });

  function updatePanel(data) {
    selectedSwatch.style.backgroundColor = data.hex;
    panelHex.textContent = data.hex.toUpperCase();
    panelRgb.textContent = data.rgb.join(', ');
    panelHsl.textContent = data.hsl;
  }
  document.getElementById('copy-hex').addEventListener('click', () => {
    navigator.clipboard.writeText(panelHex.textContent).then(() => { const btn = document.getElementById('copy-hex'); const original = btn.innerHTML; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">check</span>'; setTimeout(() => btn.innerHTML = original, 1500); });
  });

  const tempColor = new THREE.Color();
  function animate() {
    requestAnimationFrame(animate);
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.1;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.1;
    sphereGroup.rotation.x = currentRotation.x;
    sphereGroup.rotation.y = currentRotation.y;
    if (autoRotate && !isDragging) targetRotation.y += autoRotateSpeed;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(instancedMesh);
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== hoveredIndex) {
        if (hoveredIndex >= 0 && hoveredIndex !== selectedIndex) instancedMesh.setColorAt(hoveredIndex, new THREE.Color(colorData[hoveredIndex].hex));
        hoveredIndex = instanceId;
        tooltip.textContent = colorData[instanceId].hex.toUpperCase();
        tooltip.classList.add('visible');
        instancedMesh.getColorAt(instanceId, tempColor);
        tempColor.offsetHSL(0, 0, 0.15);
        instancedMesh.setColorAt(instanceId, tempColor);
        instancedMesh.instanceColor.needsUpdate = true;
      }
    } else {
      if (hoveredIndex >= 0) {
        if (hoveredIndex !== selectedIndex) { instancedMesh.setColorAt(hoveredIndex, new THREE.Color(colorData[hoveredIndex].hex)); instancedMesh.instanceColor.needsUpdate = true; }
        hoveredIndex = -1; tooltip.classList.remove('visible');
      }
    }
    if (selectedIndex >= 0) { const pulse = (Math.sin(Date.now() * 0.003) + 1) / 2; const original = new THREE.Color(colorData[selectedIndex].hex); const bright = original.clone().offsetHSL(0, 0, 0.2 * pulse); instancedMesh.setColorAt(selectedIndex, bright); instancedMesh.instanceColor.needsUpdate = true; }
    renderer.render(scene, camera);
  }
  animate();
  window.addEventListener('resize', () => { const w = canvasArea.clientWidth, h = canvasArea.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); });

  const sidebar = document.getElementById('sidebar');
  const closeBtn = document.getElementById('close-sidebar');
  if (window.innerWidth <= 768) { closeBtn.style.display = 'flex'; closeBtn.addEventListener('click', () => sidebar.classList.remove('open')); }

  // ===================== PALETTES =====================
  let paletteColors = [];
  const hueSlider = document.getElementById('hue-slider');
  const satSlider = document.getElementById('sat-slider');
  const lightSlider = document.getElementById('light-slider');
  const hueVal = document.getElementById('hue-val');
  const satVal = document.getElementById('sat-val');
  const lightVal = document.getElementById('light-val');
  const pickerSwatch = document.getElementById('picker-swatch');
  const hexInput = document.getElementById('hex-input');
  const addBtn = document.getElementById('add-to-palette-btn');
  const paletteSlots = document.getElementById('palette-slots');
  const paletteCount = document.getElementById('palette-count');
  const palettePreviewStrip = document.getElementById('palette-preview-strip');
  const jsonPreview = document.getElementById('json-preview');
  const jsonCopyBtn = document.getElementById('json-copy-btn');
  const jsonClearBtn = document.getElementById('json-clear-btn');
  const sidebarCount = document.getElementById('sidebar-count');
  const sidebarLightest = document.getElementById('sidebar-lightest');
  const sidebarDarkest = document.getElementById('sidebar-darkest');
  const sidebarSaturated = document.getElementById('sidebar-saturated');

  function updatePicker() {
    const h = parseInt(hueSlider.value), s = parseInt(satSlider.value), l = parseInt(lightSlider.value);
    const hex = hslToHex(h, s, l);
    pickerSwatch.style.backgroundColor = hex;
    hexInput.value = hex.toUpperCase();
    hueVal.textContent = h + '°'; satVal.textContent = s + '%'; lightVal.textContent = l + '%';
  }
  function updateFromHex() {
    let hex = hexInput.value.trim(); if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) { const hsl = hexToHsl(hex); hueSlider.value = hsl.h; satSlider.value = hsl.s; lightSlider.value = hsl.l; updatePicker(); }
  }
  hueSlider.addEventListener('input', updatePicker); satSlider.addEventListener('input', updatePicker); lightSlider.addEventListener('input', updatePicker);
  hexInput.addEventListener('change', updateFromHex); hexInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') updateFromHex(); });

  const quickGrid = document.getElementById('quick-colors-grid');
  const quickHues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const quickSats = [100, 80, 60, 40]; const quickLights = [85, 65, 45, 25];
  quickHues.forEach(h => { quickSats.forEach((s, si) => { quickLights.forEach((l, li) => { const hex = hslToHex(h, s, l); const div = document.createElement('div'); div.className = 'quick-color'; div.style.backgroundColor = hex; div.dataset.hex = hex; div.addEventListener('click', () => { hueSlider.value = h; satSlider.value = s; lightSlider.value = l; updatePicker(); document.querySelectorAll('.quick-color').forEach(c => c.classList.remove('active')); div.classList.add('active'); }); quickGrid.appendChild(div); }); }); });

  function renderPalette() {
    paletteSlots.innerHTML = ''; palettePreviewStrip.innerHTML = '';
    if (paletteColors.length === 0) { paletteSlots.innerHTML = '<div class="palette-empty">No colors yet. Pick a color and click "Add to Palette".</div>'; palettePreviewStrip.style.display = 'none'; paletteCount.textContent = '0 colors'; }
    else {
      paletteCount.textContent = paletteColors.length + ' color' + (paletteColors.length > 1 ? 's' : '');
      palettePreviewStrip.style.display = 'flex';
      paletteColors.forEach((color, idx) => {
        const slot = document.createElement('div'); slot.className = 'palette-slot'; slot.style.backgroundColor = color.hex;
        slot.innerHTML = '<span class="slot-hex">' + color.hex.toUpperCase() + '</span><span class="slot-remove">&times;</span>';
        slot.querySelector('.slot-remove').addEventListener('click', (e) => { e.stopPropagation(); paletteColors.splice(idx, 1); renderPalette(); updateJson(); updateSidebarStats(); });
        slot.addEventListener('click', () => { hueSlider.value = color.h; satSlider.value = color.s; lightSlider.value = color.l; updatePicker(); });
        paletteSlots.appendChild(slot);
        const stripColor = document.createElement('div'); stripColor.className = 'palette-preview-color'; stripColor.style.backgroundColor = color.hex; stripColor.dataset.hex = color.hex.toUpperCase(); palettePreviewStrip.appendChild(stripColor);
      });
    }
  }
  function updateJson() {
    const json = { name: 'my-palette', colors: paletteColors.map(c => ({ hex: c.hex.toUpperCase(), rgb: c.rgb, hsl: { h: c.h, s: c.s, l: c.l } })), count: paletteColors.length, generated: new Date().toISOString() };
    const jsonStr = JSON.stringify(json, null, 2);
    const highlighted = jsonStr.replace(/"(name|colors|count|generated|hex|rgb|hsl|h|s|l)":/g, '<span class="key">"$1"</span>:').replace(/: "([^"]*)"/g, ': <span class="string">"$1"</span>').replace(/: (\d+)/g, ': <span class="number">$1</span>').replace(/: (true|false|null)/g, ': <span class="boolean">$1</span>');
    jsonPreview.innerHTML = highlighted;
  }
  function updateSidebarStats() {
    sidebarCount.textContent = paletteColors.length;
    if (paletteColors.length === 0) { sidebarLightest.textContent = '—'; sidebarDarkest.textContent = '—'; sidebarSaturated.textContent = '—'; return; }
    let lightest = paletteColors[0], darkest = paletteColors[0], mostSat = paletteColors[0];
    paletteColors.forEach(c => { if (c.l > lightest.l) lightest = c; if (c.l < darkest.l) darkest = c; if (c.s > mostSat.s) mostSat = c; });
    sidebarLightest.textContent = lightest.hex.toUpperCase(); sidebarDarkest.textContent = darkest.hex.toUpperCase(); sidebarSaturated.textContent = mostSat.hex.toUpperCase();
  }
  addBtn.addEventListener('click', () => { const h = parseInt(hueSlider.value), s = parseInt(satSlider.value), l = parseInt(lightSlider.value); const hex = hslToHex(h, s, l); const rgb = hslToRgb(h, s, l); paletteColors.push({ h, s, l, hex, rgb }); renderPalette(); updateJson(); updateSidebarStats(); });
  jsonCopyBtn.addEventListener('click', () => { const json = { name: 'my-palette', colors: paletteColors.map(c => ({ hex: c.hex.toUpperCase(), rgb: c.rgb, hsl: { h: c.h, s: c.s, l: c.l } })), count: paletteColors.length, generated: new Date().toISOString() }; navigator.clipboard.writeText(JSON.stringify(json, null, 2)).then(() => { const original = jsonCopyBtn.innerHTML; jsonCopyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> Copied!'; setTimeout(() => jsonCopyBtn.innerHTML = original, 2000); }); });
  jsonClearBtn.addEventListener('click', () => { paletteColors = []; renderPalette(); updateJson(); updateSidebarStats(); });
  document.getElementById('explorer-save-palette').addEventListener('click', () => { const hex = panelHex.textContent; if (hex && hex !== '—') { const hsl = hexToHsl(hex); const rgb = hslToRgb(hsl.h, hsl.s, hsl.l); paletteColors.push({ h: hsl.h, s: hsl.s, l: hsl.l, hex: hex.toLowerCase(), rgb }); switchSection('palettes'); renderPalette(); updateJson(); updateSidebarStats(); } });
  document.getElementById('explorer-send-contrast').addEventListener('click', () => { const hex = panelHex.textContent; if (hex && hex !== '—') { document.getElementById('fg-color-input').value = hex.toLowerCase(); document.getElementById('fg-hex').value = hex.toUpperCase(); document.getElementById('fg-swatch').style.backgroundColor = hex.toLowerCase(); document.getElementById('fg-dot').style.backgroundColor = hex.toLowerCase(); updateContrast(); switchSection('contrast'); } });
  updatePicker(); updateJson();

  // ===================== CONTRAST =====================
  const bgColorInput = document.getElementById('bg-color-input');
  const fgColorInput = document.getElementById('fg-color-input');
  const bgHex = document.getElementById('bg-hex');
  const fgHex = document.getElementById('fg-hex');
  const bgSwatch = document.getElementById('bg-swatch');
  const fgSwatch = document.getElementById('fg-swatch');
  const bgDot = document.getElementById('bg-dot');
  const fgDot = document.getElementById('fg-dot');
  const scoreRatio = document.getElementById('score-ratio');
  const badgeAaNormal = document.getElementById('badge-aa-normal');
  const badgeAaLarge = document.getElementById('badge-aa-large');
  const badgeAaaNormal = document.getElementById('badge-aaa-normal');
  const badgeAaaLarge = document.getElementById('badge-aaa-large');
  const previewBox = document.getElementById('contrast-preview-box');
  const previewLg = document.getElementById('preview-lg');
  const previewMd = document.getElementById('preview-md');
  const previewSm = document.getElementById('preview-sm');
  const contrastBgName = document.getElementById('contrast-bg-name');
  const contrastFgName = document.getElementById('contrast-fg-name');
  const contrastLumBg = document.getElementById('contrast-lum-bg');
  const contrastLumFg = document.getElementById('contrast-lum-fg');
  const quickPairsContainer = document.getElementById('contrast-quick-pairs');

  function updateContrast() {
    const bg = bgColorInput.value.toLowerCase();
    const fg = fgColorInput.value.toLowerCase();
    bgSwatch.style.backgroundColor = bg;
    fgSwatch.style.backgroundColor = fg;
    bgDot.style.backgroundColor = bg;
    fgDot.style.backgroundColor = fg;
    bgHex.value = bg.toUpperCase();
    fgHex.value = fg.toUpperCase();

    const ratio = getContrastRatio(bg, fg);
    const rounded = ratio.toFixed(2);
    scoreRatio.textContent = rounded;
    scoreRatio.style.color = ratio >= 7 ? '#4edea3' : ratio >= 4.5 ? '#ffb786' : '#ffb4ab';

    previewBox.style.backgroundColor = bg;
    previewLg.style.color = fg;
    previewMd.style.color = fg;
    previewSm.style.color = fg;

    const aaNormal = ratio >= 4.5;
    const aaLarge = ratio >= 3;
    const aaaNormal = ratio >= 7;
    const aaaLarge = ratio >= 4.5;

    badgeAaNormal.textContent = aaNormal ? 'PASS' : 'FAIL';
    badgeAaNormal.className = 'contrast-badge ' + (aaNormal ? 'badge-pass' : 'badge-fail');
    badgeAaLarge.textContent = aaLarge ? 'PASS' : 'FAIL';
    badgeAaLarge.className = 'contrast-badge ' + (aaLarge ? 'badge-pass' : 'badge-fail');
    badgeAaaNormal.textContent = aaaNormal ? 'PASS' : 'FAIL';
    badgeAaaNormal.className = 'contrast-badge ' + (aaaNormal ? 'badge-pass' : 'badge-fail');
    badgeAaaLarge.textContent = aaaLarge ? 'PASS' : 'FAIL';
    badgeAaaLarge.className = 'contrast-badge ' + (aaaLarge ? 'badge-pass' : 'badge-fail');

    contrastBgName.textContent = bg.toUpperCase();
    contrastFgName.textContent = fg.toUpperCase();
    contrastLumBg.textContent = getLuminance(...hexToRgb(bg)).toFixed(3);
    contrastLumFg.textContent = getLuminance(...hexToRgb(fg)).toFixed(3);
  }

  bgColorInput.addEventListener('input', updateContrast);
  fgColorInput.addEventListener('input', updateContrast);
  bgHex.addEventListener('change', () => { let v = bgHex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) { bgColorInput.value = v; updateContrast(); } });
  fgHex.addEventListener('change', () => { let v = fgHex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) { fgColorInput.value = v; updateContrast(); } });
  document.getElementById('contrast-swap').addEventListener('click', () => { const tmp = bgColorInput.value; bgColorInput.value = fgColorInput.value; fgColorInput.value = tmp; updateContrast(); });

  // Quick pairs
  const quickPairs = [
    { name: 'Black on White', bg: '#ffffff', fg: '#000000' },
    { name: 'White on Black', bg: '#000000', fg: '#ffffff' },
    { name: 'Dark Blue on White', bg: '#ffffff', fg: '#0014b1' },
    { name: 'White on Dark Blue', bg: '#0014b1', fg: '#ffffff' },
    { name: 'Green on White', bg: '#ffffff', fg: '#00a572' },
    { name: 'White on Green', bg: '#00a572', fg: '#ffffff' },
    { name: 'Orange on Dark', bg: '#0b1326', fg: '#df7412' },
    { name: 'Light on Dark', bg: '#0b1326', fg: '#dae2fd' },
    { name: 'Pink on Dark', bg: '#0b1326', fg: '#ffdad6' },
    { name: 'Teal on White', bg: '#ffffff', fg: '#008080' },
  ];
  quickPairs.forEach(pair => {
    const div = document.createElement('div');
    div.className = 'contrast-pair-item';
    div.innerHTML = '<div class="contrast-pair-swatch" style="background:' + pair.bg + ';border:2px solid ' + pair.fg + '"></div><div class="contrast-pair-info"><div class="contrast-pair-name">' + pair.name + '</div><div class="contrast-pair-ratio">' + getContrastRatio(pair.bg, pair.fg).toFixed(2) + ':1</div></div>';
    div.addEventListener('click', () => { bgColorInput.value = pair.bg; fgColorInput.value = pair.fg; updateContrast(); });
    quickPairsContainer.appendChild(div);
  });
  updateContrast();

  // ===================== LIBRARY =====================
  const libraryPalettes = [
    { name: 'Material Design', colors: ['#F44336','#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#03A9F4','#00BCD4','#009688','#4CAF50','#8BC34A','#CDDC39','#FFEB3B','#FFC107','#FF9800','#FF5722'] },
    { name: 'Tailwind CSS', colors: ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#d946ef','#f43f5e','#78716c'] },
    { name: 'Open Color', colors: ['#ff6b6b','#f06595','#cc5de8','#845ef7','#5c7cfa','#339af0','#22b8cf','#20c997','#51cf66','#94d82d','#fcc419','#ff922b','#ff6b6b','#868e96'] },
    { name: 'Dracula', colors: ['#282a36','#44475a','#f8f8f2','#6272a4','#8be9fd','#50fa7b','#ffb86c','#ff79c6','#bd93f9','#ff5555','#f1fa8c'] },
    { name: 'Nord', colors: ['#2E3440','#3B4252','#434C5E','#4C566A','#D8DEE9','#E5E9F0','#ECEFF4','#8FBCBB','#88C0D0','#81A1C1','#5E81AC','#BF616A','#D08770','#EBCB8B','#A3BE8C','#B48EAD'] },
    { name: 'Solarized', colors: ['#002b36','#073642','#586e75','#657b83','#839496','#93a1a1','#eee8d5','#fdf6e3','#b58900','#cb4b16','#dc322f','#d33682','#6c71c4','#268bd2','#2aa198','#859900'] },
    { name: 'Monokai', colors: ['#272822','#f8f8f2','#75715e','#f92672','#fd971f','#f4bf75','#a6e22e','#a1efe4','#66d9ef','#ae81ff'] },
    { name: 'Gruvbox', colors: ['#282828','#cc241d','#98971a','#d79921','#458588','#b16286','#689d6a','#a89984','#928374','#fb4934','#b8bb26','#fabd2f','#83a598','#d3869b','#8ec07c','#ebdbb2'] },
    { name: 'Pastel', colors: ['#FFB3BA','#FFDFBA','#FFFFBA','#BAFFC9','#BAE1FF','#E6B3FF','#FFB3E6','#B3FFFF','#FFD9B3','#D9B3FF'] },
    { name: 'Ocean', colors: ['#0A192F','#112240','#233554','#64FFDA','#8892B0','#CCD6F6','#E6F1FF','#57CBFF','#F78C6C','#C792EA'] },
    { name: 'Forest', colors: ['#1B4332','#2D6A4F','#40916C','#52B788','#74C69D','#95D5B2','#B7E4C7','#D8F3DC','#95D5B2','#52B788'] },
    { name: 'Sunset', colors: ['#FF4800','#FF6000','#FF7900','#FF9100','#FFAA00','#FFC300','#FFDA00','#FFF200','#E8FF00','#CFFF00'] },
  ];

  const libraryGrid = document.getElementById('library-grid');
  libraryPalettes.forEach(palette => {
    const card = document.createElement('div');
    card.className = 'library-card';
    const strip = document.createElement('div');
    strip.className = 'library-card-strip';
    palette.colors.forEach(c => {
      const colorDiv = document.createElement('div');
      colorDiv.className = 'library-card-color';
      colorDiv.style.backgroundColor = c;
      colorDiv.dataset.hex = c.toUpperCase();
      colorDiv.addEventListener('click', (e) => { e.stopPropagation(); navigator.clipboard.writeText(c.toUpperCase()); });
      strip.appendChild(colorDiv);
    });
    const header = document.createElement('div');
    header.className = 'library-card-header';
    header.innerHTML = '<span class="library-card-title">' + palette.name + '</span><span class="library-card-count">' + palette.colors.length + ' colors</span>';
    const actions = document.createElement('div');
    actions.className = 'library-card-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'library-card-btn library-card-btn-copy';
    copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">content_copy</span>Copy All';
    copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(JSON.stringify(palette.colors, null, 2)); copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span>Copied!'; setTimeout(() => copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">content_copy</span>Copy All', 1500); });
    const loadBtn = document.createElement('button');
    loadBtn.className = 'library-card-btn library-card-btn-load';
    loadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">download</span>Load';
    loadBtn.addEventListener('click', () => {
      paletteColors = [];
      palette.colors.forEach(c => { const hsl = hexToHsl(c); const rgb = hexToRgb(c); paletteColors.push({ h: hsl.h, s: hsl.s, l: hsl.l, hex: c.toLowerCase(), rgb }); });
      switchSection('palettes');
      renderPalette(); updateJson(); updateSidebarStats();
    });
    actions.appendChild(copyBtn);
    actions.appendChild(loadBtn);
    card.appendChild(header);
    card.appendChild(strip);
    card.appendChild(actions);
    libraryGrid.appendChild(card);
  });


  // ===================== PROMPT =====================
  // @@PURE-START
  const PR_TYPES = ['cartel', 'anuncio publicitario', 'banner', 'flyer', 'portada', 'post para redes sociales'];
  const PR_BANNED = ['amarillo', 'dorado', 'naranja', 'beige', 'tonos cálidos', 'sepia', 'rojo', 'rosa', 'morado', 'verde', 'azul', 'negro'];
  function prColorName(hex) {
    const c = hexToHsl(hex), h = c.h, s = c.s, l = c.l;
    if (l <= 8) return 'negro';
    if (l >= 95 && s <= 40) return 'blanco';
    if (s < 10) return l < 30 ? 'gris oscuro' : (l > 75 ? 'gris claro' : 'gris');
    let base;
    if (h < 15 || h >= 345) base = 'rojo';
    else if (h < 40) { if (l < 35) return 'café'; base = 'naranja'; }
    else if (h < 65) { if (l < 35) return 'oliva'; base = 'amarillo'; }
    else if (h < 90) base = 'lima';
    else if (h < 135) base = 'verde';
    else if (h < 175) base = (l >= 25 && l <= 55 && s >= 50) ? 'verde esmeralda' : 'verde';
    else if (h < 195) base = 'turquesa';
    else if (h < 255) base = 'azul';
    else if (h < 290) base = 'violeta';
    else base = l > 70 ? 'rosa' : 'magenta';
    if (base === 'azul' && l < 28) return 'azul marino';
    if (l < 25) return base + ' oscuro';
    if (l > 78) return base + ' claro';
    return base;
  }
  function prJoin(arr, conj) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' ' + conj + ' ' + arr[arr.length - 1];
  }
  function prBuild(o) {
    const tema = o.topic.trim() || '[TEMA, EVENTO, MARCA O PRODUCTO]';
    const colors = o.colors.map(c => (c.name.trim() ? c.name.trim() + ' ' : '') + c.hex.toUpperCase());
    const colorStr = colors.length ? prJoin(colors, 'y') : '[SELECCIONA 3 A 4 COLORES]';
    const banned = PR_BANNED.filter(b => o.banned.indexOf(b) >= 0)
      .concat(o.bannedExtra.split(',').map(x => x.trim()).filter(Boolean));
    const lines = [];
    lines.push('Diseña un ' + o.type + ' contemporáneo, profesional y con identidad propia para ' + tema + '.');
    lines.push('');
    lines.push('Especificaciones visuales:');
    lines.push('');
    lines.push('Paleta cromática estricta: ' + colorStr + '. Mantén la paleta indicada en toda la composición.');
    if (banned.length) {
      lines.push('');
      lines.push('Restricción de color: NO uses ' + prJoin(banned, 'ni') + '.');
    }
    lines.push('');
    lines.push('Estilo y Dirección de Arte: Dirección artística editorial sofisticada, alto contraste, colores limpios, saturación controlada, geometría precisa y uso estratégico del espacio negativo.');
    lines.push('');
    lines.push('Jerarquía e Integración: Jerarquía visual clara y balanceada entre la tipografía y los elementos gráficos.');
    lines.push('');
    lines.push('Estética a evitar: Evita apariencias genéricas de IA, degradados saturados/cálidos y composiciones saturadas o de plantilla predeterminada.');
    if (o.context.trim()) {
      lines.push('');
      lines.push('Contexto adicional: ' + o.context.trim());
    }
    return lines.join('\n');
  }
  // @@PURE-END

  let prType = PR_TYPES[0];
  let prSelected = [];
  let prBannedSet = ['amarillo', 'dorado', 'naranja', 'beige', 'tonos cálidos', 'sepia'];
  const prTypesEl = document.getElementById('pr-types');
  const prTopic = document.getElementById('pr-topic');
  const prPalEl = document.getElementById('pr-pal');
  const prSelEl = document.getElementById('pr-sel');
  const prStatus = document.getElementById('pr-status');
  const prPick = document.getElementById('pr-pick');
  const prHex = document.getElementById('pr-hex');
  const prBannedEl = document.getElementById('pr-banned');
  const prBannedExtra = document.getElementById('pr-banned-extra');
  const prContext = document.getElementById('pr-context');
  const prStrip = document.getElementById('pr-strip');
  const prOut = document.getElementById('pr-out');
  let prText = '';

  function prEsc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function prFlash(btn, html) { const old = btn.innerHTML; btn.innerHTML = html; setTimeout(() => { btn.innerHTML = old; }, 1500); }

  function prRenderOutput() {
    prText = prBuild({ type: prType, topic: prTopic.value, colors: prSelected, banned: prBannedSet, bannedExtra: prBannedExtra.value, context: prContext.value });
    let h = prEsc(prText);
    h = h.replace(/^(Especificaciones visuales|Paleta cromática estricta|Restricción de color|Estilo y Dirección de Arte|Jerarquía e Integración|Estética a evitar|Contexto adicional):/gm, '<span class="k">$1:</span>');
    h = h.replace(/\[[^\]]+\]/g, '<span class="ph">$&</span>');
    h = h.replace(/#[0-9A-Fa-f]{6}\b/g, (m) => '<span class="hx" style="border-bottom-color:' + m + '">' + m + '</span>');
    prOut.innerHTML = h;
    prStrip.innerHTML = '';
    if (prSelected.length) {
      prStrip.className = 'pr-strip';
      prSelected.forEach(c => { const d = document.createElement('div'); d.style.backgroundColor = c.hex; prStrip.appendChild(d); });
    } else { prStrip.className = 'pr-strip pr-strip-empty'; prStrip.textContent = 'Sin colores'; }
  }
  function prRenderTypes() {
    prTypesEl.innerHTML = '';
    PR_TYPES.forEach(t => {
      const b = document.createElement('button'); b.className = 'pr-chip' + (t === prType ? ' on' : ''); b.textContent = t;
      b.addEventListener('click', () => { prType = t; prRenderTypes(); prRenderOutput(); });
      prTypesEl.appendChild(b);
    });
  }
  function prRenderBanned() {
    prBannedEl.innerHTML = '';
    PR_BANNED.forEach(t => {
      const b = document.createElement('button'); b.className = 'pr-chip ban' + (prBannedSet.indexOf(t) >= 0 ? ' on' : ''); b.textContent = t;
      b.addEventListener('click', () => { const i = prBannedSet.indexOf(t); if (i >= 0) prBannedSet.splice(i, 1); else prBannedSet.push(t); prRenderBanned(); prRenderOutput(); });
      prBannedEl.appendChild(b);
    });
  }
  function prIndexOf(hex) { return prSelected.findIndex(c => c.hex.toLowerCase() === hex.toLowerCase()); }
  function prAddColor(hex, name) {
    if (prSelected.length >= 4 || prIndexOf(hex) >= 0) return false;
    prSelected.push({ hex: hex.toLowerCase(), name: name || prColorName(hex) });
    return true;
  }
  function prRenderStatus() {
    const n = prSelected.length, ok = n >= 3 && n <= 4;
    prStatus.textContent = n + ' / 4' + (ok ? ' ✓' : (n < 3 ? ' · faltan ' + (3 - n) : ''));
    prStatus.className = 'pr-status ' + (ok ? 'ok' : 'bad');
  }
  function renderPromptPalette() {
    prPalEl.innerHTML = '';
    if (!paletteColors.length) { prPalEl.innerHTML = '<div class="pr-empty">Tu paleta del builder está vacía. Agrega colores en Palettes o usa el selector de abajo.</div>'; }
    paletteColors.forEach(c => {
      const idx = prIndexOf(c.hex);
      const b = document.createElement('button'); b.className = 'pr-pal-chip' + (idx >= 0 ? ' on' : ''); b.style.backgroundColor = c.hex; b.title = c.hex.toUpperCase();
      if (idx >= 0) b.innerHTML = '<span class="num">' + (idx + 1) + '</span>';
      b.addEventListener('click', () => {
        const i = prIndexOf(c.hex);
        if (i >= 0) prSelected.splice(i, 1); else if (!prAddColor(c.hex)) { prFlash(prStatus, 'máx. 4'); return; }
        prRenderSelected();
      });
      prPalEl.appendChild(b);
    });
  }
  function prRenderSelected() {
    prSelEl.innerHTML = '';
    prSelected.forEach((c, i) => {
      const row = document.createElement('div'); row.className = 'pr-sel-row';
      row.innerHTML = '<span class="pr-sel-idx">#' + (i + 1) + '</span><div class="pr-sel-sw" style="background-color:' + c.hex + '"></div>';
      const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'pr-text'; inp.value = c.name; inp.placeholder = 'Nombre del color';
      inp.addEventListener('input', () => { c.name = inp.value; prRenderOutput(); });
      const hx = document.createElement('span'); hx.className = 'pr-sel-hex'; hx.textContent = c.hex.toUpperCase();
      const x = document.createElement('button'); x.className = 'pr-sel-x'; x.title = 'Quitar'; x.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">close</span>';
      x.addEventListener('click', () => { prSelected.splice(i, 1); prRenderSelected(); });
      row.appendChild(inp); row.appendChild(hx); row.appendChild(x);
      prSelEl.appendChild(row);
    });
    renderPromptPalette(); prRenderStatus(); prRenderOutput();
  }

  prPick.addEventListener('input', () => { prHex.value = prPick.value.toUpperCase(); });
  prHex.addEventListener('input', () => { let v = prHex.value.trim(); if (v[0] !== '#') v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) prPick.value = v.toLowerCase(); });
  document.getElementById('pr-add-btn').addEventListener('click', () => {
    let v = prHex.value.trim(); if (v[0] !== '#') v = '#' + v;
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) { prFlash(document.getElementById('pr-add-btn'), 'HEX inválido'); return; }
    if (!prAddColor(v)) { prFlash(document.getElementById('pr-add-btn'), prSelected.length >= 4 ? 'Máximo 4' : 'Ya agregado'); return; }
    prRenderSelected();
  });
  [prTopic, prBannedExtra, prContext].forEach(el => el.addEventListener('input', prRenderOutput));
  document.getElementById('pr-copy').addEventListener('click', function () {
    const btn = this;
    const done = () => prFlash(btn, '<span class="material-symbols-outlined" style="font-size:16px">check</span>Copiado');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prText).then(done, done);
    else { const t = document.createElement('textarea'); t.value = prText; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); }
  });
  document.getElementById('pr-download').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([prText], { type: 'text/plain;charset=utf-8' })); a.download = 'prompt-diseno.txt';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  prRenderTypes(); prRenderBanned(); prRenderSelected();

})();

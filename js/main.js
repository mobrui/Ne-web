/**
 * NE Naught Project — Main JavaScript
 * Markdown Blog Engine + Photo Wall + Friend Links
 *
 * 更新方式（MD 驱动）：
 *   写新文章 → content/posts/ 下新建 .md 文件（含 YAML front matter）
 *              → content/posts.json 添加文件名
 *              → 标题/日期/摘要全部来自 MD 文件，修改即生效
 *   添加照片 → content/photos.json
 *   添加友链 → content/friends.json
 */

// ============================================================
//  DOM Ready
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setYear();
  initNav();
  initSmoothScroll();
  initScrollSpy();
  initScrollReveal();
  initPostOverlay();
  initLightbox();
  loadAllContent();
});

// ============================================================
//  Footer Year
// ============================================================
function setYear() {
  document.getElementById('year').textContent = new Date().getFullYear();
}

// ============================================================
//  Navigation
// ============================================================
function initNav() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  toggle.setAttribute('aria-expanded', 'false');

  function closeNav() {
    links.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 60);
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ============================================================
//  Smooth Scroll
// ============================================================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      const navH = document.getElementById('nav').offsetHeight;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// ============================================================
//  Scroll Spy
// ============================================================
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        let current = '';
        const navH = document.getElementById('nav').offsetHeight + 80;
        sections.forEach(sec => {
          if (sec.getBoundingClientRect().top <= navH) current = sec.getAttribute('id');
        });
        navLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
        });
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ============================================================
//  Scroll Reveal
// ============================================================
let _revealObserver = null;

function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.about-card, .news-card, .joinus-item, .friend-card').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }

  _revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.15 });

  // Observe static elements already in DOM
  document.querySelectorAll('.about-card').forEach(el => _revealObserver.observe(el));
}

// Call after dynamic content renders
function observeDynamicElements() {
  if (!_revealObserver) {
    document.querySelectorAll('.news-card, .joinus-item, .friend-card').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }
  document.querySelectorAll('.news-card, .joinus-item, .friend-card').forEach(el => {
    _revealObserver.observe(el);
  });
}

// ============================================================
//  Load All Content
// ============================================================
async function loadAllContent() {
  await Promise.all([
    loadPosts(),
    loadPhotos(),
    loadJoinUs(),
    loadFriends(),
  ]);
  // Observe dynamically rendered elements for scroll animations
  observeDynamicElements();
}

// ============================================================
//  LOAD POSTS — MD-Driven Blog System
//  ============================================================
//  posts.json only lists filenames; all metadata comes from MD front matter.
//  Each MD is fetched once and cached — list view + detail view share the same data.
let _postsCache = [];

async function loadPosts() {
  const container = document.getElementById('newsContainer');
  try {
    // 1. Fetch file manifest (just filenames)
    const manifestRes = await fetch('content/posts.json');
    if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status}`);
    const manifest = await manifestRes.json();
    const files = Array.isArray(manifest) ? manifest.filter(isSafePostFilename) : [];

    if (!files.length) {
      container.innerHTML = '<p class="empty-state">暂无文章，敬请期待 ✨</p>';
      return;
    }

    // 2. Fetch ALL .md files in parallel, parse front matter + body
    const results = await Promise.all(
      files.map(async (filename) => {
        const path = `content/posts/${filename}`;
        try {
          const mdRes = await fetch(path);
          if (!mdRes.ok) {
            console.warn(`Post not found: ${path}`);
            return null;
          }
          const md = await mdRes.text();
          const { meta, html } = parseMarkdown(md, 'content/posts/');
          return { meta, html, file: path };
        } catch (err) {
          console.warn(`Failed to load post: ${path}`, err);
          return null;
        }
      })
    );

    // 3. Filter out missing/failed posts
    const posts = results.filter(Boolean);
    if (!posts.length) {
      container.innerHTML = '<p class="empty-state">暂无文章，敬请期待 ✨</p>';
      return;
    }

    // 4. Cache for instant detail-view
    _postsCache = posts;

    // 5. Render card list
    renderPostList(posts);
  } catch (err) {
    console.warn('Failed to load posts:', err);
    if (window.location.protocol === 'file:') {
      container.innerHTML = `<div class="empty-state file-warning">
        <p style="font-size:1.2rem;margin-bottom:12px;">⚠️ 无法直接打开此文件</p>
        <p style="margin-bottom:8px;">浏览器安全策略禁止直接从本地文件加载内容。</p>
        <p>请使用以下方式之一：</p>
        <p style="margin-top:8px;">
          <strong>Windows：</strong>双击 <code>start.bat</code><br>
          <strong>macOS / Linux：</strong><code>./start.sh</code><br>
          <strong>终端：</strong><code>python -m http.server 8080</code><br>
          <strong>VS Code：</strong>安装 Live Server 插件右键打开
        </p>
        <p style="margin-top:12px;font-size:0.85rem;">然后访问 <code>http://localhost:8080</code></p>
      </div>`;
    } else {
      container.innerHTML = '<p class="empty-state">文章加载失败，请稍后重试</p>';
    }
  }
}

function renderPostList(posts) {
  const container = document.getElementById('newsContainer');

  // Sort by date descending (from MD front matter)
  const sorted = [...posts].sort((a, b) => parseDateValue(b.meta.date) - parseDateValue(a.meta.date));

  container.innerHTML = sorted.map((post, i) => `
    <article class="news-card" style="--delay:${i * 0.1}s" data-post-file="${escapeAttr(encodeURIComponent(post.file))}" role="button" tabindex="0">
      <div class="news-card-inner">
        ${post.meta.image ? `<div class="news-card-img"><img src="${escapeAttr(sanitizeUrl(post.meta.image, { image: true }))}" alt="${escapeAttr(post.meta.title || '活动图片')}" loading="lazy"></div>` : ''}
        <div class="news-card-body">
          <time datetime="${escapeAttr(post.meta.date || '')}" class="news-date">${escapeHtml(formatDate(post.meta.date))}</time>
          <h3 class="news-title">${escapeHtml(post.meta.title || '未命名')}</h3>
          <p class="news-summary">${escapeHtml(post.meta.summary || '')}</p>
          <span class="news-readmore">阅读全文 →</span>
        </div>
      </div>
    </article>
  `).join('');

  // Click handler: open post detail (uses cached content)
  container.querySelectorAll('.news-card').forEach(card => {
    card.addEventListener('click', () => {
      const file = decodeURIComponent(card.dataset.postFile);
      openPost(file);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const file = decodeURIComponent(card.dataset.postFile);
        openPost(file);
      }
    });
  });
}

// ============================================================
//  Post Detail Overlay
// ============================================================
async function openPost(filePath) {
  const overlay = document.getElementById('postOverlay');
  const body = document.getElementById('postBody');
  const title = document.getElementById('postTitle');
  const date = document.getElementById('postDate');

  // Show overlay with loading spinner
  const wasOpen = overlay.classList.contains('open');
  overlay.classList.add('open');
  overlay.scrollTop = 0;
  body.innerHTML = '<div class="spinner"></div>';
  title.textContent = '';
  date.textContent = '';
  if (!wasOpen) lockPageScroll();

  // Try cache first (post was already fetched during loadPosts)
  let post = _postsCache.find(p => p.file === filePath);

  if (!post) {
    // Fallback: fetch on demand (for direct links, etc.)
    try {
      const res = await fetch(filePath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const md = await res.text();
      const { meta, html } = parseMarkdown(md, 'content/posts/');
      post = { meta, html, file: filePath };
      _postsCache.push(post);
    } catch (err) {
      body.innerHTML = '<p class="empty-state">文章加载失败</p>';
      console.warn('Failed to load post:', filePath, err);
      return;
    }
  }

  title.textContent = post.meta.title || '';
  date.textContent = post.meta.date ? formatDate(post.meta.date) : '';
  body.innerHTML = post.html;
}

function closePost() {
  const overlay = document.getElementById('postOverlay');
  if (!overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  unlockPageScroll();
}

function initPostOverlay() {
  // Close button
  document.getElementById('postClose').addEventListener('click', closePost);
  document.getElementById('postBackBtn').addEventListener('click', closePost);

  // Click backdrop
  document.getElementById('postOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('post-overlay-backdrop')) closePost();
  });

  // Escape handled globally in initLightbox (unified handler)
}

// ============================================================
//  MARKDOWN PARSER
//  ============================================================
function parseMarkdown(md, basePath) {
  let meta = {};

  // 1. Extract YAML front matter
  const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  let content = md;
  if (fmMatch) {
    const fm = fmMatch[1];
    fm.split('\n').forEach(line => {
      const kv = line.match(/^([\w-]+):\s*(.*)/);
      if (kv) {
        const key = kv[1].trim();
        let val = stripOuterQuotes(kv[2].trim());
        // Resolve relative image path in front matter (e.g. image: imgs/foo.jpg)
        if (key === 'image' && val && basePath) {
          val = sanitizeUrl(resolveRelativeUrl(val, basePath), { image: true });
        }
        meta[key] = val;
      }
    });
    content = md.slice(fmMatch[0].length);
  }

  // 2. Normalize
  content = content.replace(/\r\n/g, '\n').trim();

  // 3. Split into blocks (paragraphs separated by blank lines)
  const blocks = content.split(/\n\n+/);
  const htmlBlocks = [];

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    const lines = block.split('\n');
    const firstLine = lines[0];

    // --- Horizontal rule
    if (/^[-*_]{3,}$/.test(block)) {
      htmlBlocks.push('<hr class="post-hr">');
      continue;
    }

    // Headings
    const hMatch = firstLine.match(/^(#{1,6})\s+(.+)/);
    if (hMatch && lines.length === 1) {
      const level = hMatch[1].length;
      htmlBlocks.push(`<h${level} class="post-h${level}">${inlineParse(hMatch[2], basePath)}</h${level}>`);
      continue;
    }

    // Blockquote
    if (firstLine.startsWith('> ')) {
      const qLines = lines.map(l => l.replace(/^>\s?/, ''));
      htmlBlocks.push(`<blockquote class="post-quote"><p>${inlineParse(qLines.join('\n'), basePath).replace(/\n/g, '<br>')}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (firstLine.match(/^[\-*+]\s/)) {
      const items = [];
      for (const l of lines) {
        const m = l.match(/^[\-*+]\s+(.*)/);
        if (m) items.push(`<li>${inlineParse(m[1], basePath)}</li>`);
      }
      htmlBlocks.push(`<ul class="post-list">${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (firstLine.match(/^\d+\.\s/)) {
      const items = [];
      for (const l of lines) {
        const m = l.match(/^\d+\.\s+(.*)/);
        if (m) items.push(`<li>${inlineParse(m[1], basePath)}</li>`);
      }
      htmlBlocks.push(`<ol class="post-list">${items.join('')}</ol>`);
      continue;
    }

    // Paragraph (default)
    htmlBlocks.push(`<p class="post-p">${inlineParse(block, basePath).replace(/\n/g, '<br>')}</p>`);
  }

  return { meta, html: htmlBlocks.join('\n') };
}

// Resolve a URL: if it's relative (doesn't start with /, http, data), prepend basePath
function resolveRelativeUrl(url, basePath) {
  if (!url || !basePath) return url;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(url)) return url; // absolute, scheme, or root URL
  return basePath + url;
}

// Inline parser: bold, italic, links, images, code, strikethrough
function inlineParse(text, basePath) {
  const tokens = [];
  const stash = (html) => {
    const index = tokens.push(html) - 1;
    return `\uE000${index}\uE000`;
  };

  let source = String(text || '');

  source = source.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const src = sanitizeUrl(resolveRelativeUrl(url.trim(), basePath), { image: true });
    if (!src) return alt || '[图片]';
    return stash(`<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" class="post-img" loading="lazy">`);
  });

  source = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = sanitizeUrl(resolveRelativeUrl(url.trim(), basePath));
    if (!href) return label;
    return stash(`<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });

  let html = escapeHtml(source);

  html = html
    .replace(/`([^`]+)`/g, (_, code) => stash(`<code class="post-code">${code}</code>`))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');

  return html.replace(/\uE000(\d+)\uE000/g, (_, index) => tokens[Number(index)] || '');
}

// ============================================================
//  LOAD PHOTOS — two-row infinite marquee (JS-driven)
//  ============================================================
//  Supports: auto-scroll, mouse-wheel (desktop), touch-drag (mobile),
//  circular looping, hover-to-pause-auto (wheel still works).
let _allPhotos = [];

async function loadPhotos() {
  const container = document.getElementById('galleryMarquee');
  try {
    const res = await fetch('content/photos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const photos = Array.isArray(data) ? data : [];
    if (!photos.length) {
      container.innerHTML = '<p class="empty-state" style="padding:60px 24px;">暂无照片，敬请期待 📸</p>';
      return;
    }
    _allPhotos = photos;
    renderMarquee(photos);
  } catch (err) {
    console.warn('Failed to load photos:', err);
    container.innerHTML = '<p class="empty-state">照片加载失败</p>';
  }
}

function renderMarquee(photos) {
  const container = document.getElementById('galleryMarquee');

  // Clean up previous animation loop if re-rendering
  if (container._cleanup) container._cleanup();

  // Split into two halves
  const mid = Math.ceil(photos.length / 2);
  const row1 = photos.slice(0, mid);
  const row2 = photos.slice(mid);
  const safeRow2 = row2.length ? row2 : row1;

  const makeItem = (photo, i) => {
    const fullSrc = sanitizeUrl(photo.src || photo.thumb || '', { image: true }) ||
      sanitizeUrl(photo.thumb || '', { image: true });
    const thumbSrc = sanitizeUrl(photo.thumb || photo.src || '', { image: true });
    const caption = photo.caption || '照片';
    return `
    <div class="gallery-item" data-src="${escapeAttr(fullSrc)}" data-caption="${escapeAttr(caption)}" data-index="${i}">
      ${thumbSrc
        ? `<img src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(caption)}" loading="lazy">`
        : `<div class="gallery-placeholder">
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
           </div>`
      }
    </div>`;
  };

  // Duplicate each row for seamless looping
  const row1html = [...row1, ...row1].map((p) => makeItem(p, photos.indexOf(p))).join('');
  const row2html = [...safeRow2, ...safeRow2].map((p) => makeItem(p, photos.indexOf(p))).join('');

  container.innerHTML = `
    <div class="gallery-row row-left">${row1html}</div>
    <div class="gallery-row row-right">${row2html}</div>
  `;

  // ============================================================
  //  JS-DRIVEN MARQUEE ENGINE
  // ============================================================
  const rowLeft  = container.querySelector('.row-left');
  const rowRight = container.querySelector('.row-right');
  const eventController = new AbortController();
  const eventSignal = eventController.signal;

  // --- State ---
  let posLeft  = 0;                 // row-left  translateX (px); scrolls negative
  let posRight = 0;                 // row-right translateX (px); starts at -halfWidth, scrolls positive
  let halfWLeft  = 0;              // half of row-left  scrollWidth (one copy)
  let halfWRight = 0;              // half of row-right scrollWidth (one copy)
  let posRightInitialized = false; // set posRight = -halfWRight once measured

  const AUTO_SPEED = 28;           // pixels per second
  let isHovering     = false;
  let userInteracting = false;
  let resumeTimer    = null;
  const RESUME_DELAY = 1800;       // ms idle before auto-scroll resumes

  // --- Measure half-widths ---
  function measure() {
    if (rowLeft.scrollWidth  > 0) halfWLeft  = rowLeft.scrollWidth  / 2;
    if (rowRight.scrollWidth > 0) halfWRight = rowRight.scrollWidth / 2;
    // Initialise row-right position to -halfWRight on first measurement
    if (!posRightInitialized && halfWRight > 0) {
      posRight = -halfWRight;
      posRightInitialized = true;
    }
  }

  // Schedule gradual remeasures (images load async, window may resize)
  function scheduleMeasures() {
    measure();
    setTimeout(measure, 300);
    setTimeout(measure, 800);
    setTimeout(measure, 2000);
  }
  scheduleMeasures();
  const onResize = () => scheduleMeasures();
  window.addEventListener('resize', onResize, { signal: eventSignal });

  // --- Apply positions to DOM ---
  function apply() {
    rowLeft.style.transform  = `translateX(${posLeft}px)`;
    rowRight.style.transform = `translateX(${posRight}px)`;
  }

  // --- Circular wrap ---
  function wrap() {
    if (halfWLeft <= 0 || halfWRight <= 0) return;
    // row-left: moves left (negative); wrap when past -halfWLeft
    while (posLeft <= -halfWLeft) posLeft += halfWLeft;
    while (posLeft > 0)            posLeft -= halfWLeft;
    // row-right: moves right (positive); wrap when past 0 or before -halfWRight
    while (posRight >= 0)           posRight -= halfWRight;
    while (posRight < -halfWRight)  posRight += halfWRight;
  }

  // --- Mark user interaction → pause auto-scroll temporarily ---
  function markInteraction() {
    userInteracting = true;
    container.classList.add('scrolling');
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      userInteracting = false;
      container.classList.remove('scrolling');
    }, RESUME_DELAY);
  }

  // ============================================================
  //  WHEEL — desktop
  // ============================================================
  container.addEventListener('wheel', (e) => {
    if (!isHovering) return;
    e.preventDefault();
    measure();
    const delta = e.deltaY * 0.7;   // dampen for smoother feel
    // Scroll down (delta>0) → content moves left
    posLeft  -= delta;
    posRight += delta;
    wrap();
    apply();
    markInteraction();
  }, { passive: false, signal: eventSignal });

  // ============================================================
  //  TOUCH — mobile
  // ============================================================
  let touchStartX = 0, touchStartY = 0;
  let touchPosL = 0, touchPosR = 0;
  let touchActive = false;
  let touchDir = null;             // null | true=horizontal | false=vertical

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touchActive = false; return; }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchPosL   = posLeft;
    touchPosR   = posRight;
    touchActive = true;
    touchDir    = null;
    measure();
  }, { passive: true, signal: eventSignal });

  container.addEventListener('touchmove', (e) => {
    if (!touchActive || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // Determine dominant direction once movement exceeds threshold
    if (touchDir === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        touchDir = Math.abs(dx) >= Math.abs(dy);
      } else {
        return; // not enough movement yet
      }
    }

    if (touchDir) {
      // Horizontal swipe → drive photo wall
      e.preventDefault();
      suppressClick = true;          // don't open lightbox after drag
      // Swipe left (dx<0) → content moves left → rowLeft decreases, rowRight increases
      posLeft  = touchPosL + dx;
      posRight = touchPosR - dx;
      wrap();
      apply();
      markInteraction();
    }
    // Vertical → let page scroll (don't preventDefault)
  }, { passive: false, signal: eventSignal });

  const endTouch = () => { touchActive = false; touchDir = null; };
  container.addEventListener('touchend', endTouch, { signal: eventSignal });
  container.addEventListener('touchcancel', endTouch, { signal: eventSignal });

  // ============================================================
  //  HOVER
  // ============================================================
  container.addEventListener('mouseenter', () => { isHovering = true; }, { signal: eventSignal });
  container.addEventListener('mouseleave', () => {
    isHovering = false;
    userInteracting = false;
    container.classList.remove('scrolling');
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  }, { signal: eventSignal });

  // ============================================================
  //  ANIMATION LOOP  (requestAnimationFrame)
  // ============================================================
  let lastTime = 0;
  let rafId = 0;

  function animate(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.2); // cap at 200 ms
    lastTime = timestamp;

    // Auto-scroll when NOT hovering AND user is NOT interacting
    if (!isHovering && !userInteracting && halfWLeft > 0 && halfWRight > 0) {
      posLeft  -= AUTO_SPEED * dt;
      posRight += AUTO_SPEED * dt;
      wrap();
      apply();
    }

    rafId = requestAnimationFrame(animate);
  }

  rafId = requestAnimationFrame(animate);

  // --- Cleanup (for re-render / hot-reload) ---
  container._cleanup = () => {
    cancelAnimationFrame(rafId);
    if (resumeTimer) clearTimeout(resumeTimer);
    eventController.abort();
  };

  // ============================================================
  //  CLICK → LIGHTBOX  (suppressed after drag)
  // ============================================================
  let suppressClick = false;

  container.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      if (suppressClick) return;
      const src = item.dataset.src;
      if (!src) return;
      openLightbox(src, item.dataset.caption || '', item.dataset.caption || '照片');
    });
  });

  // Reset suppressClick after any touch sequence ends
  container.addEventListener('click', () => {
    // Use a microtask so the suppress check runs first on the item
    Promise.resolve().then(() => { suppressClick = false; });
  }, { signal: eventSignal });
}

// ============================================================
//  LIGHTBOX
// ============================================================
let _lightboxCleanupTimer = 0;

function openLightbox(src, caption = '', alt = '') {
  const safeSrc = sanitizeUrl(src, { image: true });
  if (!safeSrc) return;

  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCaption');

  if (_lightboxCleanupTimer) clearTimeout(_lightboxCleanupTimer);
  img.src = safeSrc;
  img.alt = alt || caption || '照片';
  cap.textContent = caption || '';
  const wasOpen = lightbox.classList.contains('open');
  lightbox.classList.add('open');
  if (!wasOpen) lockPageScroll();
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const close = document.getElementById('lightboxClose');

  function closeLightbox() {
    if (!lightbox.classList.contains('open')) return;
    lightbox.classList.remove('open');
    unlockPageScroll();
    _lightboxCleanupTimer = setTimeout(() => { img.src = ''; }, 300);
  }

  close.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Stack: close topmost overlay first
      if (lightbox.classList.contains('open')) {
        closeLightbox();
      } else if (document.getElementById('postOverlay').classList.contains('open')) {
        closePost();
      }
    }
  });
}

// ============================================================
//  LOAD JOIN US
// ============================================================
async function loadJoinUs() {
  const container = document.getElementById('joinusGrid');
  try {
    const res = await fetch('content/joinus.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const images = Array.isArray(data) ? data : [];
    if (!images.length) {
      container.innerHTML = '<p class="empty-state">暂无内容</p>';
      return;
    }
    renderJoinUs(images);
  } catch (err) {
    console.warn('Failed to load joinus:', err);
    container.innerHTML = '<p class="empty-state">加载失败</p>';
  }
}

function renderJoinUs(images) {
  const container = document.getElementById('joinusGrid');
  container.innerHTML = images.map((img, i) => {
    const fullSrc = sanitizeUrl(img.src || img.thumb || '', { image: true });
    const thumbSrc = sanitizeUrl(img.thumb || img.src || '', { image: true });
    const caption = img.caption || '待添加图片';
    return `
    <div class="joinus-item" style="--delay:${i * 0.1}s"
         data-src="${escapeAttr(fullSrc)}" data-caption="${escapeAttr(caption)}">
      ${thumbSrc
        ? `<img src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(caption)}" loading="lazy">`
        : `<div class="joinus-placeholder">
             <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
             <span>${escapeHtml(caption)}</span>
           </div>`
      }
      <div class="joinus-overlay">
        <span class="joinus-caption">${escapeHtml(caption)}</span>
      </div>
    </div>
  `;
  }).join('');

  // Click to view in lightbox
  container.querySelectorAll('.joinus-item').forEach(item => {
    item.addEventListener('click', () => {
      const src = item.dataset.src;
      if (!src) return;
      openLightbox(src, item.dataset.caption || '', item.dataset.caption || '宣传图');
    });
  });
}

// ============================================================
//  LOAD FRIENDS
// ============================================================
async function loadFriends() {
  const container = document.getElementById('friendsGrid');
  try {
    const res = await fetch('content/friends.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const friends = Array.isArray(data) ? data : [];
    if (!friends.length) {
      container.innerHTML = '<p class="empty-state">暂无友链 🔗</p>';
      return;
    }
    renderFriends(friends);
  } catch (err) {
    console.warn('Failed to load friends:', err);
    container.innerHTML = '<p class="empty-state">友链加载失败</p>';
  }
}

function renderFriends(friends) {
  const container = document.getElementById('friendsGrid');
  container.innerHTML = friends.map((friend, i) => {
    const name = friend.name || '友链';
    const description = friend.description || '';
    const url = sanitizeUrl(friend.url || '#') || '#';
    const avatar = sanitizeUrl(friend.avatar || '', { image: true });
    return `
    <a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="friend-card" style="--delay:${i * 0.1}s" title="${escapeAttr(description || name)}">
      <div class="friend-avatar">
        ${avatar
          ? `<img src="${escapeAttr(avatar)}" alt="${escapeAttr(name)}" loading="lazy">`
          : `<div class="friend-avatar-placeholder">${escapeHtml(name.charAt(0))}</div>`
        }
      </div>
      <div class="friend-info">
        <span class="friend-name">${escapeHtml(name)}</span>
        ${description ? `<span class="friend-desc">${escapeHtml(description)}</span>` : ''}
      </div>
      <span class="friend-arrow">→</span>
    </a>
  `;
  }).join('');
}

// ============================================================
//  Helpers
// ============================================================
let _scrollLockCount = 0;
let _scrollYBeforeLock = 0;

function lockPageScroll() {
  if (_scrollLockCount === 0) {
    _scrollYBeforeLock = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_scrollYBeforeLock}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  _scrollLockCount += 1;
}

function unlockPageScroll() {
  if (_scrollLockCount === 0) return;
  _scrollLockCount -= 1;
  if (_scrollLockCount > 0) return;

  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo({ top: _scrollYBeforeLock, behavior: 'auto' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function stripOuterQuotes(value) {
  return String(value ?? '').replace(/^(['"])(.*)\1$/, '$2');
}

function sanitizeUrl(url, options = {}) {
  const value = String(url ?? '').trim();
  if (!value || /[\u0000-\u001F\u007F]/.test(value)) return '';

  const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) return value;

  const scheme = schemeMatch[1].toLowerCase();
  if (options.image && scheme === 'data') {
    return /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value) ? value : '';
  }

  const allowedSchemes = options.image ? ['http', 'https'] : ['http', 'https', 'mailto'];
  return allowedSchemes.includes(scheme) ? value : '';
}

function isSafePostFilename(filename) {
  const value = String(filename ?? '').trim();
  return value.endsWith('.md') && !value.includes('/') && !value.includes('\\') && !value.includes('\0');
}

function parseDateValue(dateStr) {
  if (!dateStr) return 0;
  const isoDate = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])).getTime();
  }
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const isoDate = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[1]}.${isoDate[2]}.${isoDate[3]}`;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

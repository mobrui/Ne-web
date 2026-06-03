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
  loadAllContent();
  initLightbox();
  initScrollReveal();
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

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  });

  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
    });
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
  if (!_revealObserver) return;
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
    const files = await manifestRes.json();

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
  const sorted = [...posts].sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));

  container.innerHTML = sorted.map((post, i) => `
    <article class="news-card" style="--delay:${i * 0.1}s" data-post-file="${encodeURIComponent(post.file)}">
      <div class="news-card-inner">
        ${post.meta.image ? `<div class="news-card-img"><img src="${post.meta.image}" alt="${post.meta.title}" loading="lazy"></div>` : ''}
        <div class="news-card-body">
          <time datetime="${post.meta.date}" class="news-date">${formatDate(post.meta.date)}</time>
          <h3 class="news-title">${post.meta.title || '未命名'}</h3>
          <p class="news-summary">${post.meta.summary || ''}</p>
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
  overlay.classList.add('open');
  body.innerHTML = '<div class="spinner"></div>';
  title.textContent = '';
  date.textContent = '';
  document.body.style.overflow = 'hidden';
  window.scrollTo({ top: 0, behavior: 'instant' });

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
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function initPostOverlay() {
  // Close button
  document.getElementById('postClose').addEventListener('click', closePost);
  document.getElementById('postBackBtn').addEventListener('click', closePost);

  // Click backdrop
  document.getElementById('postOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePost();
  });

  // Escape handled globally in initLightbox (unified handler)
}
// Run early so overlay listeners are ready
initPostOverlay();

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
        let val = kv[2].trim();
        // Resolve relative image path in front matter (e.g. image: imgs/foo.jpg)
        if (key === 'image' && val && basePath) {
          val = resolveRelativeUrl(val, basePath);
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
      htmlBlocks.push(`<blockquote class="post-quote"><p>${inlineParse(qLines.join('\n'), basePath)}</p></blockquote>`);
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
    htmlBlocks.push(`<p class="post-p">${inlineParse(block.replace(/\n/g, '<br>'), basePath)}</p>`);
  }

  return { meta, html: htmlBlocks.join('\n') };
}

// Resolve a URL: if it's relative (doesn't start with /, http, data), prepend basePath
function resolveRelativeUrl(url, basePath) {
  if (!url || !basePath) return url;
  if (/^(https?:|\/\/|\/|data:)/.test(url)) return url; // absolute or data URI, leave as-is
  return basePath + url;
}

// Inline parser: bold, italic, links, images, code, strikethrough
function inlineParse(text, basePath) {
  return text
    // Images ![alt](url)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) =>
      `<img src="${resolveRelativeUrl(url, basePath)}" alt="${alt}" class="post-img" loading="lazy">`)
    // Links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic *text* or _text_
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Inline code `text`
    .replace(/`([^`]+)`/g, '<code class="post-code">$1</code>');
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
    const photos = await res.json();
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

  const makeItem = (photo, i) => `
    <div class="gallery-item" data-src="${photo.src || photo.thumb || ''}" data-index="${i}">
      ${photo.src || photo.thumb
        ? `<img src="${photo.thumb || photo.src}" alt="照片" loading="lazy">`
        : `<div class="gallery-placeholder">
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
           </div>`
      }
    </div>`;

  // Duplicate each row for seamless looping
  const row1html = [...row1, ...row1].map((p, i) => makeItem(p, photos.indexOf(p))).join('');
  const row2html = [...row2, ...row2].map((p, i) => makeItem(p, photos.indexOf(p))).join('');

  container.innerHTML = `
    <div class="gallery-row row-left">${row1html}</div>
    <div class="gallery-row row-right">${row2html}</div>
  `;

  // ============================================================
  //  JS-DRIVEN MARQUEE ENGINE
  // ============================================================
  const rowLeft  = container.querySelector('.row-left');
  const rowRight = container.querySelector('.row-right');

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
  window.addEventListener('resize', onResize);

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
  }, { passive: false });

  // ============================================================
  //  TOUCH — mobile
  // ============================================================
  let touchStartX = 0, touchStartY = 0;
  let touchPosL = 0, touchPosR = 0;
  let touchActive = false;
  let touchDir = null;             // null | true=horizontal | false=vertical
  let touchHasMoved = false;       // suppress click after drag

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touchActive = false; return; }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchPosL   = posLeft;
    touchPosR   = posRight;
    touchActive = true;
    touchDir    = null;
    touchHasMoved = false;
    measure();
  }, { passive: true });

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
      touchHasMoved = true;
      suppressClick = true;          // don't open lightbox after drag
      // Swipe left (dx<0) → content moves left → rowLeft decreases, rowRight increases
      posLeft  = touchPosL + dx;
      posRight = touchPosR - dx;
      wrap();
      apply();
      markInteraction();
    }
    // Vertical → let page scroll (don't preventDefault)
  }, { passive: false });

  const endTouch = () => { touchActive = false; touchDir = null; };
  container.addEventListener('touchend', endTouch);
  container.addEventListener('touchcancel', endTouch);

  // ============================================================
  //  HOVER
  // ============================================================
  container.addEventListener('mouseenter', () => { isHovering = true; });
  container.addEventListener('mouseleave', () => {
    isHovering = false;
    userInteracting = false;
    container.classList.remove('scrolling');
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  });

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
    window.removeEventListener('resize', onResize);
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
      const lightbox = document.getElementById('lightbox');
      const lbImg = document.getElementById('lightboxImg');
      lbImg.src = src;
      lbImg.alt = '照片';
      document.getElementById('lightboxCaption').textContent = '';
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  // Reset suppressClick after any touch sequence ends
  container.addEventListener('click', () => {
    // Use a microtask so the suppress check runs first on the item
    Promise.resolve().then(() => { suppressClick = false; });
  });
}

// ============================================================
//  LIGHTBOX
// ============================================================
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const close = document.getElementById('lightboxClose');

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { img.src = ''; }, 300);
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
        document.getElementById('postOverlay').classList.remove('open');
        document.body.style.overflow = '';
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
    const images = await res.json();
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
  container.innerHTML = images.map((img, i) => `
    <div class="joinus-item" style="--delay:${i * 0.1}s"
         data-src="${img.src || ''}" data-caption="${img.caption || ''}">
      ${img.src || img.thumb
        ? `<img src="${img.thumb || img.src}" alt="${img.caption || ''}" loading="lazy">`
        : `<div class="joinus-placeholder">
             <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
             <span>${img.caption || '待添加图片'}</span>
           </div>`
      }
      <div class="joinus-overlay">
        <span class="joinus-caption">${img.caption || ''}</span>
      </div>
    </div>
  `).join('');

  // Click to view in lightbox
  container.querySelectorAll('.joinus-item').forEach(item => {
    item.addEventListener('click', () => {
      const src = item.dataset.src;
      if (!src) return;
      const lightbox = document.getElementById('lightbox');
      const lbImg = document.getElementById('lightboxImg');
      const lbCap = document.getElementById('lightboxCaption');
      lbImg.src = src;
      lbImg.alt = item.dataset.caption;
      lbCap.textContent = item.dataset.caption;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
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
    const friends = await res.json();
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
  container.innerHTML = friends.map((friend, i) => `
    <a href="${friend.url}" target="_blank" rel="noopener" class="friend-card" style="--delay:${i * 0.1}s" title="${friend.description || friend.name}">
      <div class="friend-avatar">
        ${friend.avatar
          ? `<img src="${friend.avatar}" alt="${friend.name}" loading="lazy">`
          : `<div class="friend-avatar-placeholder">${friend.name.charAt(0)}</div>`
        }
      </div>
      <div class="friend-info">
        <span class="friend-name">${friend.name}</span>
        ${friend.description ? `<span class="friend-desc">${friend.description}</span>` : ''}
      </div>
      <span class="friend-arrow">→</span>
    </a>
  `).join('');
}

// ============================================================
//  Helpers
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

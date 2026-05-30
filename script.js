/**
 * ParticleSystem — Interactive particle field for the hero section canvas.
 * Renders particles with connections and mouse interaction forces.
 */
class ParticleSystem {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to render on
   * @param {Object} config - Configuration object for the particle system
   */
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -9999, y: -9999 };
    this.animationId = null;
    this.isRunning = false;

    // Performance monitoring properties
    this.lastFrameTime = 0;
    this.lowFpsFrames = 0;
    this.goodFpsFrames = 0;
    this.qualityReduced = false;
    this.connectionsDisabled = false;
  }

  /**
   * Initialize the particle system.
   * Sets canvas dimensions, checks for Canvas 2D support,
   * and creates the initial particle array.
   */
  init() {
    // Canvas 2D API fallback: hide canvas and show gradient background if unsupported
    if (!this.ctx) {
      this.canvas.style.display = 'none';
      const heroSection = this.canvas.closest('section') || this.canvas.parentElement;
      if (heroSection) {
        heroSection.classList.add('no-canvas');
      }
      return;
    }

    // Set canvas dimensions to full viewport
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Determine particle count based on viewport width (60 on mobile, 120 on desktop)
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 60 : this.config.particleCount;

    // Create particles
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle());
    }

    this.isRunning = true;

    // Set up mouse event listeners for interaction
    this._setupMouseListeners();
  }

  /**
   * Create a single particle with random position, velocity, and size.
   * @returns {{ x: number, y: number, vx: number, vy: number, size: number, opacity: number, color: string }}
   */
  createParticle() {
    const { maxSpeed, colors } = this.config;

    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() * 2 - 1) * maxSpeed,
      vy: (Math.random() * 2 - 1) * maxSpeed,
      size: Math.random() * 2 + 1, // 1 to 3
      opacity: Math.random() * 0.5 + 0.5,
      color: colors.particle
    };
  }

  /**
   * Update the tracked mouse position for particle interaction.
   * @param {number} x - Mouse X coordinate relative to canvas
   * @param {number} y - Mouse Y coordinate relative to canvas
   */
  updateMousePosition(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  /**
   * Set up mouse event listeners on the canvas for particle interaction.
   * Tracks mouse position on mousemove and resets on mouseleave.
   * @private
   */
  _setupMouseListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.updateMousePosition(e.clientX - rect.left, e.clientY - rect.top);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.x = -9999;
      this.mouse.y = -9999;
    });
  }

  /**
   * Handle viewport resize: update canvas dimensions and adjust particle count.
   * On mobile (<768px) targets 60 particles, on desktop uses config.particleCount.
   * @param {number} width - New canvas width
   * @param {number} height - New canvas height
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;

    // Adjust particle count based on viewport width
    const isMobile = width < 768;
    const targetCount = isMobile ? 60 : this.config.particleCount;

    // Add or remove particles to match target count
    while (this.particles.length < targetCount) {
      this.particles.push(this.createParticle());
    }
    while (this.particles.length > targetCount) {
      this.particles.pop();
    }
  }

  /**
   * Main animation loop. Updates particle positions, applies mouse interaction,
   * boundary wrapping, velocity damping, speed clamping, and renders particles each frame.
   */
  animate() {
    if (!this.isRunning) return;

    // FPS monitoring and adaptive quality
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      const fps = 1000 / frameTime;

      if (fps < 30) {
        this.lowFpsFrames++;
        this.goodFpsFrames = 0;

        if (this.lowFpsFrames >= 60 && !this.qualityReduced) {
          // Reduce particles by 50%
          const removeCount = Math.floor(this.particles.length / 2);
          this.particles.splice(this.particles.length - removeCount, removeCount);
          this.qualityReduced = true;
          this.lowFpsFrames = 0;
        } else if (this.lowFpsFrames >= 60 && this.qualityReduced && !this.connectionsDisabled) {
          // Disable connections
          this.connectionsDisabled = true;
          this.lowFpsFrames = 0;
        }
      } else {
        this.goodFpsFrames++;
        this.lowFpsFrames = 0;

        if (this.goodFpsFrames >= 120) {
          if (this.connectionsDisabled) {
            this.connectionsDisabled = false;
            this.goodFpsFrames = 0;
          } else if (this.qualityReduced) {
            // Restore particle count
            const isMobile = this.canvas.width < 768;
            const targetCount = isMobile ? 60 : this.config.particleCount;
            while (this.particles.length < targetCount) {
              this.particles.push(this.createParticle());
            }
            this.qualityReduced = false;
            this.goodFpsFrames = 0;
          }
        }
      }
    }
    this.lastFrameTime = now;

    const { ctx, canvas, particles, config } = this;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update each particle
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update position by adding velocity
      p.x += p.vx;
      p.y += p.vy;

      // Toroidal wrapping: particles exiting one edge appear on opposite edge
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      // Mouse interaction force (after position update, before damping)
      if (this.mouse.x !== -9999) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < config.mouseRadius && dist > 0) {
          // Linear falloff: closer = stronger
          const force = (config.mouseRadius - dist) / config.mouseRadius;
          // Limit force to mouseForce
          const limitedForce = Math.min(force * config.mouseForce, config.mouseForce);
          // Apply force in direction away from mouse
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * limitedForce;
          p.vy += Math.sin(angle) * limitedForce;
        }
      }

      // Velocity damping (0.98 per frame)
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Speed limit enforcement
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > config.maxSpeed) {
        p.vx = (p.vx / speed) * config.maxSpeed;
        p.vy = (p.vy / speed) * config.maxSpeed;
      }
    }

    // Draw connections between nearby particles (if not disabled for performance)
    if (!this.connectionsDisabled) {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.connectionDistance) {
            const opacity = (1 - dist / config.connectionDistance) * 0.4;
            ctx.strokeStyle = `rgba(124, 58, 237, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // Schedule next frame
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Destroy the particle system and cancel the animation loop.
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isRunning = false;
  }
}


/**
 * Mobile menu functionality for the NavigationController.
 * Creates a mobile navigation overlay, toggles it via the hamburger button,
 * and closes it with smooth-scroll on link click.
 */
(function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (!hamburger || !navLinks) return;

  // Create mobile nav overlay dynamically (mirrors nav-links)
  const mobileNav = document.createElement('nav');
  mobileNav.classList.add('mobile-nav');
  mobileNav.setAttribute('aria-label', 'Menu mobilne');

  // Clone navigation links into mobile nav
  const links = navLinks.querySelectorAll('a');
  links.forEach(link => {
    const mobileLink = document.createElement('a');
    mobileLink.href = link.getAttribute('href');
    mobileLink.textContent = link.textContent;
    mobileLink.classList.add('mobile-nav-link');
    mobileNav.appendChild(mobileLink);
  });

  document.body.appendChild(mobileNav);

  /**
   * Toggle the mobile navigation panel open/closed.
   * Adds 'active' class to hamburger and 'open' class to mobile-nav.
   * Updates aria-expanded for accessibility.
   */
  function toggleMobileMenu() {
    const isOpen = mobileNav.classList.contains('open');

    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  function openMobileMenu() {
    mobileNav.classList.add('open');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Zamknij menu nawigacji');
  }

  function closeMobileMenu() {
    mobileNav.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Otwórz menu nawigacji');
  }

  // Hamburger button click toggles the menu
  hamburger.addEventListener('click', toggleMobileMenu);

  // Close mobile menu and smooth-scroll on nav link click
  mobileNav.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    if (!link) return;

    e.preventDefault();
    closeMobileMenu();

    const targetId = link.getAttribute('href');
    const targetSection = document.querySelector(targetId);

    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
      closeMobileMenu();
      hamburger.focus();
    }
  });
})();


/**
 * NavigationController — Controls the cyberpunk-styled navigation bar
 * with scroll effects, active section highlighting, and smooth scrolling.
 */
class NavigationController {
  /**
   * @param {HTMLElement} navElement - The nav element with class 'nav-hud'
   */
  constructor(navElement) {
    this.nav = navElement;
    this.links = Array.from(navElement.querySelectorAll('.nav-links .nav-link'));
    this.sections = [];
    this.activeLink = null;
    this.observer = null;
    this.visibleSections = new Map(); // sectionId -> intersectionRatio
  }

  /**
   * Initialize scroll effects, IntersectionObserver, and click handlers.
   */
  init() {
    // Gather all sections referenced by nav links
    this.sections = this.links
      .map(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          return document.querySelector(href);
        }
        return null;
      })
      .filter(Boolean);

    this._setupScrollEffect();
    this._setupIntersectionObserver();
    this._setupClickHandlers();
  }

  /**
   * Add backdrop blur + neon border-glow when scrolled past hero section.
   */
  _setupScrollEffect() {
    const heroSection = document.getElementById('hero');

    const onScroll = () => {
      if (!heroSection) return;
      const heroHeight = heroSection.offsetHeight;
      if (window.scrollY > heroHeight) {
        this.nav.classList.add('scrolled');
      } else {
        this.nav.classList.remove('scrolled');
      }
    };

    // Use requestAnimationFrame throttling for scroll handler
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          onScroll();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Run once on init in case page is already scrolled
    onScroll();
  }

  /**
   * Track active section via IntersectionObserver (threshold 0.5).
   * Highlights nav link for section with ≥50% visibility;
   * falls back to closest-to-top section if none meets threshold.
   */
  _setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = entry.target.id;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            this.visibleSections.set(id, entry.intersectionRatio);
          } else {
            this.visibleSections.delete(id);
          }
        });

        this._updateActiveLink();
      },
      {
        threshold: [0, 0.5, 1.0]
      }
    );

    this.sections.forEach(section => {
      if (section) {
        this.observer.observe(section);
      }
    });
  }

  /**
   * Determine which nav link should be active and highlight it.
   */
  _updateActiveLink() {
    let targetId = null;

    if (this.visibleSections.size > 0) {
      // Pick the section with the highest intersection ratio
      let maxRatio = 0;
      this.visibleSections.forEach((ratio, id) => {
        if (ratio > maxRatio) {
          maxRatio = ratio;
          targetId = id;
        }
      });
    } else {
      // Fallback: find section closest to the top of the viewport
      targetId = this._getClosestToTopSection();
    }

    if (targetId) {
      this.setActiveSection(targetId);
    }
  }

  /**
   * Find the section whose top edge is closest to the viewport top.
   * @returns {string|null} The id of the closest section
   */
  _getClosestToTopSection() {
    let closestId = null;
    let closestDistance = Infinity;

    this.sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const distance = Math.abs(rect.top);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = section.id;
      }
    });

    return closestId;
  }

  /**
   * Highlight the nav link corresponding to the given section id.
   * @param {string} sectionId - The id of the active section
   */
  setActiveSection(sectionId) {
    this.links.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${sectionId}`) {
        link.classList.add('active');
        this.activeLink = link;
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * Set up smooth scroll to sections on nav link click.
   * Scroll duration targets 400-800ms range.
   */
  _setupClickHandlers() {
    this.links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return;

        const target = document.querySelector(href);
        if (!target) return;

        // Calculate scroll distance to determine duration (400-800ms)
        const start = window.scrollY;
        const end = target.getBoundingClientRect().top + window.scrollY;
        const distance = Math.abs(end - start);
        const maxDistance = document.documentElement.scrollHeight - window.innerHeight;
        // Scale duration between 400ms and 800ms based on distance
        const duration = Math.min(800, Math.max(400, (distance / maxDistance) * 800));

        this._smoothScrollTo(end, duration);
      });
    });
  }

  /**
   * Smooth scroll to a target Y position over a given duration.
   * @param {number} targetY - The target scroll position
   * @param {number} duration - Animation duration in ms (400-800)
   */
  _smoothScrollTo(targetY, duration) {
    const startY = window.scrollY;
    const diff = targetY - startY;
    const startTime = performance.now();

    const easeInOutCubic = (t) => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      window.scrollTo(0, startY + diff * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }
}


/**
 * CaseStudyManager — Manages game-level-style case study cards with
 * unlock animations, progress bars, and expandable content sections.
 *
 * Card State Machine:
 *   locked → unlocking → unlocked ↔ expanded
 *
 * Constraints:
 *   - Each card is in exactly one state at any time
 *   - Clicks during unlocking state are ignored
 *   - At most one card can be expanded at a time (accordion)
 */
class CaseStudyManager {
  /**
   * @param {HTMLElement} container - The container element holding all case study cards
   */
  constructor(container) {
    this.container = container;
    this.cards = [];
  }

  /**
   * Initialize all case study cards: query DOM, attach click and keyboard handlers.
   */
  initCards() {
    this.cards = Array.from(
      this.container.querySelectorAll('article.case-study-card')
    );

    this.cards.forEach((card) => {
      card.addEventListener('click', () => this.handleCardClick(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleCardClick(card);
        }
      });
    });
  }

  /**
   * Get the current state of a card based on its CSS classes.
   * @param {HTMLElement} card
   * @returns {'locked' | 'unlocking' | 'unlocked' | 'expanded'}
   */
  getCardState(card) {
    if (card.classList.contains('unlocking')) return 'unlocking';
    if (card.classList.contains('expanded')) return 'expanded';
    if (card.classList.contains('unlocked')) return 'unlocked';
    return 'locked';
  }

  /**
   * Handle a click (or Enter key) on a case study card.
   * Implements the state machine transitions and accordion constraint.
   * @param {HTMLElement} card
   */
  handleCardClick(card) {
    const state = this.getCardState(card);

    switch (state) {
      case 'locked':
        // locked → unlocking → unlocked (handled by unlockCard)
        this.unlockCard(card);
        break;

      case 'unlocking':
        // Ignore clicks during unlocking animation
        break;

      case 'unlocked':
        // unlocked → expanded (collapse any other expanded card first)
        this.collapseAllExcept(card);
        this.expandCard(card);
        break;

      case 'expanded':
        // expanded → unlocked
        this.collapseCard(card);
        break;
    }
  }

  /**
   * Collapse any currently expanded card except the specified one.
   * Enforces the accordion constraint: at most one card expanded at a time.
   * @param {HTMLElement} exceptCard - The card to exclude from collapsing
   */
  collapseAllExcept(exceptCard) {
    this.cards.forEach((card) => {
      if (card !== exceptCard && this.getCardState(card) === 'expanded') {
        this.collapseCard(card);
      }
    });
  }

  /**
   * Trigger the unlock animation sequence for a locked card.
   * Transitions: locked → unlocking → unlocked → expanded
   *
   * Animation sequence:
   *   1. Apply will-change: transform for GPU optimization
   *   2. Transition to unlocking state
   *   3. Animate progress bar 0% → 100% over 1200ms
   *   4. Flash effect on completion (300ms)
   *   5. Mark as unlocked + expanded, reveal content
   *   6. Remove will-change after animation completes
   *
   * @param {HTMLElement} card
   */
  async unlockCard(card) {
    const progressBar = card.querySelector('.progress-fill');
    const content = card.querySelector('.case-study-content');

    // Apply will-change before animation for GPU optimization
    card.style.willChange = 'transform';

    // Step 1: Transition to unlocking state
    card.classList.remove('locked');
    card.classList.add('unlocking');
    card.setAttribute('aria-expanded', 'false');

    // Step 2: Animate progress bar 0% → 100% over 1200ms
    await this.animateProgressBar(progressBar, 1200);

    // Step 3: Flash effect on completion (300ms)
    card.classList.add('flash');
    await new Promise(resolve => setTimeout(resolve, 300));
    card.classList.remove('flash');

    // Step 4: Mark as unlocked and expanded
    card.classList.remove('unlocking');
    card.classList.add('unlocked', 'expanded');
    card.setAttribute('aria-expanded', 'true');

    // Collapse any other expanded card (accordion constraint)
    this.collapseAllExcept(card);

    // Step 5: Reveal content with max-height transition
    if (content) {
      content.style.maxHeight = content.scrollHeight + 'px';
    }

    // Remove will-change after animation completes
    card.style.willChange = '';
  }

  /**
   * Animate a progress bar element from 0% to 100% width over the given duration.
   * Uses CSS transition with cubic-bezier easing for smooth fill.
   *
   * @param {HTMLElement} element - The progress bar fill element
   * @param {number} duration - Animation duration in milliseconds
   * @returns {Promise<void>} Resolves when the animation completes
   */
  animateProgressBar(element, duration) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }

      element.style.transition = `width ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      // Force reflow to ensure transition starts from current width (0%)
      element.offsetWidth;
      element.style.width = '100%';
      setTimeout(resolve, duration);
    });
  }

  /**
   * Expand a card to reveal its content section.
   * Adds 'expanded' class, sets aria-expanded="true", and sets content max-height.
   * @param {HTMLElement} card
   */
  expandCard(card) {
    const content = card.querySelector('.case-study-content');

    card.classList.add('expanded');
    card.setAttribute('aria-expanded', 'true');

    if (content) {
      const targetHeight = content.scrollHeight;
      content.style.maxHeight = targetHeight + 'px';
    }
  }

  /**
   * Collapse a card to hide its content section.
   * Removes 'expanded' class, sets aria-expanded="false", and sets content max-height to 0.
   * @param {HTMLElement} card
   */
  collapseCard(card) {
    const content = card.querySelector('.case-study-content');

    card.classList.remove('expanded');
    card.setAttribute('aria-expanded', 'false');

    if (content) {
      content.style.maxHeight = '0';
    }
  }
}


/**
 * ScrollAnimator — Handles scroll-triggered entrance animations using IntersectionObserver.
 * Observes elements with [data-animate] attribute and applies animation classes
 * when they enter the viewport. Supports staggered delays for grid items.
 */
class ScrollAnimator {
  /**
   * @param {Object} [options] - Configuration options
   * @param {number} [options.threshold=0.15] - IntersectionObserver visibility threshold
   */
  constructor(options = {}) {
    this.threshold = options.threshold !== undefined ? options.threshold : 0.15;
    this.observer = null;
    this.rafId = null;
    this.pendingEntries = [];
    this.isProcessing = false;
  }

  /**
   * Start observing elements for scroll-triggered animations.
   * Sets elements to invisible pre-animation state and begins observation.
   * Falls back to showing all elements immediately if IntersectionObserver is not supported.
   * @param {NodeList|Array} elements - Elements to observe
   */
  observe(elements) {
    if (!elements || elements.length === 0) return;

    // Convert NodeList to array for consistent handling
    const elementArray = Array.from(elements);

    // Fallback: show all elements immediately if IntersectionObserver not supported
    if (!('IntersectionObserver' in window)) {
      document.body.classList.add('no-observer');
      return;
    }

    // Set all elements to invisible pre-animation state
    elementArray.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
    });

    // Create IntersectionObserver
    this.observer = new IntersectionObserver(
      (entries) => this._handleIntersection(entries),
      { threshold: this.threshold }
    );

    // Observe each element
    elementArray.forEach(el => this.observer.observe(el));
  }

  /**
   * Handle intersection entries with requestAnimationFrame throttling.
   * Groups simultaneously entering elements and applies stagger delays.
   * @param {IntersectionObserverEntry[]} entries - Intersection entries
   * @private
   */
  _handleIntersection(entries) {
    // Collect intersecting entries
    const intersecting = entries.filter(entry => entry.isIntersecting);
    if (intersecting.length === 0) return;

    // Throttle with requestAnimationFrame
    this.pendingEntries.push(...intersecting);

    if (!this.isProcessing) {
      this.isProcessing = true;
      this.rafId = requestAnimationFrame(() => {
        this._processPendingEntries();
        this.isProcessing = false;
      });
    }
  }

  /**
   * Process pending intersection entries, applying animation classes
   * and stagger delays for grid items entering simultaneously.
   * @private
   */
  _processPendingEntries() {
    const entries = this.pendingEntries.splice(0);
    if (entries.length === 0) return;

    // Apply stagger classes for multiple items entering simultaneously
    entries.forEach((entry, index) => {
      const el = entry.target;

      // Apply stagger class if multiple items enter at once
      if (entries.length > 1) {
        el.classList.add(`stagger-${index + 1}`);
      }

      // Remove inline pre-animation styles and apply animated class
      el.style.opacity = '';
      el.style.transform = '';
      el.classList.add('animated');

      // Unobserve — animation triggers only once
      this.observer.unobserve(el);
    });
  }

  /**
   * Clean up observer and cancel pending animation frames.
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingEntries = [];
  }
}


// ============================================================
// Main Initialization — Wire all components together on page load
// ============================================================

/** Particle system configuration */
const particleConfig = {
  particleCount: 120,
  maxSpeed: 1.5,
  connectionDistance: 150,
  mouseRadius: 200,
  mouseForce: 0.08,
  colors: {
    particle: '#7c3aed',
    connection: 'rgba(59, 130, 246, 0.3)',
    glow: '#06b6d4'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Particle System
  const heroCanvas = document.getElementById('hero-particles');
  if (heroCanvas) {
    heroCanvas.width = window.innerWidth;
    heroCanvas.height = window.innerHeight;
    const particles = new ParticleSystem(heroCanvas, particleConfig);
    particles.init();
    particles.animate();

    // Debounced resize handler (150ms)
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        particles.resize(window.innerWidth, window.innerHeight);
      }, 150);
    });
  }

  // 2. Case Studies
  const casesContainer = document.querySelector('.case-studies-grid');
  if (casesContainer) {
    const caseManager = new CaseStudyManager(casesContainer);
    caseManager.initCards();
  }

  // 3. Navigation
  const nav = document.querySelector('.nav-hud');
  if (nav) {
    const navController = new NavigationController(nav);
    navController.init();
  }

  // 4. Scroll Animations
  const animateElements = document.querySelectorAll('[data-animate]');
  if (animateElements.length > 0) {
    const animator = new ScrollAnimator({ threshold: 0.15 });
    animator.observe(animateElements);
  }

  // 5. Image error handling — placeholder with gradient + project title overlay
  document.querySelectorAll('.case-study-card img').forEach(img => {
    img.addEventListener('error', function() {
      const card = this.closest('.case-study-card');
      const title = card ? card.querySelector('.card-title')?.textContent : 'Projekt';

      // Replace img with placeholder
      const placeholder = document.createElement('div');
      placeholder.className = 'img-placeholder';
      placeholder.setAttribute('role', 'img');
      placeholder.setAttribute('aria-label', title);
      placeholder.innerHTML = `<span class="img-placeholder-text">${title}</span>`;
      this.parentNode.replaceChild(placeholder, this);
    });
  });

  // 6. Video error handling — poster image with "Trailer niedostępny" overlay
  document.querySelectorAll('.video-trailer video').forEach(video => {
    video.addEventListener('error', function() {
      const poster = this.getAttribute('poster');
      const container = this.closest('.video-trailer');
      if (!container) return;

      // Replace video with fallback
      const fallback = document.createElement('div');
      fallback.className = 'video-fallback';
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', 'Trailer niedostępny');
      if (poster) {
        fallback.style.backgroundImage = `url(${poster})`;
        fallback.style.backgroundSize = 'cover';
        fallback.style.backgroundPosition = 'center';
      }
      fallback.innerHTML = '<span class="video-fallback-text">Trailer niedostępny</span>';
      container.innerHTML = '';
      container.appendChild(fallback);
    });

    // Also handle source errors (source element fires error, not the video)
    const source = video.querySelector('source');
    if (source) {
      source.addEventListener('error', function() {
        video.dispatchEvent(new Event('error'));
      });
    }
  });
});

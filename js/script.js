// ============================================
// GAME STATE MANAGER
// ============================================
class GameState {
  constructor() {
    this.isPlaying = false;
    this.score = { perfect: 0, ok: 0, miss: 0 };
    this.chartData = null;
    this.startTime = 0;
  }

  reset() {
    this.score = { perfect: 0, ok: 0, miss: 0 };
  }

  addJudgment(type) {
    this.score[type]++;
  }
}

// ============================================
// AUDIO MANAGER
// ============================================
class AudioManager {
  constructor() {
    this.audio = document.getElementById('break');
    this.ctx = null;
    this.track = null;
    this.audio.volume = 0.1;
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.track = this.ctx.createMediaElementSource(this.audio);
    this.track.connect(this.ctx.destination);
  }

  play() {
    this.ctx.resume();
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  get currentTime() {
    return this.audio.currentTime;
  }

  set currentTime(time) {
    this.audio.currentTime = time;
  }
}

// ============================================
// NOTE MANAGER
// ============================================
class NoteManager {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.activeNotes = [];
    this.judgmentWindows = {
      perfect: 0.15,
      ok: 0.22
    };
  }

  spawn(laneId, duration, targetTime) {
    const lane = document.getElementById(laneId);
    if (!lane) return null;

    const element = document.createElement('div');
    element.className = 'note';
    element.style.animationDuration = `${duration}s`;

    const note = {
      laneId,
      targetTime,
      element,
      judged: false,
      id: Date.now() + Math.random()
    };

    this.activeNotes.push(note);
    lane.appendChild(element);

    element.addEventListener('animationend', () => {
      if (!note.judged) {
        this.judge(note, 'miss');
      }
      this.remove(note);
    });

    return note;
  }

  judge(note, judgment) {
    if (note.judged) return;
    note.judged = true;

    // Visual feedback
    note.element.style.opacity = '0';
    note.element.style.transform = 'scale(0.8)';

    // Show judgment popup
    this.showJudgment(judgment, note.element);

    game.state.addJudgment(judgment);
  }

  showJudgment(type, noteElement) {
    const popup = document.createElement('div');
    popup.className = 'judgment-popup';
    popup.textContent = type.toLowerCase();

    const colors = {
      perfect: '#5cffb1',
      ok: '#ffd45c',
      miss: '#ff5c5c'
    };
    popup.style.color = colors[type];

    // Position at hit line center
    const rect = noteElement.getBoundingClientRect();
    const hitRect = document.getElementById('hit').getBoundingClientRect();
    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${hitRect.top + hitRect.height / 2}px`;

    document.body.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('show'));
    setTimeout(() => popup.remove(), 600);
  }

  checkHit(laneId) {
    const now = this.audioManager.currentTime;
    
    const note = this.activeNotes.find(
      n => n.laneId === laneId &&
           !n.judged &&
           Math.abs(n.targetTime - now) < this.judgmentWindows.ok
    );

    if (!note) return false;

    const diff = Math.abs(note.targetTime - now);
    const judgment = diff <= this.judgmentWindows.perfect ? 'perfect' : 'ok';
    
    this.judge(note, judgment);
    this.remove(note);
    return true;
  }

  remove(note) {
    note.element.remove();
    this.activeNotes = this.activeNotes.filter(n => n.id !== note.id);
  }

  pauseAnimations() {
    this.activeNotes.forEach(n => {
      if (n.element.parentNode) {
        n.element.style.animationPlayState = 'paused';
      }
    });
  }

  resumeAnimations() {
    this.activeNotes.forEach(n => {
      if (n.element.parentNode) {
        n.element.style.animationPlayState = 'running';
      }
    });
  }

  clear() {
    this.activeNotes.forEach(n => n.element.remove());
    this.activeNotes = [];
  }
}

// ============================================
// CHART SCHEDULER (Fixed Timing)
// ============================================
class ChartScheduler {
  constructor(audioManager, noteManager) {
    this.audioManager = audioManager;
    this.noteManager = noteManager;
    this.chart = null;
    this.lookahead = 0.1; // Check 100ms ahead
    this.scheduleInterval = 50; // Check every 50ms
    this.intervalId = null;
    this.scheduledNotes = new Set();
  }

  load(chartData) {
    this.chart = chartData;
    this.scheduledNotes.clear();
  }

  start() {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.scheduleInterval);
  }

  tick() {
    if (!this.chart) return;

    const currentTime = this.audioManager.currentTime;
    const spawnWindow = currentTime + this.lookahead;
    const speed = this.chart.noteSpeed || 2.0;

    this.chart.notes.forEach((note, index) => {
      // Skip already scheduled notes
      if (this.scheduledNotes.has(index)) return;

      const spawnTime = note.time - speed;

      // Schedule if within lookahead window
      if (spawnTime <= spawnWindow && spawnTime >= currentTime - 0.05) {
        this.noteManager.spawn(note.lane, speed, note.time);
        this.scheduledNotes.add(index);
      }
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset() {
    this.stop();
    this.scheduledNotes.clear();
  }
}

// ============================================
// INPUT HANDLER
// ============================================
class InputHandler {
  constructor(noteManager) {
    this.noteManager = noteManager;
    this.keyMap = {
      KeyZ: 'll',
      KeyC: 'lm',
      ArrowLeft: 'rm',
      ArrowRight: 'rr'
    };
    this.activeKeys = new Set();
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  onKeyDown(e) {
    if (e.repeat) return;

    // Space handled by game controller
    if (e.code === 'Space') {
      game.togglePlayPause();
      return;
    }

    if (!game.state.isPlaying) return;

    const laneId = this.keyMap[e.code];
    if (!laneId || this.activeKeys.has(e.code)) return;

    this.activeKeys.add(e.code);
    this.activateLane(laneId);
    this.noteManager.checkHit(laneId);
  }

  onKeyUp(e) {
    const laneId = this.keyMap[e.code];
    if (!laneId) return;

    this.activeKeys.delete(e.code);
    this.deactivateLane(laneId);
  }

  activateLane(laneId) {
    document.getElementById(laneId)?.classList.add('active');
  }

  deactivateLane(laneId) {
    document.getElementById(laneId)?.classList.remove('active');
  }
}

// ============================================
// GAME CONTROLLER
// ============================================
class Game {
  constructor() {
    this.state = new GameState();
    this.audio = new AudioManager();
    this.notes = new NoteManager(this.audio);
    this.scheduler = new ChartScheduler(this.audio, this.notes);
    this.input = new InputHandler(this.notes);
  }

  async init() {
    await this.audio.init();
    const chart = await this.loadChart('./techniques/1_break/1_break.json');
    this.scheduler.load(chart);
    console.log(`Loaded: ${chart.title} - ${chart.artist}`);
  }

  async loadChart(path) {
    const res = await fetch(path);
    const data = await res.json();
    this.audio.audio.src = data.audio;
    this.state.chartData = data;
    return data;
  }

  togglePlayPause() {
    if (!this.state.chartData) return;

    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.audio.play();
    this.notes.resumeAnimations();
    this.scheduler.start();
    this.state.isPlaying = true;
  }

  pause() {
    this.audio.pause();
    this.notes.pauseAnimations();
    this.scheduler.stop();
    this.state.isPlaying = false;
  }

  reset() {
    this.pause();
    this.audio.currentTime = 0;
    this.notes.clear();
    this.scheduler.reset();
    this.state.reset();
  }
}

// ============================================
// INITIALIZE GAME
// ============================================
const game = new Game();
game.init().catch(err => console.error('Init failed:', err));

// Expose for debugging
window.game = game;
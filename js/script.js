// --- audio setup ---
const song = document.getElementById("break");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const track = audioCtx.createMediaElementSource(song);
track.connect(audioCtx.destination);
let isPlaying = false;

// --- key bindings ---
const keyMap = {
  KeyZ: "ll",
  KeyC: "lm",
  ArrowLeft: "rm",
  ArrowRight: "rr",
};

// --- test chart (seconds + lane id) ---
const notes = [
  { time: 1.0, lane: "ll" },
  { time: 1.5, lane: "lm" },
  { time: 2.0, lane: "rm" },
  { time: 2.5, lane: "rr" },
  { time: 3.0, lane: "ll" },
  { time: 3.5, lane: "lm" },
];

// --- spawn function ---
function spawnNote(laneId) {
  const lane = document.getElementById(laneId);
  const note = document.createElement("div");
  note.className = "note";

  // randomize speed or keep constant
  note.style.animationDuration = "1s";

  lane.appendChild(note);

  // remove note when animation ends
  note.addEventListener("animationend", () => note.remove());
}

// --- timing loop ---
function scheduleNotes() {
  const start = audioCtx.currentTime;
  notes.forEach((n) => {
    const delay = n.time - (song.currentTime || 0);
    if (delay >= 0) {
      setTimeout(() => spawnNote(n.lane), delay * 1000);
    }
  });
}

// --- input handling ---
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;

  if (e.code === "Space") {
    if (!isPlaying) {
      audioCtx.resume();
      song.play();
      scheduleNotes();
      isPlaying = true;
      console.log("Playing song...");
    } else {
      song.pause();
      isPlaying = false;
      console.log("Paused song...");
    }
    return;
  }

  const laneId = keyMap[e.code];
  if (laneId) {
    const lane = document.getElementById(laneId);
    if (lane) lane.classList.add("active");
  }
});

document.addEventListener("keyup", (e) => {
  const laneId = keyMap[e.code];
  if (laneId) {
    const lane = document.getElementById(laneId);
    if (lane) lane.classList.remove("active");
  }
});

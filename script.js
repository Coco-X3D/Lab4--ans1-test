const gameArea = document.getElementById('gameArea');
const catcher = document.getElementById('catcher');
const scoreValue = document.getElementById('scoreValue');
const comboValue = document.getElementById('comboValue');
const lifeValue = document.getElementById('lifeValue');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartButton = document.getElementById('restartButton');
const difficultySelect = document.getElementById('difficultySelect');
const videoElement = document.getElementById('webcamVideo');
const cameraStatus = document.getElementById('cameraStatus');

const healthyFoods = ['🍎', '🥦', '🥕', '🍌', '🍏', '🍉'];
const junkFoods = ['🍕', '🍟', '🍩', '🥤'];
const fallingFoods = [];
const difficultySettings = {
  easy: 0.8,
  medium: 1,
  hard: 1.35,
};

let wristXNormalized = 0.5;
let catcherX = gameArea.clientWidth / 2 - 75;
let lastSpawnTime = 0;
let score = 0;
let healthyCombo = 0;
let life = 3;
let isGameOver = false;
let animationId = null;
let speedMultiplier = 1;
let nextSpeedMilestone = 100;
let difficultyMultiplier = difficultySettings[difficultySelect.value];
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playHealthySound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(400, now);
  oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.16);
}

function playJunkSound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(150, now);
  oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.2);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
}

function updateScoreDisplay() {
  scoreValue.textContent = String(score);
}

function updateLifeDisplay() {
  lifeValue.textContent = String(life);
}

function updateComboDisplay() {
  comboValue.textContent = `Combo ${healthyCombo}`;
}

function updateFallingSpeed() {
  while (score >= nextSpeedMilestone) {
    speedMultiplier *= 1.15;
    nextSpeedMilestone += 100;
  }
}

function updateCatcherPosition() {
  const maxLeft = gameArea.clientWidth - catcher.offsetWidth;
  catcherX = Math.min(Math.max(catcherX, 0), maxLeft);
  catcher.style.left = `${catcherX}px`;
}

function updateCatcherFromHand() {
  const maxLeft = gameArea.clientWidth - catcher.offsetWidth;
  catcherX = wristXNormalized * gameArea.clientWidth - catcher.offsetWidth / 2;
  catcherX = Math.min(Math.max(catcherX, 0), maxLeft);
  catcher.style.left = `${catcherX}px`;
}

function clearFallingFoods() {
  fallingFoods.forEach((food) => food.element.remove());
  fallingFoods.length = 0;
}

function endGame() {
  isGameOver = true;
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  gameOverOverlay.classList.add('show');
}

function resetGame() {
  score = 0;
  healthyCombo = 0;
  life = 3;
  isGameOver = false;
  lastSpawnTime = 0;
  speedMultiplier = 1;
  nextSpeedMilestone = 100;
  clearFallingFoods();
  updateScoreDisplay();
  updateComboDisplay();
  updateLifeDisplay();
  gameOverOverlay.classList.remove('show');
  updateCatcherPosition();
  animationId = requestAnimationFrame(gameLoop);
}

function createFoodItem(emoji, type) {
  const item = document.createElement('div');
  item.className = 'food-item';
  item.textContent = emoji;
  item.style.left = `${Math.random() * (gameArea.clientWidth - 36)}px`;
  item.style.top = '-40px';
  gameArea.appendChild(item);

  return {
    element: item,
    y: -40,
    baseSpeed: 1.4 + Math.random() * 1.6,
    type,
  };
}

function spawnFood() {
  const isHealthy = Math.random() < 0.65;
  const pool = isHealthy ? healthyFoods : junkFoods;
  const emoji = pool[Math.floor(Math.random() * pool.length)];
  fallingFoods.push(createFoodItem(emoji, isHealthy ? 'healthy' : 'junk'));
}

function updateFoods() {
  for (let i = fallingFoods.length - 1; i >= 0; i--) {
    const food = fallingFoods[i];
    food.y += food.baseSpeed * difficultyMultiplier * speedMultiplier;
    food.element.style.top = `${food.y}px`;

    const catcherRect = catcher.getBoundingClientRect();
    const foodRect = food.element.getBoundingClientRect();
    const caught =
      foodRect.left < catcherRect.right - 10 &&
      foodRect.right > catcherRect.left + 10 &&
      foodRect.bottom >= catcherRect.top + 10 &&
      foodRect.top <= catcherRect.bottom - 10;

    if (caught) {
      if (food.type === 'healthy') {
        playHealthySound();
        healthyCombo += 1;
        score += healthyCombo >= 3 ? 20 : 10;
      } else {
        playJunkSound();
        healthyCombo = 0;
        score -= 20;
        life -= 1;
        updateLifeDisplay();
        if (life <= 0) {
          endGame();
          return;
        }
      }
      updateFallingSpeed();
      updateScoreDisplay();
      updateComboDisplay();
      food.element.remove();
      fallingFoods.splice(i, 1);
      continue;
    }

    if (food.y > gameArea.clientHeight + 24) {
      food.element.remove();
      fallingFoods.splice(i, 1);
    }
  }
}

function gameLoop(timestamp) {
  if (isGameOver) {
    return;
  }

  if (timestamp - lastSpawnTime > 850) {
    spawnFood();
    lastSpawnTime = timestamp;
  }

  updateFoods();
  animationId = requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', () => {
  catcherX = Math.min(catcherX, gameArea.clientWidth - catcher.offsetWidth);
  updateCatcherPosition();
});

difficultySelect.addEventListener('change', () => {
  difficultyMultiplier = difficultySettings[difficultySelect.value];
});

async function initHandTracking() {
  if (!window.FilesetResolver || !window.HandLandmarker) {
    cameraStatus.textContent = 'Hand tracking library could not load.';
    return;
  }

  try {
    cameraStatus.textContent = 'Requesting camera access...';
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoElement.srcObject = stream;
    await videoElement.play();

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
    );
    const handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    cameraStatus.textContent = 'Camera ready. Show your hand to move the basket.';

    function processVideoFrame() {
      if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !isGameOver) {
        const results = handLandmarker.detectForVideo(videoElement, performance.now());
        if (results.landmarks && results.landmarks.length > 0) {
          const wrist = results.landmarks[0][0];
          wristXNormalized = 1 - wrist.x;
          updateCatcherFromHand();
        }
      }
      requestAnimationFrame(processVideoFrame);
    }

    processVideoFrame();
  } catch (error) {
    cameraStatus.textContent = 'Camera or CPU hand tracking is unavailable.';
    console.error('Hand tracking initialization failed:', error);
  }
}

restartButton.addEventListener('click', resetGame);
window.addEventListener('pointerdown', getAudioContext, { passive: true });
window.addEventListener('keydown', getAudioContext, { passive: true });

updateScoreDisplay();
updateComboDisplay();
updateLifeDisplay();
updateCatcherPosition();
animationId = requestAnimationFrame(gameLoop);
initHandTracking();

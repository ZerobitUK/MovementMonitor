// --- Element References ---
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const loadingDiv = document.getElementById('loading');
const mainContent = document.getElementById('main-content');
const startBtn = document.getElementById('start-btn');
const timerDisplay = document.getElementById('timer');
const minDurationInput = document.getElementById('min-duration');
const maxDurationInput = document.getElementById('max-duration');
const statusMessage = document.getElementById('status-message');
const sessionLog = document.getElementById('session-log');
const clearLogBtn = document.getElementById('clear-log-btn');

// --- State Variables ---
let detector;
let timerInterval, praiseTimeout, attentionCheckTimeout, attentionCheckHandle;
let timeLeft, initialSessionDurationInMinutes;
let isTimerRunning = false, isAttentionCheckActive = false;
let failureCount = 0;
let attentionCheckTarget = { x: 0, y: 0, radius: 40 };
let maleVoice;

// --- Configuration ---
const POSITIVE_PHRASES = ["Well done boy.", "You're making me proud.", "Good boy.", "Keep it up."];
const NEGATIVE_PHRASES = ["Naughty boy.", "When will you learn?", "You need to learn to obey."];
const safeZone = { x: 0.25, y: 0.15, width: 0.5, height: 0.7 };

// ### LOGGING & SPEECH ###
function addToLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${timestamp}] ${message}`;
    sessionLog.appendChild(logEntry);
    sessionLog.scrollTop = sessionLog.scrollHeight; // Auto-scroll
}

function setupSpeech() {
    const voices = window.speechSynthesis.getVoices();
    maleVoice = voices.find(v => v.name === 'Google UK English Male') || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'));
    if (!maleVoice) maleVoice = voices.find(v => v.lang.startsWith('en'));
}
window.speechSynthesis.onvoiceschanged = setupSpeech;
setupSpeech();

function speak(text) {
    if (!maleVoice) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = maleVoice;
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// ### CORE LOGIC ###
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function init() {
    try {
        const model = poseDetection.SupportedModels.MoveNet;
        detector = await poseDetection.createDetector(model, { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING });
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            loadingDiv.style.display = 'none';
            mainContent.style.display = 'block';
            detectPoseLoop();
        });
    } catch (error) {
        console.error("Init Error:", error);
        loadingDiv.innerText = "Error loading model or webcam.";
    }
}

async function detectPoseLoop() {
    const poses = await detector.estimatePoses(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const zx = safeZone.x * canvas.width;
    const zy = safeZone.y * canvas.height;
    const zw = safeZone.width * canvas.width;
    const zh = safeZone.height * canvas.height;

    let isInside = false;
    if (poses && poses.length > 0) {
        const nose = poses[0].keypoints.find(k => k.name === 'nose');
        if (nose && nose.score > 0.4) {
            const mirroredX = canvas.width - nose.x;
            if (isAttentionCheckActive) {
                const distance = Math.sqrt(Math.pow(mirroredX - attentionCheckTarget.x, 2) + Math.pow(nose.y - attentionCheckTarget.y, 2));
                if (distance < attentionCheckTarget.radius) {
                    handleAttentionCheckSuccess();
                }
            } else {
                 isInside = (mirroredX > zx && mirroredX < zx + zw && nose.y > zy && nose.y < zy + zh);
            }
        }
    }
    
    // Drawing
    if (isAttentionCheckActive) {
        ctx.beginPath();
        ctx.arc(attentionCheckTarget.x, attentionCheckTarget.y, attentionCheckTarget.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = 'red';
        ctx.stroke();
    } else {
        ctx.strokeStyle = isInside ? 'limegreen' : 'red';
        ctx.lineWidth = 5;
        ctx.strokeRect(zx, zy, zw, zh);
    }
    
    // Penalize if timer is running and user is out of bounds (and not in a check)
    if (isTimerRunning && !isInside && !isAttentionCheckActive) {
        penalizeUser("Moved out of the safe zone.");
    }
    
    requestAnimationFrame(detectPoseLoop);
}

// ### TIMER AND EVENT FUNCTIONS ###
function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = formatTime(timeLeft);
        if (timeLeft <= 0) {
            // ... completion logic ...
            clearInterval(timerInterval);
            clearTimeout(praiseTimeout);
            clearTimeout(attentionCheckHandle);
            isTimerRunning = false;
            const msg = `Session complete. You served ${initialSessionDurationInMinutes} ${initialSessionDurationInMinutes > 1 ? 'minutes' : 'minute'}.`;
            addToLog("SESSION COMPLETE.");
            alert(msg);
            speak(`${msg} Well done.`);
            startBtn.disabled = false;
            minDurationInput.disabled = false;
            maxDurationInput.disabled = false;
        }
    }, 1000);
    
    scheduleRandomPraise();
    scheduleRandomAttentionCheck();
}

function penalizeUser(reason) {
    if (!isTimerRunning) return;
    
    failureCount++;
    isTimerRunning = false;
    clearInterval(timerInterval);
    clearTimeout(praiseTimeout);
    clearTimeout(attentionCheckHandle);

    let minPenalty, maxPenalty;
    if (failureCount === 1) { minPenalty = 1; maxPenalty = 2; }
    else if (failureCount === 2) { minPenalty = 2; maxPenalty = 4; }
    else { minPenalty = 3; maxPenalty = 6; }
    
    const penaltyMinutes = Math.floor(Math.random() * (maxPenalty - minPenalty + 1)) + minPenalty;
    const penaltySeconds = penaltyMinutes * 60;
    const penaltyMsg = `${penaltyMinutes} more ${penaltyMinutes > 1 ? 'minutes' : 'minute'}`;
    
    speak(`${NEGATIVE_PHRASES[Math.floor(Math.random() * NEGATIVE_PHRASES.length)]} ${penaltyMsg}.`);
    addToLog(`PENALTY: +${penaltyMinutes} min. Reason: ${reason}`);
    statusMessage.textContent = `PENALTY! +${penaltyMinutes} min.`;
    
    timeLeft += penaltySeconds;
    timerDisplay.textContent = formatTime(timeLeft);
    
    setTimeout(() => { statusMessage.textContent = ''; startTimer(); }, 4000);
}

// --- ATTENTION CHECKS ---
function scheduleRandomAttentionCheck() {
    if (!isTimerRunning) return;
    const randomDelay = (Math.random() * 45000) + 45000; // Every 45-90 seconds
    attentionCheckHandle = setTimeout(startAttentionCheck, randomDelay);
}

function startAttentionCheck() {
    isTimerRunning = false; // Pause timer
    isAttentionCheckActive = true;
    clearInterval(timerInterval);
    clearTimeout(praiseTimeout);

    attentionCheckTarget.x = Math.random() * (canvas.width * 0.8) + (canvas.width * 0.1);
    attentionCheckTarget.y = Math.random() * (canvas.height * 0.8) + (canvas.height * 0.1);

    const msg = "Attention check. Move to the red circle.";
    speak(msg);
    addToLog("Attention check started.");
    statusMessage.textContent = "ATTENTION CHECK!";
    
    // Failsafe: if user doesn't comply in 15 seconds, penalize
    attentionCheckTimeout = setTimeout(() => {
        if (isAttentionCheckActive) {
            isAttentionCheckActive = false;
            penalizeUser("Failed attention check.");
        }
    }, 15000);
}

function handleAttentionCheckSuccess() {
    clearTimeout(attentionCheckTimeout);
    isAttentionCheckActive = false;
    speak("Good.");
    addToLog("Attention check passed.");
    statusMessage.textContent = "Check passed!";
    setTimeout(() => { statusMessage.textContent = '' }, 2000);
    startTimer();
}

// --- PRAISE ---
function scheduleRandomPraise() {
    // ... same as before
    if (!isTimerRunning) return;
    const randomDelay = (Math.random() * 20000) + 25000;
    praiseTimeout = setTimeout(() => {
        const phrase = POSITIVE_PHRASES[Math.floor(Math.random() * POSITIVE_PHRASES.length)];
        speak(phrase);
        addToLog(`Praise: "${phrase}"`);
        scheduleRandomPraise();
    }, randomDelay);
}

// ### EVENT LISTENERS ###
startBtn.addEventListener('click', () => {
    // ... Grace period logic is the same ...
    startBtn.disabled = true;
    minDurationInput.disabled = true;
    maxDurationInput.disabled = true;

    failureCount = 0; // Reset failures for new session
    sessionLog.innerHTML = ''; // Clear log on new start

    const min = parseInt(minDurationInput.value, 10);
    const max = parseInt(maxDurationInput.value, 10);
    const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
    initialSessionDurationInMinutes = randomMinutes;
    timeLeft = randomMinutes * 60;

    let graceSeconds = 10;
    statusMessage.textContent = `Get into position...`;
    timerDisplay.textContent = graceSeconds;
    speak("Get into position.");
    addToLog(`New session starting for ${randomMinutes} ${randomMinutes > 1 ? 'minutes' : 'minute'}.`);

    const graceInterval = setInterval(() => {
        graceSeconds--;
        timerDisplay.textContent = graceSeconds;
        if (graceSeconds <= 0) {
            clearInterval(graceInterval);
            statusMessage.textContent = `Time out started!`;
            setTimeout(() => { statusMessage.textContent = '' }, 2000);
            timerDisplay.textContent = formatTime(timeLeft);
            startTimer();
        }
    }, 1000);
});

clearLogBtn.addEventListener('click', () => {
    sessionLog.innerHTML = '';
});

init();

const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
document.getElementById('main-content').style.display = 'block';

const startBtn = document.getElementById('start-btn');
const timerDisplay = document.getElementById('timer');
const minDurationInput = document.getElementById('min-duration');
const maxDurationInput = document.getElementById('max-duration');
const statusMessage = document.getElementById('status-message');

let timerInterval;
let timeLeft; // This will now store total seconds
let initialSessionDurationInMinutes;
let isTimerRunning = false;
let animationFrameId;
let lastFrameData = null;
let praiseTimeout;

// --- CONFIGURATION ---
const MOTION_THRESHOLD = 3; // Lower this if it's too sensitive
const PENALTY_MINUTES_MIN = 1; // Minimum penalty in minutes
const PENALTY_MINUTES_MAX = 3; // Maximum penalty in minutes
const POSITIVE_PHRASES = ["Well done boy.", "You're making me proud.", "Good boy.", "Keep it up."];
const NEGATIVE_PHRASES = ["Naughty boy. More time added.", "When will you learn?", "You need to learn to obey. More time added."];
let maleVoice;
// --- END CONFIGURATION ---

// ### SPEECH SYNTHESIS SETUP ###
function setupSpeech() {
    const voices = window.speechSynthesis.getVoices();
    maleVoice = voices.find(voice => voice.name === 'Google UK English Male') ||
                voices.find(voice => voice.name === 'Daniel') ||
                voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('male'));
    if (!maleVoice) maleVoice = voices.find(voice => voice.lang.startsWith('en'));
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
// ### END SPEECH SECTION ###

// ### HELPER FUNCTION to format time ###
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            detectMotionLoop();
        });
    } catch (error) {
        statusMessage.innerText = "Error: Could not access webcam.";
    }
}

function detectMotionLoop() {
    const safeZone = { x: 0.25, y: 0.15, width: 0.5, height: 0.7 };
    const zx = Math.floor(safeZone.x * canvas.width);
    const zy = Math.floor(safeZone.y * canvas.height);
    const zw = Math.floor(safeZone.width * canvas.width);
    const zh = Math.floor(safeZone.height * canvas.height);
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrameData = ctx.getImageData(zx, zy, zw, zh).data;

    let motionDetected = false;
    if (lastFrameData) {
        let pixelDifference = 0;
        for (let i = 0; i < currentFrameData.length; i += 4) {
            const diff = Math.abs(currentFrameData[i] - lastFrameData[i]) + 
                         Math.abs(currentFrameData[i + 1] - lastFrameData[i + 1]) +
                         Math.abs(currentFrameData[i + 2] - lastFrameData[i + 2]);
            pixelDifference += diff;
        }
        const avgDifference = pixelDifference / (currentFrameData.length / 4);
        if (avgDifference > MOTION_THRESHOLD) {
            motionDetected = true;
        }
    }
    lastFrameData = currentFrameData;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = motionDetected ? 'limegreen' : 'red';
    ctx.lineWidth = 5;
    ctx.strokeRect(zx, zy, zw, zh);

    if (isTimerRunning && !motionDetected) {
        penalizeUser();
        flashScreenRed();
    }
    animationFrameId = requestAnimationFrame(detectMotionLoop);
}

function flashScreenRed() {
    document.body.style.backgroundColor = '#ffcccc';
    setTimeout(() => { document.body.style.backgroundColor = '#f0f2f5'; }, 500);
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true; // Motion detection penalties are now active

    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = formatTime(timeLeft);
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            clearTimeout(praiseTimeout);
            isTimerRunning = false;
            const completionMessage = `Session complete. You served a total of ${initialSessionDurationInMinutes} ${initialSessionDurationInMinutes > 1 ? 'minutes' : 'minute'}. Well done.`;
            alert(completionMessage);
            speak(completionMessage);
            startBtn.disabled = false;
            minDurationInput.disabled = false;
            maxDurationInput.disabled = false;
        }
    }, 1000);
    
    scheduleRandomPraise();
}

function penalizeUser() {
    if (!isTimerRunning) return;
    
    clearInterval(timerInterval);
    clearTimeout(praiseTimeout);
    isTimerRunning = false;

    const penaltyMinutes = Math.floor(Math.random() * (PENALTY_MINUTES_MAX - PENALTY_MINUTES_MIN + 1)) + PENALTY_MINUTES_MIN;
    const penaltySeconds = penaltyMinutes * 60;

    const randomNegativePhrase = NEGATIVE_PHRASES[Math.floor(Math.random() * NEGATIVE_PHRASES.length)];
    const penaltyMessage = `${penaltyMinutes} more ${penaltyMinutes > 1 ? 'minutes' : 'minute'} added.`;

    speak(`${randomNegativePhrase} ${penaltyMessage}`);
    statusMessage.textContent = `PENALTY! +${penaltyMinutes} min.`;
    setTimeout(() => { statusMessage.textContent = ''; }, 4000);
    
    timeLeft += penaltySeconds;
    timerDisplay.textContent = formatTime(timeLeft);

    setTimeout(() => { startTimer(); }, 1000);
}

function scheduleRandomPraise() {
    if (!isTimerRunning) return;
    const randomDelay = (Math.random() * 20000) + 25000;
    praiseTimeout = setTimeout(() => {
        const randomPositivePhrase = POSITIVE_PHRASES[Math.floor(Math.random() * POSITIVE_PHRASES.length)];
        speak(randomPositivePhrase);
        scheduleRandomPraise();
    }, randomDelay);
}

// ### MODIFIED SECTION ###
startBtn.addEventListener('click', () => {
    // Disable buttons immediately to prevent multiple clicks
    startBtn.disabled = true;
    minDurationInput.disabled = true;
    maxDurationInput.disabled = true;

    // Calculate the total session time in advance
    const min = parseInt(minDurationInput.value, 10);
    const max = parseInt(maxDurationInput.value, 10);
    if (min > max) {
        alert("Min time cannot be greater than max time.");
        startBtn.disabled = false;
        minDurationInput.disabled = false;
        maxDurationInput.disabled = false;
        return;
    }
    const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
    initialSessionDurationInMinutes = randomMinutes;
    timeLeft = randomMinutes * 60;

    // --- Start 10-second grace period ---
    let graceSeconds = 10;
    statusMessage.textContent = `Get into position...`;
    timerDisplay.textContent = graceSeconds; // Show the grace countdown
    speak("Get into position.");

    const graceInterval = setInterval(() => {
        graceSeconds--;
        timerDisplay.textContent = graceSeconds;
        if (graceSeconds <= 0) {
            clearInterval(graceInterval);
            statusMessage.textContent = `Time out started!`;
            setTimeout(() => { statusMessage.textContent = '' }, 2000);
            
            // Grace period is over, start the main timer
            timerDisplay.textContent = formatTime(timeLeft);
            startTimer();
        }
    }, 1000);
});

init();

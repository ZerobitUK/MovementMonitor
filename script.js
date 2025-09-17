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
let timeLeft;
let initialSessionDuration;
let isTimerRunning = false;
let animationFrameId;
let lastFrameData = null;
let praiseTimeout;

// --- CONFIGURATION ---
const MOTION_THRESHOLD = 5; // Adjust this based on your camera/lighting
const POSITIVE_PHRASES = ["Well done boy.", "You're making me proud.", "Good boy.", "Keep it up."];
const NEGATIVE_PHRASES = ["Naughty boy, more time added.", "When will you learn? More time added.", "You need to learn to obey."];
let maleVoice;
// --- END CONFIGURATION ---

// ### SPEECH SYNTHESIS SETUP ###
function setupSpeech() {
    const voices = window.speechSynthesis.getVoices();
    // Find a UK male voice, with fallbacks
    maleVoice = voices.find(voice => voice.name === 'Google UK English Male') ||
                voices.find(voice => voice.name === 'Daniel') ||
                voices.find(voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('male'));

    if (!maleVoice) {
        console.warn("No male voice found, using default.");
        maleVoice = voices.find(voice => voice.lang.startsWith('en')); // Fallback to any English voice
    }
}
// Voices are loaded asynchronously
window.speechSynthesis.onvoiceschanged = setupSpeech;
setupSpeech(); // Initial call

function speak(text) {
    if (!maleVoice) {
        console.error("Voice not ready.");
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = maleVoice;
    utterance.rate = 0.9;
    window.speechSynthesis.cancel(); // Stop any previous speech
    window.speechSynthesis.speak(utterance);
}
// ### END SPEECH SECTION ###


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
        console.error("Error initializing:", error);
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
    isTimerRunning = true;
    startBtn.disabled = true;
    minDurationInput.disabled = true;
    maxDurationInput.disabled = true;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            clearTimeout(praiseTimeout); // Stop any pending praise
            isTimerRunning = false;
            const completionMessage = `Session complete. You served a total of ${initialSessionDuration} seconds. Well done.`;
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
    clearTimeout(praiseTimeout); // Stop praise schedule
    isTimerRunning = false;

    const penaltyTime = Math.floor(Math.random() * 61) + 30; // Random penalty between 30-90 seconds
    const randomNegativePhrase = NEGATIVE_PHRASES[Math.floor(Math.random() * NEGATIVE_PHRASES.length)];
    
    speak(randomNegativePhrase);
    statusMessage.textContent = `PENALTY! +${penaltyTime} seconds.`;
    setTimeout(() => { statusMessage.textContent = ''; }, 4000);
    
    timeLeft += penaltyTime;
    timerDisplay.textContent = timeLeft;

    setTimeout(() => { startTimer(); }, 1000);
}

function scheduleRandomPraise() {
    if (!isTimerRunning) return;
    // Schedule praise for a random time between 25 and 45 seconds from now
    const randomDelay = (Math.random() * 20000) + 25000;
    praiseTimeout = setTimeout(() => {
        const randomPositivePhrase = POSITIVE_PHRASES[Math.floor(Math.random() * POSITIVE_PHRASES.length)];
        speak(randomPositivePhrase);
        scheduleRandomPraise(); // Schedule the next one
    }, randomDelay);
}

startBtn.addEventListener('click', () => {
    const min = parseInt(minDurationInput.value, 10);
    const max = parseInt(maxDurationInput.value, 10);
    if (min >= max) {
        alert("Min time must be less than max time.");
        return;
    }
    timeLeft = Math.floor(Math.random() * (max - min + 1)) + min;
    initialSessionDuration = timeLeft; // Store the starting time
    timerDisplay.textContent = timeLeft;
    startTimer();
});

init();

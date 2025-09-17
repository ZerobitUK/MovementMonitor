// --- CONFIGURATION ---
const MOVEMENT_THRESHOLD = 80000; 
const COOLDOWN_SECONDS = 8;       

// --- DOM ELEMENTS ---
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const toggleButton = document.getElementById('toggleButton');
const statusElement = document.getElementById('status');
const durationInput = document.getElementById('duration');
const timerElement = document.getElementById('timer');

// --- STATE VARIABLES ---
let isSessionActive = false;
let lastImageData;
let stream;
let isOnCooldown = false;
let voices = [];
let sessionTimerInterval;
let timeRemaining = 0;
let praiseTimeoutId; // NEW: To hold the random praise timer

// --- FUNCTIONS ---

// Helper function to format seconds into MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
}

// Function to speak a given text
function speak(text) {
    if (window.speechSynthesis.speaking) return; 
    const utterance = new SpeechSynthesisUtterance(text);
    const gentleVoice = voices.find(v => v.name.includes('Google UK') || v.name.includes('Samantha') || v.name.includes('Female'));
    if (gentleVoice) utterance.voice = gentleVoice;
    utterance.pitch = 0.9;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// NEW: Function to schedule a random encouragement message
function scheduleRandomPraise() {
    // Set a random delay between 45 and 90 seconds
    const randomDelay = (Math.random() * 45 + 45) * 1000;

    praiseTimeoutId = setTimeout(() => {
        // Only speak if the session is active and there hasn't been recent movement
        if (isSessionActive && !isOnCooldown) {
            const phrases = ["Great focus.", "You are doing well.", "Excellent stillness.", "Breathing in, breathing out."];
            const chosenPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            speak(chosenPhrase);
        }
        // Schedule the next random praise
        if (isSessionActive) {
            scheduleRandomPraise();
        }
    }, randomDelay);
}

// Main loop for analyzing video frames
function analyzeFrames() {
    if (!isSessionActive) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentImageData = context.getImageData(0, 0, canvas.width, canvas.height);

    if (lastImageData) {
        let difference = 0;
        for (let i = 0; i < currentImageData.data.length; i += 4) {
            difference += Math.abs(currentImageData.data[i] - lastImageData.data[i]);
        }
        
        if (difference > MOVEMENT_THRESHOLD && !isOnCooldown) {
            console.log("Movement Detected. Difference:", difference);
            const phrases = ["Return to stillness.", "Gently bring your awareness back.", "Be present in this moment."];
            const chosenPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            speak(chosenPhrase);
            
            isOnCooldown = true;
            setTimeout(() => { isOnCooldown = false; }, COOLDOWN_SECONDS * 1000);
        }
    }
    
    lastImageData = currentImageData;
    requestAnimationFrame(analyzeFrames);
}

// UPDATED: Function to start the session
async function startSession() {
    const maxDurationMinutes = parseInt(durationInput.value, 10);
    if (isNaN(maxDurationMinutes) || maxDurationMinutes <= 0) {
        alert("Please enter a valid maximum number of minutes.");
        return;
    }

    // UPDATED: Select a random duration up to the maximum set by the user
    const randomDurationMinutes = Math.floor(Math.random() * maxDurationMinutes) + 1;
    timeRemaining = randomDurationMinutes * 60;
    timerElement.textContent = `Time Remaining: ${formatTime(timeRemaining)}`;
    
    sessionTimerInterval = setInterval(() => {
        timeRemaining--;
        timerElement.textContent = `Time Remaining: ${formatTime(timeRemaining)}`;
        if (timeRemaining <= 0) {
            speak("Session complete. Well done.");
            stopSession(`Session of ${randomDurationMinutes} minutes complete! Wonderful focus.`);
        }
    }, 1000);

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        
        video.onloadeddata = () => {
            isSessionActive = true;
            durationInput.disabled = true;
            toggleButton.textContent = "End Session";
            statusElement.textContent = `Session active for ${randomDurationMinutes} minutes. Observing for stillness...`; // UPDATED
            analyzeFrames();
            scheduleRandomPraise(); // NEW: Start the random praise schedule
        };
    } catch (err) {
        console.error("Error accessing camera:", err);
        statusElement.textContent = "Could not access camera. Please grant permission.";
        clearInterval(sessionTimerInterval);
    }
}

// UPDATED: Function to stop the session
function stopSession(message = "Session ended. Well done.") {
    clearTimeout(praiseTimeoutId); // NEW: Stop the praise scheduler
    clearInterval(sessionTimerInterval);
    isSessionActive = false;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    durationInput.disabled = false;
    toggleButton.textContent = "Start Session";
    statusElement.textContent = message;
    lastImageData = null;
}

// Load voices when they are available
window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
};

// --- EVENT LISTENER ---
toggleButton.addEventListener('click', () => {
    if (isSessionActive) {
        stopSession();
    } else {
        startSession();
    }
});

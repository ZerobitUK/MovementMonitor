// --- CONFIGURATION ---
const MOVEMENT_THRESHOLD = 80000; // Lower for more sensitivity
const COOLDOWN_SECONDS = 8;       // Time in seconds to wait between reminders

// --- DOM ELEMENTS ---
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const toggleButton = document.getElementById('toggleButton');
const statusElement = document.getElementById('status');

// --- STATE VARIABLES ---
let isSessionActive = false;
let lastImageData;
let stream;
let isOnCooldown = false;
let voices = [];

// --- FUNCTIONS ---

// Function to speak a given text with a gentle voice
function speak(text) {
    if (window.speechSynthesis.speaking) return; // Don't interrupt if already speaking
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a gentle, calm voice
    const gentleVoice = voices.find(v => v.name.includes('Google UK') || v.name.includes('Samantha') || v.name.includes('Female'));
    if (gentleVoice) {
        utterance.voice = gentleVoice;
    }
    utterance.pitch = 0.9;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// The main loop for analyzing video frames
function analyzeFrames() {
    if (!isSessionActive) return; // Stop the loop if session is inactive

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentImageData = context.getImageData(0, 0, canvas.width, canvas.height);

    if (lastImageData) {
        let difference = 0;
        // Simple pixel difference calculation
        for (let i = 0; i < currentImageData.data.length; i += 4) {
            difference += Math.abs(currentImageData.data[i] - lastImageData.data[i]);
        }
        
        // Check if movement is detected and not on cooldown
        if (difference > MOVEMENT_THRESHOLD && !isOnCooldown) {
            console.log("Movement Detected. Difference:", difference);
            const phrases = ["Return to stillness.", "Gently bring your awareness back.", "Be present in this moment."];
            const chosenPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            speak(chosenPhrase);
            
            // Start cooldown
            isOnCooldown = true;
            setTimeout(() => {
                isOnCooldown = false;
            }, COOLDOWN_SECONDS * 1000);
        }
    }
    
    lastImageData = currentImageData;
    requestAnimationFrame(analyzeFrames); // Continue the loop
}

// Function to start the session
async function startSession() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        
        video.onloadeddata = () => {
            isSessionActive = true;
            toggleButton.textContent = "End Session";
            statusElement.textContent = "Session active. Observing for stillness...";
            analyzeFrames(); // Start the analysis loop
        };
    } catch (err) {
        console.error("Error accessing camera:", err);
        statusElement.textContent = "Could not access camera. Please grant permission.";
    }
}

// Function to stop the session
function stopSession() {
    isSessionActive = false;
    stream.getTracks().forEach(track => track.stop()); // Turn off camera
    video.srcObject = null;
    toggleButton.textContent = "Start Session";
    statusElement.textContent = "Session ended. Well done.";
    lastImageData = null; // Reset for next session
}

// Load voices when they are available
window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
    console.log("Voices loaded:", voices);
};

// --- EVENT LISTENER ---
toggleButton.addEventListener('click', () => {
    if (isSessionActive) {
        stopSession();
    } else {
        startSession();
    }
});

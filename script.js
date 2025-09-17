const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// Since we removed the AI model, we can hide the loading div immediately.
document.getElementById('loading').style.display = 'none';
document.getElementById('main-content').style.display = 'block';

const startBtn = document.getElementById('start-btn');
const timerDisplay = document.getElementById('timer');
const durationInput = document.getElementById('timeout-duration');
const statusMessage = document.getElementById('status-message'); // Make sure this div is in your HTML

let timerInterval;
let timeLeft;
let isTimerRunning = false;
let animationFrameId;
let lastFrameData = null;

const PENALTY_SECONDS = 30;

// This is the key setting to adjust. Higher numbers require more movement.
// Start with a low number like 5 and adjust based on your camera/lighting.
const MOTION_THRESHOLD = 5; 

// The safe zone remains the same
const safeZone = { x: 0.25, y: 0.15, width: 0.5, height: 0.7 };

async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            detectMotionLoop(); // Start the new detection loop
        });
    } catch (error) {
        console.error("Error initializing:", error);
        statusMessage.innerText = "Error: Could not access webcam. Please check permissions.";
    }
}

function detectMotionLoop() {
    // Define the pixel area of the safe zone
    const zx = Math.floor(safeZone.x * canvas.width);
    const zy = Math.floor(safeZone.y * canvas.height);
    const zw = Math.floor(safeZone.width * canvas.width);
    const zh = Math.floor(safeZone.height * canvas.height);
    
    // Draw the video frame onto the hidden canvas to read its pixels
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrameData = ctx.getImageData(zx, zy, zw, zh).data;

    let motionDetected = false;
    if (lastFrameData) {
        let pixelDifference = 0;
        // Compare the pixels of the current frame to the last frame
        for (let i = 0; i < currentFrameData.length; i += 4) {
            // Check the difference in the red, green, and blue channels
            const diff = Math.abs(currentFrameData[i] - lastFrameData[i]) + 
                         Math.abs(currentFrameData[i + 1] - lastFrameData[i + 1]) +
                         Math.abs(currentFrameData[i + 2] - lastFrameData[i + 2]);
            pixelDifference += diff;
        }
        // Calculate the average difference per pixel
        const avgDifference = pixelDifference / (currentFrameData.length / 4);

        if (avgDifference > MOTION_THRESHOLD) {
            motionDetected = true;
        }
    }

    // Store the current frame for the next comparison
    lastFrameData = currentFrameData;

    // Clear the canvas and draw the visual safe zone box
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSafeZone(motionDetected);

    // If timer is running and NO motion is detected, penalize
    if (isTimerRunning && !motionDetected) {
        penalizeUser("No motion detected in zone.");
        flashScreenRed();
    }

    animationFrameId = requestAnimationFrame(detectMotionLoop);
}

function drawSafeZone(isMotion) {
    ctx.strokeStyle = isMotion ? 'limegreen' : 'red';
    ctx.lineWidth = 5;
    ctx.strokeRect(
        safeZone.x * canvas.width,
        safeZone.y * canvas.height,
        safeZone.width * canvas.width,
        safeZone.height * canvas.height
    );
}

// All functions below this line are the same as before
function flashScreenRed() {
    document.body.style.backgroundColor = '#ffcccc';
    setTimeout(() => { document.body.style.backgroundColor = '#f0f2f5'; }, 500);
}

function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    startBtn.disabled = true;
    durationInput.disabled = true;
    
    if (!timeLeft || timeLeft <= 0) {
        timeLeft = parseInt(durationInput.value, 10);
    }
    timerDisplay.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            alert("Time out complete! Well done!");
            startBtn.disabled = false;
            durationInput.disabled = false;
            timerDisplay.textContent = durationInput.value;
        }
    }, 1000);
}

function penalizeUser(reason) {
    if (!isTimerRunning) return;
    
    clearInterval(timerInterval);
    isTimerRunning = false;

    statusMessage.textContent = `PENALTY! +${PENALTY_SECONDS}s. Reason: ${reason}`;
    setTimeout(() => { statusMessage.textContent = ''; }, 4000);
    
    timeLeft += PENALTY_SECONDS;
    timerDisplay.textContent = timeLeft;

    setTimeout(() => { startTimer(); }, 1000);
}

startBtn.addEventListener('click', () => {
    timeLeft = parseInt(durationInput.value, 10);
    startTimer();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && isTimerRunning) {
        penalizeUser("Tab was hidden.");
        flashScreenRed();
    }
});

// Run the main function
init();

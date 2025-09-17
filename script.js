const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const loadingDiv = document.getElementById('loading');
const mainContent = document.getElementById('main-content');
const startBtn = document.getElementById('start-btn');
const timerDisplay = document.getElementById('timer');
const durationInput = document.getElementById('timeout-duration');

let detector;
let timerInterval;
let timeLeft;
let isTimerRunning = false;
let animationFrameId;

// Define the "safe zone" (x, y, width, height) as a percentage of the canvas
const safeZone = {
    x: 0.25, // 25% from the left
    y: 0.15, // 15% from the top
    width: 0.5, // 50% wide
    height: 0.7 // 70% high
};

// Main function to initialize everything
async function init() {
    try {
        // Load the pose detection model
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        detector = await poseDetection.createDetector(model, detectorConfig);
        console.log("MoveNet model loaded.");

        // Get webcam access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            loadingDiv.style.display = 'none';
            mainContent.style.display = 'block';
            detectPose(); // Start detection loop
        });
    } catch (error) {
        console.error("Error initializing the application:", error);
        loadingDiv.innerText = "Error: Could not access webcam or load model. Please check permissions and refresh.";
    }
}

// Function to detect pose in each frame
async function detectPose() {
    if (detector) {
        const poses = await detector.estimatePoses(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawings

        const zoneX = safeZone.x * canvas.width;
        const zoneY = safeZone.y * canvas.height;
        const zoneWidth = safeZone.width * canvas.width;
        const zoneHeight = safeZone.height * canvas.height;

        let isInside = false;

        if (poses && poses.length > 0) {
            const nose = poses[0].keypoints.find(k => k.name === 'nose');
            if (nose && nose.score > 0.5) {
                // Video is mirrored, so we must flip the x-coordinate
                const mirroredX = canvas.width - nose.x;
                isInside = (
                    mirroredX > zoneX &&
                    mirroredX < zoneX + zoneWidth &&
                    nose.y > zoneY &&
                    nose.y < zoneY + zoneHeight
                );
            }
        }

        drawSafeZone(isInside);

        if (isTimerRunning && !isInside) {
            resetTimer();
            flashScreenRed();
        }
    }
    animationFrameId = requestAnimationFrame(detectPose);
}

// Function to draw the safe zone box
function drawSafeZone(isInside) {
    ctx.strokeStyle = isInside ? 'limegreen' : 'red';
    ctx.lineWidth = 5;
    ctx.strokeRect(
        safeZone.x * canvas.width,
        safeZone.y * canvas.height,
        safeZone.width * canvas.width,
        safeZone.height * canvas.height
    );
}

// Function to flash the screen red
function flashScreenRed() {
    document.body.style.backgroundColor = '#ffcccc';
    setTimeout(() => {
        document.body.style.backgroundColor = '#f0f2f5';
    }, 500);
}

// Timer functions
function startTimer() {
    isTimerRunning = true;
    startBtn.disabled = true;
    durationInput.disabled = true;
    timeLeft = parseInt(durationInput.value, 10);
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

function resetTimer() {
    clearInterval(timerInterval);
    timeLeft = parseInt(durationInput.value, 10);
    timerDisplay.textContent = timeLeft;
    isTimerRunning = false;
    startBtn.disabled = false;
    durationInput.disabled = false;
}

// Event Listeners
startBtn.addEventListener('click', () => {
    if (!isTimerRunning) {
        startTimer();
    }
});

// Run the main function
init();

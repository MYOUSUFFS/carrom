// Canvas setup
const canvas = document.getElementById('carrom-board');
const ctx = canvas.getContext('2d');

// Game constants
let BOARD_SIZE = 800;
let BOARD_PADDING = 100;
let PLAYABLE_SIZE = BOARD_SIZE - (BOARD_PADDING * 2);
let POCKET_RADIUS = 25;
let PIECE_RADIUS = 15;
let STRIKER_RADIUS = 18;
const FRICTION = 0.98;
const RESTITUTION = 0.85;

// Responsive canvas sizing
function resizeCanvas() {
    const container = document.querySelector('.game-container');
    const maxWidth = Math.min(800, container.clientWidth - 60);

    BOARD_SIZE = maxWidth;
    BOARD_PADDING = BOARD_SIZE / 8;
    PLAYABLE_SIZE = BOARD_SIZE - (BOARD_PADDING * 2);
    POCKET_RADIUS = BOARD_SIZE / 32;
    PIECE_RADIUS = BOARD_SIZE / 53.33;
    STRIKER_RADIUS = BOARD_SIZE / 44.44;

    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
}

// Call resize on load and window resize
resizeCanvas();
window.addEventListener('resize', () => {
    resizeCanvas();
    if (gameState.pieces.length === 0) {
        initGame();
    }
});

// Game state
let gameState = {
    currentPlayer: 1,
    scores: { player1: 0, player2: 0 },
    pieces: [],
    striker: null,
    isAiming: false,
    aimStart: null,
    power: 50,
    queenPocketed: false,
    queenCovered: { player1: false, player2: false },
    piecesRemaining: { black: 9, white: 9 },
    shotInProgress: false,
    pocketedThisShot: []
};

// Pockets positions (four corners)
const pockets = [
    { x: BOARD_PADDING, y: BOARD_PADDING },
    { x: BOARD_SIZE - BOARD_PADDING, y: BOARD_PADDING },
    { x: BOARD_PADDING, y: BOARD_SIZE - BOARD_PADDING },
    { x: BOARD_SIZE - BOARD_PADDING, y: BOARD_SIZE - BOARD_PADDING }
];

// Piece class
class Piece {
    constructor(x, y, color, isQueen = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.radius = PIECE_RADIUS;
        this.isQueen = isQueen;
        this.active = true;
    }

    draw() {
        if (!this.active) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        if (this.isQueen) {
            ctx.fillStyle = '#e74c3c';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.fill();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    update() {
        if (!this.active) return;

        // Apply friction
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        // Stop if velocity is very small
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        if (Math.abs(this.vy) < 0.1) this.vy = 0;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off walls
        if (this.x - this.radius < BOARD_PADDING) {
            this.x = BOARD_PADDING + this.radius;
            this.vx *= -RESTITUTION;
        }
        if (this.x + this.radius > BOARD_SIZE - BOARD_PADDING) {
            this.x = BOARD_SIZE - BOARD_PADDING - this.radius;
            this.vx *= -RESTITUTION;
        }
        if (this.y - this.radius < BOARD_PADDING) {
            this.y = BOARD_PADDING + this.radius;
            this.vy *= -RESTITUTION;
        }
        if (this.y + this.radius > BOARD_SIZE - BOARD_PADDING) {
            this.y = BOARD_SIZE - BOARD_PADDING - this.radius;
            this.vy *= -RESTITUTION;
        }

        // Check if in pocket
        this.checkPocket();
    }

    checkPocket() {
        for (let pocket of pockets) {
            const dx = this.x - pocket.x;
            const dy = this.y - pocket.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < POCKET_RADIUS) {
                this.active = false;
                gameState.pocketedThisShot.push(this);
            }
        }
    }

    isMoving() {
        return Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1;
    }
}

// Striker class
class Striker extends Piece {
    constructor(x, y) {
        super(x, y, '#FFD700');
        this.radius = STRIKER_RADIUS;
        this.canPlace = true;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(1, '#FFA500');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// Initialize game
function initGame() {
    gameState.pieces = [];
    gameState.piecesRemaining = { black: 9, white: 9 };
    gameState.currentPlayer = 1;
    gameState.scores = { player1: 0, player2: 0 };
    gameState.queenPocketed = false;
    gameState.queenCovered = { player1: false, player2: false };
    gameState.pocketedThisShot = [];

    const centerX = BOARD_SIZE / 2;
    const centerY = BOARD_SIZE / 2;

    // Setup pieces in center formation
    const spacing = PIECE_RADIUS * 2.2;

    // Center queen
    gameState.pieces.push(new Piece(centerX, centerY, 'black', true));

    // First ring (6 pieces)
    const ring1Angle = Math.PI / 3;
    for (let i = 0; i < 6; i++) {
        const angle = i * ring1Angle;
        const x = centerX + Math.cos(angle) * spacing;
        const y = centerY + Math.sin(angle) * spacing;
        const color = i % 2 === 0 ? 'black' : 'white';
        gameState.pieces.push(new Piece(x, y, color));
    }

    // Second ring (12 pieces)
    const ring2Angle = Math.PI / 6;
    for (let i = 0; i < 12; i++) {
        const angle = i * ring2Angle;
        const x = centerX + Math.cos(angle) * spacing * 2;
        const y = centerY + Math.sin(angle) * spacing * 2;
        const color = i % 2 === 0 ? 'white' : 'black';
        gameState.pieces.push(new Piece(x, y, color));
    }

    // Initialize striker
    resetStriker();

    updateUI();
}

function resetStriker() {
    const baselineY = BOARD_SIZE - BOARD_PADDING - 50;
    const centerX = BOARD_SIZE / 2;
    gameState.striker = new Striker(centerX, baselineY);
    gameState.striker.canPlace = true;
}

// Drawing functions
function drawBoard() {
    // Background
    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    // Border
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = BOARD_PADDING;
    ctx.strokeRect(BOARD_PADDING / 2, BOARD_PADDING / 2,
                   BOARD_SIZE - BOARD_PADDING, BOARD_SIZE - BOARD_PADDING);

    // Playing area
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(BOARD_PADDING, BOARD_PADDING,
                   PLAYABLE_SIZE, PLAYABLE_SIZE);

    // Center circle
    ctx.beginPath();
    ctx.arc(BOARD_SIZE / 2, BOARD_SIZE / 2, 50, 0, Math.PI * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Diagonals
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING, BOARD_PADDING);
    ctx.lineTo(BOARD_SIZE - BOARD_PADDING, BOARD_SIZE - BOARD_PADDING);
    ctx.moveTo(BOARD_SIZE - BOARD_PADDING, BOARD_PADDING);
    ctx.lineTo(BOARD_PADDING, BOARD_SIZE - BOARD_PADDING);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pockets
    pockets.forEach(pocket => {
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Baseline for striker
    const baselineY = BOARD_SIZE - BOARD_PADDING - 50;
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING + 50, baselineY);
    ctx.lineTo(BOARD_SIZE - BOARD_PADDING - 50, baselineY);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawAimLine() {
    if (gameState.isAiming && gameState.aimStart) {
        const dx = gameState.aimStart.x - gameState.striker.x;
        const dy = gameState.aimStart.y - gameState.striker.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) {
            const angle = Math.atan2(dy, dx);
            const lineLength = Math.min(distance, 200);

            ctx.beginPath();
            ctx.moveTo(gameState.striker.x, gameState.striker.y);
            ctx.lineTo(
                gameState.striker.x + Math.cos(angle) * lineLength,
                gameState.striker.y + Math.sin(angle) * lineLength
            );
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

// Physics
function checkCollision(piece1, piece2) {
    const dx = piece2.x - piece1.x;
    const dy = piece2.y - piece1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = piece1.radius + piece2.radius;

    if (distance < minDistance) {
        // Collision response
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Rotate velocities
        const vx1 = piece1.vx * cos + piece1.vy * sin;
        const vy1 = piece1.vy * cos - piece1.vx * sin;
        const vx2 = piece2.vx * cos + piece2.vy * sin;
        const vy2 = piece2.vy * cos - piece2.vx * sin;

        // Swap velocities (elastic collision)
        const temp = vx1;
        piece1.vx = (vx2 * cos - vy1 * sin) * RESTITUTION;
        piece1.vy = (vy1 * cos + vx2 * sin) * RESTITUTION;
        piece2.vx = (temp * cos - vy2 * sin) * RESTITUTION;
        piece2.vy = (vy2 * cos + temp * sin) * RESTITUTION;

        // Separate pieces
        const overlap = minDistance - distance;
        const separationX = (dx / distance) * overlap / 2;
        const separationY = (dy / distance) * overlap / 2;
        piece1.x -= separationX;
        piece1.y -= separationY;
        piece2.x += separationX;
        piece2.y += separationY;
    }
}

function updatePhysics() {
    // Update all pieces
    gameState.pieces.forEach(piece => {
        if (piece.active) piece.update();
    });

    if (gameState.striker) {
        gameState.striker.update();
    }

    // Check collisions between all active pieces
    const allPieces = [...gameState.pieces.filter(p => p.active)];
    if (gameState.striker && gameState.striker.active) {
        allPieces.push(gameState.striker);
    }

    for (let i = 0; i < allPieces.length; i++) {
        for (let j = i + 1; j < allPieces.length; j++) {
            checkCollision(allPieces[i], allPieces[j]);
        }
    }

    // Check if all pieces stopped
    if (gameState.shotInProgress) {
        const allStopped = allPieces.every(p => !p.isMoving());
        if (allStopped) {
            endShot();
        }
    }
}

function endShot() {
    gameState.shotInProgress = false;

    // Process pocketed pieces
    let validShot = false;
    let pocketedOwn = false;
    let pocketedQueen = false;

    gameState.pocketedThisShot.forEach(piece => {
        if (piece.isQueen) {
            pocketedQueen = true;
            gameState.queenPocketed = true;
        } else {
            const currentColor = gameState.currentPlayer === 1 ? 'black' : 'white';
            if (piece.color === currentColor) {
                validShot = true;
                pocketedOwn = true;
                if (piece.color === 'black') {
                    gameState.piecesRemaining.black--;
                } else {
                    gameState.piecesRemaining.white--;
                }
                gameState.scores[`player${gameState.currentPlayer}`] += 10;
            } else {
                // Pocketed opponent's piece
                if (piece.color === 'black') {
                    gameState.piecesRemaining.black--;
                } else {
                    gameState.piecesRemaining.white--;
                }
            }
        }
    });

    // Handle queen covering
    if (pocketedQueen && pocketedOwn) {
        gameState.queenCovered[`player${gameState.currentPlayer}`] = true;
        gameState.scores[`player${gameState.currentPlayer}`] += 50;
        validShot = true;
    }

    // Check if striker was pocketed
    if (!gameState.striker.active) {
        gameState.scores[`player${gameState.currentPlayer}`] =
            Math.max(0, gameState.scores[`player${gameState.currentPlayer}`] - 10);
        validShot = false;
    }

    gameState.pocketedThisShot = [];

    // Check win condition
    const playerColor = gameState.currentPlayer === 1 ? 'black' : 'white';
    const remaining = gameState.piecesRemaining[playerColor];

    if (remaining === 0) {
        setTimeout(() => {
            alert(`Player ${gameState.currentPlayer} wins!`);
            initGame();
        }, 500);
        return;
    }

    // Switch turn if invalid shot
    if (!validShot) {
        gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    }

    resetStriker();
    updateUI();
}

// Event handlers - Mouse events
function getCanvasCoordinates(e, rect) {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function handleStart(e) {
    if (gameState.shotInProgress) return;

    const rect = canvas.getBoundingClientRect();
    const { x, y } = getCanvasCoordinates(e, rect);

    const dx = x - gameState.striker.x;
    const dy = y - gameState.striker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < gameState.striker.radius * 2) {
        gameState.isAiming = true;
        gameState.aimStart = { x, y };
        e.preventDefault();
    }
}

function handleMove(e) {
    if (!gameState.isAiming) return;

    const rect = canvas.getBoundingClientRect();
    const { x, y } = getCanvasCoordinates(e, rect);
    gameState.aimStart = { x, y };
    e.preventDefault();
}

function handleEnd(e) {
    if (!gameState.isAiming) return;

    const dx = gameState.aimStart.x - gameState.striker.x;
    const dy = gameState.aimStart.y - gameState.striker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
        // Increased power multiplier: 100% now equals 20 power units instead of 10
        const power = (gameState.power / 100) * 20;
        const angle = Math.atan2(dy, dx);

        gameState.striker.vx = Math.cos(angle) * power;
        gameState.striker.vy = Math.sin(angle) * power;

        gameState.shotInProgress = true;
    }

    gameState.isAiming = false;
    gameState.aimStart = null;
    e.preventDefault();
}

// Mouse events
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);

// Touch events for mobile
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd, { passive: false });

// Power slider
document.getElementById('power-slider').addEventListener('input', (e) => {
    gameState.power = e.target.value;
    document.getElementById('power-value').textContent = e.target.value;
});

// Reset button
document.getElementById('reset-btn').addEventListener('click', () => {
    initGame();
});

// Update UI
function updateUI() {
    document.getElementById('player1-score').textContent = gameState.scores.player1;
    document.getElementById('player2-score').textContent = gameState.scores.player2;
    document.getElementById('current-player').textContent =
        `Player ${gameState.currentPlayer}'s Turn`;
    document.getElementById('p1-black').textContent = gameState.piecesRemaining.black;
    document.getElementById('p2-white').textContent = gameState.piecesRemaining.white;

    const queenStatus = gameState.queenPocketed ?
        (gameState.queenCovered.player1 ? 'Queen: Player 1' :
         gameState.queenCovered.player2 ? 'Queen: Player 2' : 'Queen: Pocketed (Not Covered)') :
        'Queen: Available';
    document.getElementById('queen-status').textContent = queenStatus;
}

// Game loop
function gameLoop() {
    drawBoard();

    gameState.pieces.forEach(piece => piece.draw());

    if (gameState.striker) {
        gameState.striker.draw();
    }

    drawAimLine();
    updatePhysics();

    requestAnimationFrame(gameLoop);
}

// Start game
initGame();
gameLoop();

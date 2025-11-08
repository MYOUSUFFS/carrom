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
    pocketedThisShot: [],
    pocketEffects: [],
    motionTrails: []
};

// Pocket effect animation
class PocketEffect {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.alpha = 1;
        this.maxRadius = 40;
    }

    update() {
        this.radius += 2;
        this.alpha -= 0.02;
    }

    draw() {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#7e22ce';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    isDone() {
        return this.alpha <= 0 || this.radius >= this.maxRadius;
    }
}

// Motion trail for fast-moving pieces
class MotionTrail {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.alpha = 0.5;
        this.color = color;
        this.radius = PIECE_RADIUS * 0.8;
    }

    update() {
        this.alpha -= 0.05;
    }

    draw() {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    isDone() {
        return this.alpha <= 0;
    }
}

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
        this.rotation = Math.random() * Math.PI * 2; // Random initial rotation
        this.angularVelocity = 0; // Rotation speed
        this.mass = isQueen ? 1.1 : 1.0; // Queen is slightly heavier
    }

    draw() {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw piece with gradient and rotation marks
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        if (this.isQueen) {
            // Queen with red gradient
            const gradient = ctx.createRadialGradient(-this.radius/3, -this.radius/3, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#ff6b6b');
            gradient.addColorStop(0.6, '#e74c3c');
            gradient.addColorStop(1, '#c0392b');
            ctx.fillStyle = gradient;
        } else {
            // Regular pieces with gradient
            const gradient = ctx.createRadialGradient(-this.radius/3, -this.radius/3, 0, 0, 0, this.radius);
            if (this.color === 'black') {
                gradient.addColorStop(0, '#4a4a4a');
                gradient.addColorStop(0.6, '#2c2c2c');
                gradient.addColorStop(1, '#1a1a1a');
            } else {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(0.6, '#f5f5f5');
                gradient.addColorStop(1, '#d0d0d0');
            }
            ctx.fillStyle = gradient;
        }
        ctx.fill();

        // Draw rotation indicator lines
        ctx.strokeStyle = this.isQueen ? '#fff' : (this.color === 'black' ? '#666' : '#999');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.radius * 0.7, 0);
        ctx.stroke();

        // Draw small dots for visual rotation feedback
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 2) * i;
            const dotX = Math.cos(angle) * this.radius * 0.6;
            const dotY = Math.sin(angle) * this.radius * 0.6;
            ctx.beginPath();
            ctx.arc(dotX, dotY, this.radius * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = this.isQueen ? 'rgba(255, 255, 255, 0.4)' :
                           (this.color === 'black' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)');
            ctx.fill();
        }

        // Outer border
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Highlight/shine effect
        ctx.beginPath();
        ctx.arc(-this.radius/3, -this.radius/3, this.radius/3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        ctx.restore();
    }

    update() {
        if (!this.active) return;

        // Calculate speed for rotation
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // Add motion trail for fast-moving pieces
        if (speed > 3 && Math.random() < 0.4) {
            const trailColor = this.isQueen ? '#e74c3c' : this.color;
            gameState.motionTrails.push(new MotionTrail(this.x, this.y, trailColor));
        }

        // Update angular velocity based on linear velocity (simulates rolling)
        if (speed > 0.1) {
            // Calculate rotation based on movement direction and speed
            const direction = Math.atan2(this.vy, this.vx);
            this.angularVelocity = speed / this.radius * 0.5;
        }

        // Apply friction to angular velocity
        this.angularVelocity *= FRICTION;

        // Update rotation
        this.rotation += this.angularVelocity;

        // Stop angular velocity if very small
        if (Math.abs(this.angularVelocity) < 0.01) this.angularVelocity = 0;

        // Apply friction to linear velocity
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        // Stop if velocity is very small
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        if (Math.abs(this.vy) < 0.1) this.vy = 0;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off walls with spin effect
        if (this.x - this.radius < BOARD_PADDING) {
            this.x = BOARD_PADDING + this.radius;
            this.vx *= -RESTITUTION;
            this.angularVelocity *= 0.7; // Reduce spin on wall bounce
        }
        if (this.x + this.radius > BOARD_SIZE - BOARD_PADDING) {
            this.x = BOARD_SIZE - BOARD_PADDING - this.radius;
            this.vx *= -RESTITUTION;
            this.angularVelocity *= 0.7;
        }
        if (this.y - this.radius < BOARD_PADDING) {
            this.y = BOARD_PADDING + this.radius;
            this.vy *= -RESTITUTION;
            this.angularVelocity *= 0.7;
        }
        if (this.y + this.radius > BOARD_SIZE - BOARD_PADDING) {
            this.y = BOARD_SIZE - BOARD_PADDING - this.radius;
            this.vy *= -RESTITUTION;
            this.angularVelocity *= 0.7;
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
                // Add pocket effect animation
                gameState.pocketEffects.push(new PocketEffect(this.x, this.y));
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
        this.glowPhase = 0;
        this.mass = 1.3; // Striker is heavier than regular pieces
        this.angularVelocity = 0;
        this.rotation = 0;
    }

    draw() {
        // Animated glow effect
        this.glowPhase += 0.05;
        const glowSize = Math.sin(this.glowPhase) * 3 + 3;

        // Outer glow
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + glowSize, 0, Math.PI * 2);
        const outerGlow = ctx.createRadialGradient(
            this.x, this.y, this.radius,
            this.x, this.y, this.radius + glowSize
        );
        outerGlow.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        outerGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = outerGlow;
        ctx.fill();

        // Main striker
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        const gradient = ctx.createRadialGradient(
            this.x - this.radius/3, this.y - this.radius/3, 0,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#FFFACD');
        gradient.addColorStop(0.5, '#FFD700');
        gradient.addColorStop(1, '#FFA500');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Border
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Shine effect
        ctx.beginPath();
        ctx.arc(this.x - this.radius/3, this.y - this.radius/3, this.radius/3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
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
        const pullBackDistance = Math.sqrt(dx * dx + dy * dy);

        if (pullBackDistance > 5) {
            // Pull back angle (opposite direction)
            const pullBackAngle = Math.atan2(dy, dx);
            // Shooting angle (forward direction - opposite of pull back)
            const shootAngle = pullBackAngle + Math.PI;

            // Calculate auto power based on pull-back distance (max 250px = 100%)
            const autoPower = Math.min(100, Math.floor((pullBackDistance / 250) * 100));
            gameState.power = autoPower;

            // Update power display
            document.getElementById('power-value').textContent = autoPower;
            document.getElementById('power-slider').value = autoPower;

            // Draw pull-back indicator (where you're pulling)
            ctx.beginPath();
            ctx.moveTo(gameState.striker.x, gameState.striker.y);
            ctx.lineTo(gameState.aimStart.x, gameState.aimStart.y);
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 8]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw shooting direction line (forward)
            const shootLineLength = pullBackDistance * 2;
            const shootEndX = gameState.striker.x + Math.cos(shootAngle) * shootLineLength;
            const shootEndY = gameState.striker.y + Math.sin(shootAngle) * shootLineLength;

            // Draw gradient aim line
            const gradient = ctx.createLinearGradient(
                gameState.striker.x,
                gameState.striker.y,
                shootEndX,
                shootEndY
            );
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#7e22ce');

            ctx.beginPath();
            ctx.moveTo(gameState.striker.x, gameState.striker.y);
            ctx.lineTo(shootEndX, shootEndY);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 5;
            ctx.setLineDash([15, 10]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw target location indicator at the end
            ctx.beginPath();
            ctx.arc(shootEndX, shootEndY, 20, 0, Math.PI * 2);
            ctx.strokeStyle = '#7e22ce';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner target circle
            ctx.beginPath();
            ctx.arc(shootEndX, shootEndY, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(126, 34, 206, 0.4)';
            ctx.fill();
            ctx.strokeStyle = '#7e22ce';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw crosshair at target
            ctx.beginPath();
            ctx.moveTo(shootEndX - 15, shootEndY);
            ctx.lineTo(shootEndX + 15, shootEndY);
            ctx.moveTo(shootEndX, shootEndY - 15);
            ctx.lineTo(shootEndX, shootEndY + 15);
            ctx.strokeStyle = '#7e22ce';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw power percentage near striker
            ctx.save();
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 4;
            const powerText = `${autoPower}%`;
            const textX = gameState.striker.x - 20;
            const textY = gameState.striker.y - gameState.striker.radius - 15;
            ctx.strokeText(powerText, textX, textY);
            ctx.fillText(powerText, textX, textY);
            ctx.restore();

            // Draw power bar
            const barWidth = 60;
            const barHeight = 8;
            const barX = gameState.striker.x - barWidth / 2;
            const barY = gameState.striker.y - gameState.striker.radius - 30;

            // Bar background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Bar fill
            const fillGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
            fillGradient.addColorStop(0, '#667eea');
            fillGradient.addColorStop(1, '#7e22ce');
            ctx.fillStyle = fillGradient;
            ctx.fillRect(barX, barY, (barWidth * autoPower) / 100, barHeight);

            // Bar border
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }
}

// Physics
function checkCollision(piece1, piece2) {
    const dx = piece2.x - piece1.x;
    const dy = piece2.y - piece1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = piece1.radius + piece2.radius;

    if (distance < minDistance && distance > 0) {
        // Get masses (striker has mass, others use default)
        const m1 = piece1.mass || 1.0;
        const m2 = piece2.mass || 1.0;
        const totalMass = m1 + m2;

        // Collision normal
        const nx = dx / distance;
        const ny = dy / distance;

        // Relative velocity
        const dvx = piece2.vx - piece1.vx;
        const dvy = piece2.vy - piece1.vy;

        // Relative velocity in collision normal direction
        const dvn = dvx * nx + dvy * ny;

        // Do not resolve if velocities are separating
        if (dvn > 0) return;

        // Calculate impulse scalar with mass consideration
        const impulse = (-(1 + RESTITUTION) * dvn) / totalMass;

        // Apply impulse to velocities
        const impulseX = impulse * nx;
        const impulseY = impulse * ny;

        piece1.vx -= impulseX * m2;
        piece1.vy -= impulseY * m2;
        piece2.vx += impulseX * m1;
        piece2.vy += impulseY * m1;

        // Transfer angular velocity (spin) on collision
        const relativeSpeed = Math.sqrt(dvx * dvx + dvy * dvy);
        if (piece1.angularVelocity !== undefined && piece2.angularVelocity !== undefined) {
            const spinTransfer = relativeSpeed * 0.1;
            piece1.angularVelocity += spinTransfer * (Math.random() - 0.5);
            piece2.angularVelocity += spinTransfer * (Math.random() - 0.5);
        }

        // Separate pieces to prevent overlap
        const overlap = minDistance - distance;
        const separationRatio = overlap / (m1 + m2);

        piece1.x -= nx * separationRatio * m2;
        piece1.y -= ny * separationRatio * m2;
        piece2.x += nx * separationRatio * m1;
        piece2.y += ny * separationRatio * m1;
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
    const pullBackDistance = Math.sqrt(dx * dx + dy * dy);

    if (pullBackDistance > 5) {
        // Calculate power based on pull-back distance
        const autoPower = Math.min(100, (pullBackDistance / 250) * 100);
        const power = (autoPower / 100) * 30;

        // Shoot in opposite direction of pull (pull back to shoot forward)
        const pullBackAngle = Math.atan2(dy, dx);
        const shootAngle = pullBackAngle + Math.PI;

        gameState.striker.vx = Math.cos(shootAngle) * power;
        gameState.striker.vy = Math.sin(shootAngle) * power;

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

    // Highlight active player
    const player1Card = document.querySelector('.player-score:first-child');
    const player2Card = document.querySelector('.player-score:last-child');

    if (gameState.currentPlayer === 1) {
        player1Card.classList.add('active');
        player2Card.classList.remove('active');
    } else {
        player1Card.classList.remove('active');
        player2Card.classList.add('active');
    }

    const queenStatus = gameState.queenPocketed ?
        (gameState.queenCovered.player1 ? 'Queen: Player 1' :
         gameState.queenCovered.player2 ? 'Queen: Player 2' : 'Queen: Pocketed (Not Covered)') :
        'Queen: Available';
    document.getElementById('queen-status').textContent = queenStatus;
}

// Game loop
function gameLoop() {
    drawBoard();

    // Update and draw motion trails (drawn before pieces for layering)
    gameState.motionTrails = gameState.motionTrails.filter(trail => {
        trail.update();
        trail.draw();
        return !trail.isDone();
    });

    gameState.pieces.forEach(piece => piece.draw());

    if (gameState.striker) {
        gameState.striker.draw();
    }

    drawAimLine();

    // Update and draw pocket effects
    gameState.pocketEffects = gameState.pocketEffects.filter(effect => {
        effect.update();
        effect.draw();
        return !effect.isDone();
    });

    updatePhysics();

    requestAnimationFrame(gameLoop);
}

// Start game
initGame();
gameLoop();

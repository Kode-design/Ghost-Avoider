const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Settings
// Pixel art scaling: we will draw everything 2x larger.
const SCALE = 2;
const TILE_SIZE = 48 * SCALE; // 96
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// Disable smoothing for pixel art look
ctx.imageSmoothingEnabled = false;

// Assets
const assets = {
    playerIdle: new Image(),
    playerRun: new Image(),
    enemyWalk: new Image(),
    moods: new Image(),
};

// Load stats
let loadedCount = 0;
const totalAssets = Object.keys(assets).length;

function onAssetLoad() {
    loadedCount++;
    if (loadedCount === totalAssets) {
        console.log("All assets loaded. Starting game.");
        startGame();
    }
}

function onAssetError(e) {
    console.error("Error loading asset", e);
    // We still count it so game can start (with missing assets)
    loadedCount++;
    if (loadedCount === totalAssets) {
        startGame();
    }
}

// Use Adam_idle_anim for idle (has 24 frames, same layout as run)
assets.playerIdle.src = 'assets/characters/Adam_idle_anim_48x48.png';
assets.playerIdle.onload = onAssetLoad;
assets.playerIdle.onerror = onAssetError;

assets.playerRun.src = 'assets/characters/Adam_run_48x48.png';
assets.playerRun.onload = onAssetLoad;
assets.playerRun.onerror = onAssetError;

assets.enemyWalk.src = 'assets/characters/Ghost_1_walk_48x48.png';
assets.enemyWalk.onload = onAssetLoad;
assets.enemyWalk.onerror = onAssetError;

assets.moods.src = 'assets/characters/Moods_48x48.png';
assets.moods.onload = onAssetLoad;
assets.moods.onerror = onAssetError;

// Input
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyH') debugMode = !debugMode;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

let debugMode = false;

// Classes
class Sprite {
    constructor(image, frameWidth, frameHeight, frameSpeed, animations) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.frameSpeed = frameSpeed;
        this.animations = animations; 
        
        this.currentAnim = 'idle_down'; // Default to down
        this.frameIndex = 0;
        this.tickCount = 0;
    }

    update() {
        this.tickCount++;
        if (this.tickCount > this.frameSpeed) {
            this.tickCount = 0;
            this.frameIndex++;
            const anim = this.animations[this.currentAnim];
            if (!anim) return;
            if (this.frameIndex >= anim.frames) {
                this.frameIndex = 0;
            }
        }
    }

    draw(ctx, x, y) {
        const anim = this.animations[this.currentAnim];
        if (!anim) return;

        const row = anim.row;
        const startCol = anim.startCol || 0; 
        
        const sx = (startCol + this.frameIndex) * this.frameWidth;
        const sy = row * this.frameHeight;

        // Draw scaled
        ctx.drawImage(this.image, sx, sy, this.frameWidth, this.frameHeight, x, y, this.frameWidth * SCALE, this.frameHeight * SCALE);
    }
}

class Player {
    constructor() {
        // Start centered
        this.x = 400 - 48;
        this.y = 300 - 48;
        this.speed = 8; 
        this.width = 32 * SCALE; 
        this.height = 32 * SCALE; 
        
        // Animation Config (24 frames per row)
        // 6 frames per direction.
        // Order: Right (0-5), Up (6-11), Left (12-17), Down (18-23)
        const anims = {
            'idle_right': { row: 0, frames: 6, startCol: 0 },
            'idle_up': { row: 0, frames: 6, startCol: 6 },
            'idle_left': { row: 0, frames: 6, startCol: 12 },
            'idle_down': { row: 0, frames: 6, startCol: 18 },
            'run_right': { row: 0, frames: 6, startCol: 0 },
            'run_up': { row: 0, frames: 6, startCol: 6 },
            'run_left': { row: 0, frames: 6, startCol: 12 },
            'run_down': { row: 0, frames: 6, startCol: 18 }
        };

        // Use 96 height for Adam sprites (Tall character or 2 rows packed)
        this.sprite = new Sprite(assets.playerIdle, 48, 96, 6, anims);
        
        this.direction = 'down';
        this.isMoving = false;
    }

    update() {
        this.isMoving = false;
        
        if (keys['ArrowUp'] || keys['KeyW']) {
            this.y -= this.speed;
            this.direction = 'up';
            this.isMoving = true;
        } else if (keys['ArrowDown'] || keys['KeyS']) {
            this.y += this.speed;
            this.direction = 'down';
            this.isMoving = true;
        }
        
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.x -= this.speed;
            this.direction = 'left';
            this.isMoving = true;
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            this.x += this.speed;
            this.direction = 'right';
            this.isMoving = true;
        }

        // Boundary checks
        this.x = Math.max(0, Math.min(GAME_WIDTH - TILE_SIZE, this.x));
        this.y = Math.max(0, Math.min(GAME_HEIGHT - TILE_SIZE, this.y));

        // Update Animation State
        if (this.isMoving) {
            this.sprite.image = assets.playerRun;
            this.sprite.currentAnim = 'run_' + this.direction;
        } else {
            this.sprite.image = assets.playerIdle;
            this.sprite.currentAnim = 'idle_' + this.direction;
        }

        this.sprite.update();
    }

    draw(ctx) {
        if (debugMode) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.fillRect(this.x, this.y, TILE_SIZE, TILE_SIZE);
        }

        // Offset Y by TILE_SIZE (96) because sprite is 192 tall (2x tile size)
        // And we want feet to align with bottom of tile.
        this.sprite.draw(ctx, this.x, this.y - TILE_SIZE);

        if (debugMode) {
            const box = this.getHitbox();
            ctx.strokeStyle = 'red';
            ctx.strokeRect(box.x, box.y, box.w, box.h);
        }
    }
    
    getHitbox() {
        // Centered hitbox in the tile
        const marginX = (TILE_SIZE - this.width) / 2;
        const marginY = (TILE_SIZE - this.height) / 2;
        return { x: this.x + marginX, y: this.y + marginY, w: this.width, h: this.height };
    }
}

class Ghost {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 4;
        
        // Ghost Walk: 1536 width, 32 frames. 8 per dir.
        // 0-7 Right, 8-15 Up, 16-23 Left, 24-31 Down.
        const anims = {
            'walk_right': { row: 0, frames: 8, startCol: 0 },
            'walk_up': { row: 0, frames: 8, startCol: 8 },
            'walk_left': { row: 0, frames: 8, startCol: 16 },
            'walk_down': { row: 0, frames: 8, startCol: 24 }
        };
        
        // Ghost is 48x48 base.
        this.sprite = new Sprite(assets.enemyWalk, 48, 48, 8, anims);
        this.direction = 'down';
        this.changeDirTimer = 0;
    }
    
    update() {
        this.changeDirTimer--;
        if (this.changeDirTimer <= 0) {
            const dirs = ['up', 'down', 'left', 'right'];
            this.direction = dirs[Math.floor(Math.random() * dirs.length)];
            this.changeDirTimer = 30 + Math.random() * 60;
        }
        
        if (this.direction === 'up') this.y -= this.speed;
        if (this.direction === 'down') this.y += this.speed;
        if (this.direction === 'left') this.x -= this.speed;
        if (this.direction === 'right') this.x += this.speed;
        
        // Boundary bounce
        if (this.x < 0) { this.x = 0; this.direction = 'right'; }
        if (this.x > GAME_WIDTH - TILE_SIZE) { this.x = GAME_WIDTH - TILE_SIZE; this.direction = 'left'; }
        if (this.y < 0) { this.y = 0; this.direction = 'down'; }
        if (this.y > GAME_HEIGHT - TILE_SIZE) { this.y = GAME_HEIGHT - TILE_SIZE; this.direction = 'up'; }
        
        this.sprite.currentAnim = 'walk_' + this.direction;
        this.sprite.update();
    }
    
    draw(ctx) {
        if (debugMode) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(this.x, this.y, TILE_SIZE, TILE_SIZE);
        }
        this.sprite.draw(ctx, this.x, this.y);
    }
    
    getHitbox() {
        // Slightly smaller than full tile
        return { x: this.x + 20, y: this.y + 20, w: TILE_SIZE - 40, h: TILE_SIZE - 40 };
    }
}

class Mood {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 0 to 7
    }
    
    draw(ctx) {
        if (debugMode) {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
            ctx.fillRect(this.x, this.y, TILE_SIZE, TILE_SIZE);
        }
        // Draw specific frame based on type
        // type 0-7
        // 48x48 source
        ctx.drawImage(assets.moods, this.type * 48, 0, 48, 48, this.x, this.y, TILE_SIZE, TILE_SIZE);
    }
    
    getHitbox() {
        return { x: this.x + 24, y: this.y + 24, w: TILE_SIZE - 48, h: TILE_SIZE - 48 };
    }
}

let player;
let enemies = [];
let moods = [];
let score = 0;
let gameOver = false;

function startGame() {
    player = new Player();
    enemies = [
        new Ghost(0, 0),
        new Ghost(GAME_WIDTH - TILE_SIZE, 0),
        new Ghost(0, GAME_HEIGHT - TILE_SIZE),
        new Ghost(GAME_WIDTH - TILE_SIZE, GAME_HEIGHT - TILE_SIZE)
    ];
    
    moods = [];
    spawnMood();
    
    // Start loop
    window.requestAnimationFrame(gameLoop);
}

function spawnMood() {
    const x = Math.random() * (GAME_WIDTH - TILE_SIZE);
    const y = Math.random() * (GAME_HEIGHT - TILE_SIZE);
    const type = Math.floor(Math.random() * 8);
    moods.push(new Mood(x, y, type));
}

function gameLoop() {
    if (!gameOver) {
        update();
    }
    draw();
    window.requestAnimationFrame(gameLoop);
}

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || 
             r2.x + r2.w < r1.x || 
             r2.y > r1.y + r1.h || 
             r2.y + r2.h < r1.y);
}

function update() {
    player.update();
    
    const playerBox = player.getHitbox();
    
    enemies.forEach(enemy => {
        enemy.update();
        if (rectIntersect(playerBox, enemy.getHitbox())) {
            gameOver = true;
        }
    });
    
    for (let i = moods.length - 1; i >= 0; i--) {
        if (rectIntersect(playerBox, moods[i].getHitbox())) {
            moods.splice(i, 1);
            score += 10;
            document.getElementById('score').innerText = score;
            spawnMood();
            
            if (score % 50 === 0) {
                enemies.push(new Ghost(Math.random() * (GAME_WIDTH - TILE_SIZE), Math.random() * (GAME_HEIGHT - TILE_SIZE)));
            }
        }
    }
}

function draw() {
    // Set background color explicitly
    ctx.fillStyle = '#666'; 
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw grid background
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for(let x=0; x<GAME_WIDTH; x+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,GAME_HEIGHT); ctx.stroke();
    }
    for(let y=0; y<GAME_HEIGHT; y+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(GAME_WIDTH,y); ctx.stroke();
    }

    if (player) {
        moods.forEach(m => m.draw(ctx));
        enemies.forEach(e => e.draw(ctx));
        player.draw(ctx);
    }
    
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        ctx.fillStyle = 'white';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', GAME_WIDTH/2, GAME_HEIGHT/2);
        ctx.font = '24px sans-serif';
        ctx.fillText('Press F5 to Restart', GAME_WIDTH/2, GAME_HEIGHT/2 + 40);
    }
}

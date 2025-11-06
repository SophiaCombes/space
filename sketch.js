// Game constants
const BLOCK_SIZE = 10; // Size of each block in pixels
const CENTER_AXIS = new THREE.Vector3(0, 0, 0); // Center point - everything rotates around this
const PLANET_RADIUS = 100 * BLOCK_SIZE; // Planet radius: 100 blocks from center axis
const ALIEN_DISTANCE = 101 * BLOCK_SIZE; // Alien distance: 101 blocks from center axis (on surface)
const GRAVITY = 0.5;
const MOVE_SPEED = 1.5;
const JUMP_SPEED = 6;

// Three.js scene setup
let scene, camera, renderer;
let planetMesh = null; // Three.js mesh for solid planet sphere
let starPoints = null; // Three.js Points object for stars
let alienGroup = null; // Three.js mesh for alien (single block)

// Game state
let planet = [];
let stars = []; // Pre-generated stars
let alien = {
    // Position relative to center axis (no movement for now)
    position: new THREE.Vector3(0, ALIEN_DISTANCE, 0), // Start at top of planet
    velocityY: 0, // Velocity away from center (for jumping, future use)
    isJumping: false,
    onGround: true
};

// Represent alien on spherical coordinates around center axis
// theta: polar angle from +Y axis (0..PI), phi: azimuth around Y axis (0..2PI)
alien.spherical = {
    theta: 0, // at top of planet (pointing +Y)
    phi: 0
};

const ANGLE_SPEED = 0.02; // radians per frame for WASD rotation

let keys = {};

// Camera state
let cameraDistance = 200; // Distance from center axis
const ZOOM_SPEED = 10; // How fast to zoom in/out
const MIN_ZOOM = 25; // Minimum zoom
const MAX_ZOOM = 500; // Maximum zoom

// Initialize Three.js scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000014); // Dark space background (0, 0, 20)
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(800, 600);
    document.body.appendChild(renderer.domElement);
    
    // Enable space lighting (darker but still visible)
    const ambientLight = new THREE.AmbientLight(0x505050, 0.31); // RGB(80,80,80) normalized to 0-1, intensity ~0.31
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0.5, 0.5, -1);
    scene.add(directionalLight);
    
    // Generate stars
    generateStars();
    
    // Generate planet blocks
    generatePlanet();
    
    // Create alien
    createAlien();
    
    // Position alien at 101 blocks from center axis (on planet surface)
    alien.position.set(0, ALIEN_DISTANCE, 0); // Start at top of planet
    
    // Setup input handlers
    window.addEventListener('keydown', keyPressed);
    window.addEventListener('keyup', keyReleased);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

function generateStars() {
    // Pre-generate stars so they don't flicker
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    
    for (let i = 0; i < 200; i++) {
        starPositions.push(
            (Math.random() - 0.5) * 4000,
            (Math.random() - 0.5) * 4000,
            (Math.random() - 0.5) * 4000
        );
        stars.push({
            x: starPositions[starPositions.length - 3],
            y: starPositions[starPositions.length - 2],
            z: starPositions[starPositions.length - 1]
        });
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2
    });
    
    starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);
}

function generatePlanet() {
    // Create a solid filled sphere centered at the center axis
    const radius = PLANET_RADIUS; // 100 blocks radius
    
    // Create sphere geometry - higher segment count for smoother sphere
    const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
    
    // Material for planet
    const planetMaterial = new THREE.MeshStandardMaterial({
        color: 0x6496c8 // Blue-gray planet color (100, 150, 200)
    });
    
    // Create the planet mesh at center axis
    planetMesh = new THREE.Mesh(sphereGeometry, planetMaterial);
    planetMesh.position.copy(CENTER_AXIS); // Center at center axis
    scene.add(planetMesh);
    
    console.log(`Created solid planet sphere with radius: ${radius} (100 blocks)`);
}

function createAlien() {
    // Create a single block for alien (simplified)
    const alienGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const alienMaterial = new THREE.MeshStandardMaterial({
        color: 0x96c864 // Green alien color (150, 200, 100)
    });
    
    alienGroup = new THREE.Mesh(alienGeometry, alienMaterial);
    alienGroup.position.copy(alien.position); // Position at 101 blocks from center axis
    scene.add(alienGroup);
}

function handleInput() {
    // WASD movement modifies alien spherical angles
    // W: move toward -Z (decrease theta slightly towards front), S: opposite, A: rotate left (decrease phi), D: rotate right (increase phi)
    let dTheta = 0;
    let dPhi = 0;
    if (keys['w']) {
        dTheta -= ANGLE_SPEED;
    }
    if (keys['s']) {
        dTheta += ANGLE_SPEED;
    }
    if (keys['a']) {
        dPhi -= ANGLE_SPEED;
    }
    if (keys['d']) {
        dPhi += ANGLE_SPEED;
    }

    // Apply changes to alien spherical coordinates
    if (dTheta !== 0 || dPhi !== 0) {
        alien.spherical.theta = Math.min(Math.max(0.01, alien.spherical.theta + dTheta), Math.PI - 0.01); // clamp to avoid poles singularity
        alien.spherical.phi = (alien.spherical.phi + dPhi) % (Math.PI * 2);
        // Recompute alien Cartesian position from spherical coords
        // Spherical here: radius r = ALIEN_DISTANCE, theta = angle from +Y, phi = azimuth around Y
        const r = ALIEN_DISTANCE;
        const theta = alien.spherical.theta;
        const phi = alien.spherical.phi;
        const sinT = Math.sin(theta);
        const x = r * sinT * Math.sin(phi);
        const y = r * Math.cos(theta);
        const z = r * sinT * Math.cos(phi);
        alien.position.set(x, y, z);
    }

    // Zoom controls
    if (keys['o']) {
        // Zoom in (decrease camera distance)
        cameraDistance = Math.max(MIN_ZOOM, cameraDistance - ZOOM_SPEED);
    }
    if (keys['p']) {
        // Zoom out (increase camera distance)
        cameraDistance = Math.min(MAX_ZOOM, cameraDistance + ZOOM_SPEED);
    }
}

function updateAlien() {
    // No vertical physics for now; alien position is driven by spherical coords set in handleInput
    // Ensure alien stays at exact ALIEN_DISTANCE from center axis (defensive)
    if (alien.position.length() === 0) return;
    alien.position.setLength(ALIEN_DISTANCE);
}

// Removed sphericalToCartesian - using direct vector positioning now

function updateCamera() {
    // Camera always points at center axis
    // Camera position: extend from center axis, through alien, to camera distance
    const alienPos = alien.position.clone();
    if (alienPos.length() === 0) return;

    // Direction from center to alien
    const dir = alienPos.clone().normalize();

    // Place camera somewhere along the same line beyond the alien so that camera -> alien -> center are collinear
    // We'll position camera at center + dir * (ALIEN_DISTANCE + cameraDistance)
    const camDistFromCenter = ALIEN_DISTANCE + cameraDistance;
    const camPos = dir.clone().multiplyScalar(camDistFromCenter);
    camera.position.copy(camPos);

    // Make camera look at the alien (so the ray from camera through alien points to center)
    camera.lookAt(alienPos);
    
    // Draw invisible line from camera through alien to center axis (for visualization)
    // This is the POV line - yellow semi-transparent line
    if (window.DEBUG_LINE) {
        scene.remove(window.DEBUG_LINE);
    }
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        camera.position.clone(),
        alienPos.clone(),
        CENTER_AXIS.clone()
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 });
    window.DEBUG_LINE = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(window.DEBUG_LINE);
}

function updateAlienPosition() {
    // Alien position is fixed at 101 blocks from center axis (no movement for now)
    alienGroup.position.copy(alien.position);
    
    // Orient alien to point away from center axis
    const directionFromCenter = alien.position.clone().normalize();
    const angle = Math.atan2(directionFromCenter.x, directionFromCenter.z);
    const tilt = Math.acos(directionFromCenter.y);
    
    // Reset rotation and apply
    alienGroup.rotation.set(0, 0, 0);
    alienGroup.rotateY(angle);
    alienGroup.rotateX(tilt - Math.PI/2);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Handle input
    handleInput();
    
    // Update alien physics
    updateAlien();
    
    // Update alien position and rotation
    updateAlienPosition();
    
    // Update camera to follow alien
    updateCamera();
    
    // Render scene
    renderer.render(scene, camera);
}

function keyPressed(event) {
    if (event.code === 'Space') {
        keys[' '] = true;
        event.preventDefault();
    } else {
        keys[event.key.toLowerCase()] = true;
    }
}

function keyReleased(event) {
    if (event.code === 'Space') {
        keys[' '] = false;
        event.preventDefault();
    } else {
        keys[event.key.toLowerCase()] = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(800, 600);
}

// Start the application
init();

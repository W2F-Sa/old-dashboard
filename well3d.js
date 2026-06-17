// Enhanced 3D Well Visualization Module - Copied from well3d.html
class Enhanced3DWellVisualization {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.waterMesh = null;
        this.waterSurface = null;
        this.waterLevelIndicator = null;
        this.waterLevelText = null;
        this.waterLevelLabel = null;
        this.animationId = null;
        this.wellGroup = null;
        this.waterPlane = null;
        this.waterRing = null;
        this.waterLabel = null;
        this.bucketGroup = null;
        this.bucketBody = null;
        this.ropeLine = null;
        this.rulerGroup = null;
        this.waterSurfaceRing = null;
        
        // Parameters (1 unit = 1 meter)
        this.WELL_DEPTH = 30;
        this.WELL_RADIUS = 1;
        this.LAYER_INNER_RADIUS = 1.6;
        
        // For clearer view, apply a sectional cut on cylinders
        this.OPENING = Math.PI * 0.6; // Size of opening (about 108°)
        this.THETA_START = -Math.PI * 0.1; // Opening direction towards camera
        this.THETA_LEN = Math.PI * 2 - this.OPENING;
        
        this.layers = [
            { name: 'topsoil', thickness: 6, color: 0x8B4513, pattern: 'noise' },
            { name: 'clay', thickness: 8, color: 0xCD853F, pattern: 'stripes' },
            { name: 'sand', thickness: 7, color: 0xDEB887, pattern: 'dots' },
            { name: 'rock', thickness: 9, color: 0x808080, pattern: 'blotches' },
        ]; // Total = 30 meters
        
        this.init();
    }
    
    init() {
        // Self-tests
        console.assert(THREE && typeof THREE.Scene === 'function', '❌ three.js load failed');
        console.assert(typeof OrbitControls === 'function', '❌ OrbitControls not available');
        
        // Look for the canvas element instead of threejs-container
        const canvas = document.getElementById('stage');
        if (!canvas) {
            console.error('❌ stage canvas not found');
            return;
        }
        
        // Use the parent container for sizing
        const container = canvas.parentElement;
        
        console.log('✅ Self-tests passed: three + OrbitControls + container');
        
        // Scene, Camera, Renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xeef2ff);
        
        this.camera = new THREE.PerspectiveCamera(55, container.clientWidth / canvas.clientHeight, 0.1, 1200);
        this.camera.position.set(6, 15, 10); // Higher and slightly further camera position to see full well and water indicators
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            canvas: canvas  // Use the existing canvas
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth, canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, -this.WELL_DEPTH/2, 0);
        this.controls.minDistance = 5;
        this.controls.maxDistance = 60;
        this.controls.maxPolarAngle = Math.PI * 0.75; // Increased to see higher water levels
        this.controls.minPolarAngle = Math.PI * 0.1; // Allow looking more downward
        
        // Lighting
        this.setupLighting();
        
        // Create the well structure
        this.createWellStructure();
        
        // Start animation loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);
        
        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(8, 14, 6);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        this.scene.add(directionalLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.4);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
        
        // Hemisphere light for natural outdoor lighting
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.3);
        this.scene.add(hemisphereLight);
    }
    
    createWellStructure() {
        // Create ground with hole for well
        this.createGroundWithHole();
        
        // Create grid helper
        this.createGridHelper();
        
        // Create main well group
        this.wellGroup = new THREE.Group();
        this.scene.add(this.wellGroup);
        
        // Create soil layers
        this.createSoilLayers();
        
        // Create well lining
        this.createWellLining();
        
        // Create well rim
        this.createWellRim();
        
        // Create water system
        this.createWaterSystem();
        
        // Create bucket system
        this.createBucketSystem();
        
        // Create depth ruler
        this.createDepthRuler();
    }
    
    createGroundWithHole() {
        const groundShape = new THREE.Shape();
        groundShape.moveTo(-6, -6);
        groundShape.lineTo(6, -6);
        groundShape.lineTo(6, 6);
        groundShape.lineTo(-6, 6);
        groundShape.lineTo(-6, -6);
        
        const hole = new THREE.Path();
        hole.absellipse(0, 0, this.LAYER_INNER_RADIUS * 1.05, this.LAYER_INNER_RADIUS * 1.05, 0, Math.PI * 2, false, 0);
        groundShape.holes.push(hole);
        
        const groundGeom = new THREE.ShapeGeometry(groundShape, 64);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x7fbf7f, 
            roughness: 1, 
            metalness: 0 
        });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0.001;
        this.scene.add(ground);
    }
    
    createGridHelper() {
        const grid = new THREE.GridHelper(20, 20, 0x94a3b8, 0xcbd5e1);
        grid.position.y = -this.WELL_DEPTH;
        this.scene.add(grid);
    }
    
    createSoilLayers() {
        let accDepth = 0;
        
        this.layers.forEach((layer) => {
            const geom = new THREE.CylinderGeometry(
                this.LAYER_INNER_RADIUS,
                this.LAYER_INNER_RADIUS,
                layer.thickness,
                96,
                1,
                true,
                this.THETA_START,
                this.THETA_LEN
            );
            
            const map = this.textureFor(layer.pattern);
            map.repeat.set(8, layer.thickness / 2);
            
            const mat = new THREE.MeshStandardMaterial({
                map: map,
                color: layer.color,
                metalness: 0,
                roughness: 1,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geom, mat);
            const yMid = -(accDepth + layer.thickness / 2);
            mesh.position.set(0, yMid, 0);
            this.wellGroup.add(mesh);
            
            accDepth += layer.thickness;
        });
    }
    
    createWellLining() {
        const liningGeom = new THREE.CylinderGeometry(
            this.WELL_RADIUS,
            this.WELL_RADIUS,
            this.WELL_DEPTH,
            96,
            1,
            true,
            this.THETA_START,
            this.THETA_LEN
        );
        
        const liningMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        const lining = new THREE.Mesh(liningGeom, liningMat);
        lining.position.y = -this.WELL_DEPTH / 2;
        this.wellGroup.add(lining);
    }
    
    createWellRim() {
        const rimGeom = new THREE.TorusGeometry(
            this.WELL_RADIUS,
            0.06,
            16,
            96,
            this.THETA_LEN
        );
        
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
        const rim = new THREE.Mesh(rimGeom, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.rotation.z = this.THETA_START;
        rim.position.y = 0.02;
        this.wellGroup.add(rim);
    }
    
    createWaterSystem() {
        console.log('💧 Creating water system...');
        
        // Water material
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0x0066FF,  // Brighter blue color
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.4,  // Reduced transmission for more visibility
            transparent: true,
            opacity: 0.9,  // Increased opacity
            clearcoat: 0.3,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide  // Render both sides for better visibility
        });
        
        // Water surface indicator
        const waterPlaneMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide
        });
        
        this.waterPlane = new THREE.Mesh(
            new THREE.CircleGeometry(this.LAYER_INNER_RADIUS * 1.1, 64),
            waterPlaneMat
        );
        this.waterPlane.rotation.x = -Math.PI / 2;
        this.wellGroup.add(this.waterPlane);
        
        this.waterRing = new THREE.Mesh(
            new THREE.RingGeometry(
                this.LAYER_INNER_RADIUS * 1.06,
                this.LAYER_INNER_RADIUS * 1.12,
                96,
                1,
                this.THETA_START,
                this.THETA_LEN
            ),
            new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide })
        );
        this.waterRing.rotation.x = -Math.PI / 2;
        this.wellGroup.add(this.waterRing);
        
        // Water level label
        this.waterLabel = this.makeLabelSprite('سطح ایستایی');
        this.wellGroup.add(this.waterLabel);
        
        console.log('💧 Water system created successfully');
        console.log('📊 Well depth:', this.WELL_DEPTH, 'Water plane:', this.waterPlane, 'Water ring:', this.waterRing);
    }
    
    createBucketSystem() {
        this.bucketGroup = new THREE.Group();
        this.wellGroup.add(this.bucketGroup);
        
        // Bucket body
        this.bucketBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.42, 0.45, 32, 1, false, this.THETA_START, this.THETA_LEN),
            new THREE.MeshStandardMaterial({ color: 0x708090, metalness: 0.2, roughness: 0.6 })
        );
        this.bucketBody.position.y = 0;
        this.bucketGroup.add(this.bucketBody);
        
        // Bucket handle
        const handle = new THREE.Mesh(
            new THREE.TorusGeometry(0.28, 0.02, 12, 48, Math.PI),
            new THREE.MeshStandardMaterial({ color: 0x374151 })
        );
        handle.rotation.z = Math.PI;
        handle.position.y = 0.28;
        this.bucketGroup.add(handle);
    }
    
    createDepthRuler() {
        this.rulerGroup = new THREE.Group();
        const rulerX = -(this.LAYER_INNER_RADIUS + 1.6);
        
        // Main ruler line
        const mainLine = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, this.WELL_DEPTH, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x0f172a })
        );
        mainLine.position.set(rulerX, -this.WELL_DEPTH / 2, 0);
        this.rulerGroup.add(mainLine);
        
        // Depth markers
        for (let m = 0; m <= this.WELL_DEPTH; m++) {
            const is5 = (m % 5 === 0);
            const len = is5 ? 0.36 : 0.2;
            
            const tick = new THREE.Mesh(
                new THREE.BoxGeometry(len, 0.03, 0.04),
                new THREE.MeshStandardMaterial({ color: 0x0f172a })
            );
            tick.position.set(rulerX + len / 2, -m, 0);
            this.rulerGroup.add(tick);
            
            if (is5) {
                const labMap = this.makeCanvasLabel(this.toFaDigits(m) + ' متر', 220, 96);
                const lab = new THREE.Sprite(
                    new THREE.SpriteMaterial({ map: labMap, transparent: true })
                );
                lab.scale.set(1.6, 0.8, 1);
                lab.position.set(rulerX + len + 0.7, -m, 0);
                this.rulerGroup.add(lab);
            }
        }
        
        this.scene.add(this.rulerGroup);
    }
    
    // Texture creation functions
    makeCanvas(w = 256, h = 256) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }
    
    texFromCanvas(canvas) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        return tex;
    }
    
    makeNoiseTexture(base = '#6b3f1e', accent = '#8B4513', density = 0.6) {
        const c = this.makeCanvas();
        const ctx = c.getContext('2d');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, c.width, c.height);
        const count = c.width * c.height * density * 0.02;
        for (let i = 0; i < count; i++) {
            const x = Math.random() * c.width, y = Math.random() * c.height;
            const r = 1 + Math.random() * 2;
            ctx.fillStyle = accent;
            ctx.globalAlpha = 0.35 + Math.random() * 0.25;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        return this.texFromCanvas(c);
    }
    
    makeStripesTexture(color = '#b87333', bg = '#cd853f', stripeW = 12) {
        const c = this.makeCanvas();
        const ctx = c.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = color;
        for (let x = -stripeW; x < c.width + stripeW; x += stripeW * 2) {
            ctx.save();
            ctx.translate(x, 0);
            ctx.rotate(-8 * Math.PI / 180);
            ctx.fillRect(0, 0, stripeW, c.height);
            ctx.restore();
        }
        return this.texFromCanvas(c);
    }
    
    makeDotsTexture(dotColor = '#caa874', bg = '#deb887', density = 0.9) {
        const c = this.makeCanvas();
        const ctx = c.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        const count = c.width * c.height * density * 0.015;
        ctx.fillStyle = dotColor;
        for (let i = 0; i < count; i++) {
            const x = Math.random() * c.width, y = Math.random() * c.height;
            const r = Math.random() * 1.8 + 0.3;
            ctx.globalAlpha = 0.7 + Math.random() * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        return this.texFromCanvas(c);
    }
    
    makeBlotchesTexture(base = '#8c8c8c', acc = '#6d6d6d') {
        const c = this.makeCanvas();
        const ctx = c.getContext('2d');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < 120; i++) {
            const x = Math.random() * c.width, y = Math.random() * c.height;
            const w = 10 + Math.random() * 50, h = 6 + Math.random() * 30;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.random() * Math.PI);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h));
            grad.addColorStop(0, acc);
            grad.addColorStop(1, base);
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.35 + Math.random() * 0.35;
            ctx.beginPath();
            ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        return this.texFromCanvas(c);
    }
    
    textureFor(pattern) {
        switch (pattern) {
            case 'noise': return this.makeNoiseTexture();
            case 'stripes': return this.makeStripesTexture();
            case 'dots': return this.makeDotsTexture();
            case 'blotches': return this.makeBlotchesTexture();
            default: return this.makeNoiseTexture();
        }
    }
    
    makeCanvasLabel(text, w = 256, h = 128) {
        const c = this.makeCanvas(w, h);
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(15,23,42,0.8)';
        const r = 14;
        const bx = 12, by = 36, bw = w - 24, bh = 56;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 34px Tahoma';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, by + bh / 2 + 2);
        return this.texFromCanvas(c);
    }
    
    makeLabelSprite(text) {
        const tex = this.makeCanvasLabel(text);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const s = new THREE.Sprite(mat);
        s.scale.set(2.4, 1.2, 1);
        return s;
    }
    
    toFaDigits(numStr) {
        return String(numStr).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    }
    
    // Water system methods
    createOrUpdateWater(height) {
        console.log('💧 Creating/updating water with height:', height);
        
        if (this.waterMesh) {
            this.wellGroup.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
        }
        
        const h = Math.max(0.01, height);
        console.log('💧 Final water height:', h, 'Well depth:', this.WELL_DEPTH);
        
        const geom = new THREE.CylinderGeometry(
            this.WELL_RADIUS * 0.92,
            this.WELL_RADIUS * 0.92,
            h,
            96,
            1,
            false,
            this.THETA_START,
            this.THETA_LEN
        );
        
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0x29B6F6,
            metalness: 0,
            roughness: 0.1,
            transmission: 0.65,
            transparent: true,
            opacity: 0.95,
            clearcoat: 0.4,
            clearcoatRoughness: 0.05
        });
        
        this.waterMesh = new THREE.Mesh(geom, waterMat);
        this.waterMesh.position.y = -this.WELL_DEPTH + h / 2;
        this.wellGroup.add(this.waterMesh);
        
        console.log('💧 Water mesh created at position y:', this.waterMesh.position.y);
    }
    
    createWaterSurfaceRing(waterHeight) {
        // Prevent rapid recreation - check if height changed significantly
        if (this.lastRingHeight !== undefined && 
            Math.abs(waterHeight - this.lastRingHeight) < 0.01) {
            console.log('Water surface ring height change too small, skipping recreation');
            return;
        }
        
        // Remove existing ring if it exists
        if (this.waterSurfaceRing) {
            this.wellGroup.remove(this.waterSurfaceRing);
            this.waterSurfaceRing.geometry.dispose();
            this.waterSurfaceRing.material.dispose();
        }
        
        // Create a more visible ring at the water surface
        const ringGeometry = new THREE.RingGeometry(
            this.WELL_RADIUS * 0.80,
            this.WELL_RADIUS * 1.0,
            64  // More segments for smoother appearance
        );
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00FFFF,  // Bright cyan color
            transparent: true,
            opacity: 0.9,  // Slightly transparent for better visual effect
            side: THREE.DoubleSide
        });
        
        this.waterSurfaceRing = new THREE.Mesh(ringGeometry, ringMaterial);
        // Position at water surface with slight offset for visibility
        this.waterSurfaceRing.position.y = -this.WELL_DEPTH + Math.min(waterHeight + 0.02, this.WELL_DEPTH - 0.1);
        this.waterSurfaceRing.rotation.x = -Math.PI / 2; // Rotate to horizontal
        
        this.wellGroup.add(this.waterSurfaceRing);
        this.lastRingHeight = waterHeight;
        console.log('💍 Enhanced water surface ring created at position y:', this.waterSurfaceRing.position.y);
    }
    
    createWaterLevelLabel(waterHeight, originalHeight = null) {
        // Prevent rapid recreation - check if height changed significantly
        if (this.lastLabelHeight !== undefined && 
            Math.abs(waterHeight - this.lastLabelHeight) < 0.01) {
            console.log('Water level label height change too small, skipping recreation');
            return;
        }
        
        // Remove existing label if it exists
        if (this.waterLevelLabel) {
            this.wellGroup.remove(this.waterLevelLabel);
        }
        
        // Create enhanced text sprite for water level
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 320;  // Larger canvas for better visibility
        canvas.height = 80;
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background with gradient
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 150, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 100, 200, 0.9)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Rounded corners effect
        context.fillStyle = 'rgba(255, 255, 255, 0.2)';
        context.fillRect(0, 0, canvas.width, 10);
        context.fillRect(0, canvas.height - 10, canvas.width, 10);
        
        // Border with rounded corners
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;
        context.lineJoin = 'round';
        context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Enhanced text
        context.font = 'bold 32px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowBlur = 4;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        
        // Show original value with units if it was converted
        const displayValue = originalHeight && originalHeight > 30 ? originalHeight : waterHeight;
        const displayUnit = originalHeight && originalHeight > 30 ? 'cm' : 'm';
        context.fillText(`${displayValue.toFixed(1)}${displayUnit}`, canvas.width / 2, canvas.height / 2);
        
        // Reset shadow
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Create texture and sprite
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;  // Better quality for scaling
        texture.magFilter = THREE.LinearFilter;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
        this.waterLevelLabel = new THREE.Sprite(spriteMaterial);
        
        // Position the label with better visibility
        this.waterLevelLabel.position.set(
            this.WELL_RADIUS + 1.8, 
            -this.WELL_DEPTH + Math.min(waterHeight + 0.8, this.WELL_DEPTH - 1), 
            0
        );
        
        // Scale the label larger for better visibility
        this.waterLevelLabel.scale.set(2.5, 0.6, 1);
        
        this.wellGroup.add(this.waterLevelLabel);
        this.lastLabelHeight = waterHeight;
        console.log('🏷️ Enhanced water level label created showing:', displayValue.toFixed(1), displayUnit);
    }
    
    updateWaterTable(y) {
        if (this.waterPlane) this.waterPlane.position.y = y;
        if (this.waterRing) this.waterRing.position.y = y;
        if (this.waterLabel) this.waterLabel.position.set(this.LAYER_INNER_RADIUS * 1.25, y + 0.01, 0);
    }
    
    updateRope(toY) {
        if (this.ropeLine) {
            this.wellGroup.remove(this.ropeLine);
            this.ropeLine.geometry.dispose();
        }
        
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, toY + 0.3, 0)
        ];
        
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x8B4513 });
        this.ropeLine = new THREE.Line(geom, mat);
        this.wellGroup.add(this.ropeLine);
    }
    
    // Update methods
    updateWaterLevel(waterHeight) {
        console.log('🌊 Updating water level to:', waterHeight, 'meters');
        console.log('📊 Well depth:', this.WELL_DEPTH, 'Well radius:', this.WELL_RADIUS);
        
        // Prevent rapid updates - if water level hasn't changed significantly, skip
        const SIGNIFICANT_CHANGE_THRESHOLD = 0.01; // 1cm threshold
        if (this.lastWaterHeight !== undefined && 
            Math.abs(waterHeight - this.lastWaterHeight) < SIGNIFICANT_CHANGE_THRESHOLD) {
            console.log('Water level change too small, skipping update');
            return;
        }
        
        // Store current water height for comparison
        this.lastWaterHeight = waterHeight;
        
        // Convert water level from cm to meters if it's > 30 (likely in cm)
        let actualWaterHeight = waterHeight;
        let wasConverted = false;
        if (waterHeight > 30) {
            actualWaterHeight = waterHeight / 100; // Convert cm to meters
            wasConverted = true;
            console.log('📏 Converted water level from cm to meters:', waterHeight, 'cm ->', actualWaterHeight, 'm');
        }
        
        // Ensure water height is within valid range (0 to well depth)
        const clampedWaterHeight = Math.max(0.1, Math.min(actualWaterHeight, this.WELL_DEPTH * 0.9));
        console.log('🔒 Clamped water height:', clampedWaterHeight, 'meters');
        
        this.createOrUpdateWater(clampedWaterHeight);
        const waterSurfaceDepth = this.WELL_DEPTH - clampedWaterHeight;
        this.updateWaterTable(-waterSurfaceDepth);
        
        // Update the visual indicators
        this.createWaterSurfaceRing(clampedWaterHeight);
        this.createWaterLevelLabel(clampedWaterHeight, wasConverted ? waterHeight : null);
        
        console.log('✅ Water level updated successfully to:', clampedWaterHeight, 'meters (original:', waterHeight, 'm)');
    }
    
    updateBucketDepth(bucketDepth) {
        const bucketY = -bucketDepth;
        if (this.bucketGroup) this.bucketGroup.position.set(0, bucketY, 0);
        
        // Check if bucket is submerged
        const waterHeight = this.waterMesh ? this.waterMesh.geometry.parameters.height : 0;
        const waterSurfaceDepth = this.WELL_DEPTH - waterHeight;
        const isSubmerged = bucketDepth > waterSurfaceDepth;
        
        if (this.bucketBody) {
            this.bucketBody.material.color.set(isSubmerged ? 0x4FC3F7 : 0x708090);
        }
        
        this.updateRope(bucketY);
    }
    
    updateState(waterHeight, bucketDepth) {
        this.updateWaterLevel(waterHeight);
        this.updateBucketDepth(bucketDepth);
    }
    
    // Animation and resize
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        const canvas = document.getElementById('stage');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = canvas.clientHeight; // use actual canvas height (e.g., 1200px)
        const needResize = this.renderer.domElement.width !== width || this.renderer.domElement.height !== height;
        
        if (needResize) {
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }
    
    // Cleanup
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.controls) {
            this.controls.dispose();
        }
    }
}
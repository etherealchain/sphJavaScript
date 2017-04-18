/*  2D Water Simulation
    based on implementation from Khan Acadmey
*/


window.onload = init;


 // stats box
let stats;
// renderer
let renderer;
let scene,camera,rayCaster;
let rotateRoot;
let baseEdge,leftEdge, rightEdge, tankMaterial;
let cornerEdgeLeft, cornerEdgeRight;
let leftBox, baseBox, rightBox;
let leftBoxOrigin, baseBoxOrigin, rightBoxOrigin;

let screenWidth = 100;
let screenHeight;
let tankWidth = 20;
let tankHeight = 10;
let edgeWidth = 2;
let iterateStep = 5;

let renderScale = 100;
let particleNumber = 400;

// Constants for interaction term
let C0, C1 ,C2;

// Resistance to compression
// speed of sound = sqrt(k / density)
let k = 30;         // Bulk modulus (1000)
let gravity = 3;  // gravity  m/s2
let mu = 3;         // Viscosity (0.1)
let Cp =  15 * k;
let Cv = -40 * mu;

let waterMaterial;
let minColor = new THREE.Color(0.7, 0.86, 0.98);
let maxColor = new THREE.Color(0, 0, 1);
let waterPointInView, waterPointOutView;
let waterMass = 1;
let waterDensity = 1000;    // g/m3
let restitution = 0.8;

let waterSize = 0.011; // diameter
let waterSize2 = waterSize * waterSize;
let waterSize4 = waterSize2 * waterSize2;
let waterSize8 = waterSize4 * waterSize4;
let collisionCheckMargin = waterSize/2*renderScale;

let flowRate = 1;   // particle / seconds
let frameRate = 30; // frame / seconds
let dt = 18e-4; // time step in seconds
let dt2 = dt/2; // half time step in seconds
let lastTimeStamp = 0;

let mouseDownFlag = false;
let setPlaneMatrix = false;
let lastMousePoint;
let rotationRadian = 0;
let waterGate = true;
let mouseThreshold = 10;

let textureLoader = new THREE.TextureLoader();


function init() {

    stats = new Stats();
	document.body.appendChild(stats.dom);
    initGui();

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor( 0xdddddd, 1);
    document.body.appendChild( renderer.domElement );

    scene = new THREE.Scene();
    rayCaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();
    lastMousePoint = new THREE.Vector2();

    screenHeight = window.innerHeight/ window.innerWidth * screenWidth;
    camera = new THREE.OrthographicCamera(
        -screenWidth/2,   // left
        screenWidth/2,    // right
        screenHeight/2,   // top
        -screenHeight/2,  // bottom
        1,                // near
        10                // far
    );
    camera.position.set( 0, 0, 5 );
    camera.lookAt(new THREE.Vector3(0,0,0));

    tankMaterial =  new THREE.MeshLambertMaterial( { color: 0xff0000 } );
    baseEdge = new THREE.Mesh( new THREE.PlaneBufferGeometry( tankWidth, edgeWidth, 1, 1 ), tankMaterial );
    rightEdge = new THREE.Mesh( new THREE.PlaneBufferGeometry( edgeWidth, tankHeight, 1, 1 ), tankMaterial );
    leftEdge = new THREE.Mesh( new THREE.PlaneBufferGeometry( edgeWidth, tankHeight, 1, 1 ), tankMaterial );
    cornerEdgeRight = new THREE.Mesh(new THREE.PlaneBufferGeometry( edgeWidth, edgeWidth, 1, 1 ), tankMaterial);
    cornerEdgeLeft = new THREE.Mesh(new THREE.PlaneBufferGeometry( edgeWidth, edgeWidth, 1, 1 ), tankMaterial);

    baseEdge.position.set(0,-edgeWidth/2,0);
    rightEdge.position.set(tankWidth/2 + edgeWidth/2 , tankHeight/2 ,0);
    cornerEdgeRight.position.set(tankWidth/2 + edgeWidth/2, -edgeWidth/2,0);
    leftEdge.position.set(-tankWidth/2 - edgeWidth/2 , tankHeight/2 ,0);
    cornerEdgeLeft.position.set(-tankWidth/2 - edgeWidth/2, -edgeWidth/2,0);

    rotateRoot = new THREE.Object3D();
    rotateRoot.add(baseEdge);
    rotateRoot.add(rightEdge);
    rotateRoot.add(leftEdge);
    rotateRoot.add(cornerEdgeLeft);
    rotateRoot.add(cornerEdgeRight);
    scene.add(rotateRoot);

     waterMaterial = new THREE.SpriteMaterial({
        color: minColor,
        map: textureLoader.load("data/circle-512.png")
    });
    waterPointInView = [];
    waterPointOutView = [];
    
    leftBox = [];
    leftBox.push(new THREE.Plane(new THREE.Vector3(0,1,0), -tankHeight));               // top
    leftBox.push(new THREE.Plane(new THREE.Vector3(-1,0,0), -tankWidth/2 - edgeWidth)); // left
    leftBox.push(new THREE.Plane(new THREE.Vector3(1,0,0), tankWidth/2));               // right
    leftBox.push(new THREE.Plane(new THREE.Vector3(0,-1,0), -edgeWidth));               // bottom
    leftBoxOrigin = leftBox.slice();
    
    rightBox = [];
    rightBox.push(new THREE.Plane(new THREE.Vector3(0,1,0), -tankHeight));              // top
    rightBox.push(new THREE.Plane(new THREE.Vector3(-1,0,0), tankWidth/2));             // left
    rightBox.push(new THREE.Plane(new THREE.Vector3(1,0,0), -tankWidth/2 - edgeWidth)); // right
    rightBox.push(new THREE.Plane(new THREE.Vector3(0,-1,0), -edgeWidth));              // bottom
    rightBoxOrigin = rightBox.slice();
    
    baseBox = [];
    baseBox.push(new THREE.Plane(new THREE.Vector3(0,1,0)));                            // top
    baseBox.push(new THREE.Plane(new THREE.Vector3(-1,0,0), -tankWidth/2));             // left
    baseBox.push(new THREE.Plane(new THREE.Vector3(1,0,0), -tankWidth/2));              // right
    baseBox.push(new THREE.Plane(new THREE.Vector3(0,-1,0), -edgeWidth));               // bottom
    baseBoxOrigin = baseBox.slice();

    let light = new THREE.DirectionalLight( 0xffffff , 0.5);
    light.position.set(0,0,6);
    scene.add( light );

    initializeSystem();

    window.addEventListener( 'mousemove', onMouseMove, false );
    window.addEventListener( 'mousedown', onMouseDown, false );
    window.addEventListener( 'mouseup', onMouseUp, false );
    window.addEventListener( 'resize', onWindowResize, false );
    animate();
};

function onMouseMove( event ) {

	if(mouseDownFlag){
        let diffX = event.clientX - lastMousePoint.x;
        let diffY = event.clientY - lastMousePoint.y;
        rotationRadian = 0;
        if(diffY >  mouseThreshold){
            rotationRadian = diffY*0.05 * Math.PI /180;
        }

        lastMousePoint.x = event.clientX;
        lastMousePoint.y = event.clientY;
        setPlaneMatrix = true;
    }
}
function onMouseDown( event ) {

    lastMousePoint.x = event.clientX;
    lastMousePoint.y = event.clientY;
    mouseDownFlag = true;
}
function onMouseUp( event ) {
    mouseDownFlag = false;
}

function onWindowResize() {

    renderer.setSize( window.innerWidth, window.innerHeight );
}

// animation
function render(){
   
    renderer.render( scene, camera );
}
function animate() {
    
    // boxHandle();
    // colorHandle();

    let count = 0;
    let millis = new Date().getTime();
    while (count < iterateStep && (new Date().getTime() - millis ) < (1/frameRate *1000) ){
        updateSystem();
        count++;
    }

    let now = new Date().getTime();
    if( waterGate && (now - lastTimeStamp > 200)){
        produceParticle();
        lastTimeStamp = now;
    }

    stats.begin();
    render();
    stats.end();

    
    requestAnimationFrame( animate );
}

function lerp(a,b,u){
     return (1-u) * a + u * b;
}
function lerpColor(amount){
    let r = lerp(minColor.r, maxColor.r, amount);
    let g = lerp(minColor.g, maxColor.g, amount);
    let b = lerp(minColor.b, maxColor.b, amount);

    return new THREE.Color(r,g,b);
}
function colorHandle(){
    // find max density
    let maxD = 0;
    for(let i = waterPointInView.length; i--;){
        if(waterPointInView[i].density > maxD)
            maxD = waterPointInView[i].density;
    }
    for(let i = waterPointInView.length; i--;){
        waterPointInView[i].material.color = lerpColor((waterPointInView[i].density - waterDensity)/maxD);
    }
}
function boxHandle(){

    if(setPlaneMatrix){
        
        let rotationMatrix = new THREE.Matrix4();
        rotationMatrix.set( Math.cos(rotationRadian), -Math.sin(rotationRadian),  0, 0,
                            Math.sin(rotationRadian), Math.cos(rotationRadian),   0, 0,
                            0,                        0,                          1, 0,
                            0,                        0,                          0, 1);
        rotateRoot.applyMatrix(rotationMatrix);
        rotatePlane(rotationMatrix, baseBox, baseBoxOrigin);
        rotatePlane(rotationMatrix, rightBox, rightBoxOrigin);
        rotatePlane(rotationMatrix, leftBox, leftBoxOrigin);

        setPlaneMatrix = false;
    }
}

function rotatePlane(matrix, planeBox, origin){
    let optionalNormalMatrix = new THREE.Matrix3().getNormalMatrix( matrix );
    for(let i = planeBox.length; i--;){
        planeBox[i].applyMatrix4(matrix,optionalNormalMatrix);
    }
}
function updateParticles(){
    let collisions = [];
    let dx, dy, dis;

    // Reset properties and find collisions
    for (let i = waterPointInView.length; i--;) {
        // Reset density
        waterPointInView[i].density = C1;
        // Reset acceleration
        waterPointInView[i].acc.set(0, -gravity);

        // Calculate which particles overlap
        for (let j = i; j--;) {
            dx = waterPointInView[i].pos.x - waterPointInView[j].pos.x;
            dy = waterPointInView[i].pos.y - waterPointInView[j].pos.y;
            dis = dx * dx + dy * dy;
            if (dis < waterSize2) {
                collisions.push([i, j, dx, dy, dis]);   // save collision point and distance
            }
        }
    }

    // Calculate densities
    let density_ij, diff;
    for (i = collisions.length; i--;) {
        diff = waterSize2 - collisions[i][4];
        density_ij = C2 * diff * diff * diff;
        waterPointInView[collisions[i][0]].density += density_ij;
        waterPointInView[collisions[i][1]].density += density_ij;
    }
    
    // TODO: Find max density
    
    // Calculate accelerations
    let indexI, indexJ;
    let q, u, w0, wp, wv, dvx, dvy;
    for (let i = collisions.length; i--;) {
        indexI = collisions[i][0];
        indexJ = collisions[i][1];
        dx = collisions[i][2];
        dy = collisions[i][3];
        dis = collisions[i][4];

        q = Math.sqrt(dis) / waterSize;
        u = 1 - q;
        w0 = C0 * u / (waterPointInView[indexI].density * waterPointInView[indexJ].density);
        wp = w0 * Cp * (waterPointInView[indexI].density + waterPointInView[indexJ].density - (waterDensity*2)) * u / q;
        wv = w0 * Cv;
        
        dvx = waterPointInView[indexI].velocity.x - waterPointInView[indexJ].velocity.x;
        dvy = waterPointInView[indexI].velocity.y - waterPointInView[indexJ].velocity.y;
        
        waterPointInView[indexI].acc.x += wp * dx + wv * dvx;
        waterPointInView[indexI].acc.y += wp * dy + wv * dvy;
        waterPointInView[indexJ].acc.x -= wp * dx + wv * dvx;
        waterPointInView[indexJ].acc.y -= wp * dy + wv * dvy;
    }
}

function leapfrogStep(){
    for (let i = waterPointInView.length; i--;) {
        // Update half step velocity
        waterPointInView[i].halfVelocity.x += waterPointInView[i].acc.x * dt;
        waterPointInView[i].halfVelocity.y += waterPointInView[i].acc.y * dt;
        
        // Update velocity
        waterPointInView[i].velocity.x = waterPointInView[i].halfVelocity.x + waterPointInView[i].acc.x * dt2;
        waterPointInView[i].velocity.y = waterPointInView[i].halfVelocity.y + waterPointInView[i].acc.y * dt2;

        collisionHandle(waterPointInView[i], baseBox);
        collisionHandle(waterPointInView[i], rightBox);
        collisionHandle(waterPointInView[i], leftBox);
        
        // Update position
        waterPointInView[i].pos.x += waterPointInView[i].halfVelocity.x * dt;
        waterPointInView[i].pos.y += waterPointInView[i].halfVelocity.y * dt;
        waterPointInView[i].position.x = waterPointInView[i].pos.x * renderScale;
        waterPointInView[i].position.y = waterPointInView[i].pos.y * renderScale;

        if(waterPointInView[i].position.y < -screenHeight/2 || waterPointInView[i].position.x > screenWidth/2 || waterPointInView[i].position.x < - screenWidth/2){
            waterPointInView[i].position.set(screenWidth*2, screenHeight*2,0);
            waterPointOutView.push(waterPointInView[i]);
            waterPointInView.splice(i,1);
        }
    }
}

function collisionHandle(point, box){

    let disToTop = distanceToPlane(point.position, box[0]);
    let disToLeft = distanceToPlane(point.position, box[1]);
    let disToRight = distanceToPlane(point.position, box[2]);
    let disToBase = distanceToPlane(point.position, box[3]);

    if(disToLeft - collisionCheckMargin < 0 && disToRight - collisionCheckMargin < 0){
        if(disToTop > 0)
            reflectionVelocity(point, box[0]);
        else if(disToBase > 0)
            reflectionVelocity(point, box[3]);
        // else{
        //     if(disToTop > disToBase)
        //         adjustParticlePos(point, box[0]);
        //     else
        //         adjustParticlePos(point, box[3]);
        // }
    }
    if(disToTop - collisionCheckMargin < 0 && disToBase - collisionCheckMargin < 0){
        if(disToLeft > 0)
            reflectionVelocity(point, box[1]);
        else if(disToRight > 0)
            reflectionVelocity(point, box[2]);
        // else{
        //     if(disToLeft > disToRight)
        //         adjustParticlePos(point, box[1]);
        //     else
        //         adjustParticlePos(point, box[2]);
        // }
    }
}

function adjustParticlePos(point, plane){

    let hvdotN = VdotN(point.halfVelocity, plane);
    point.halfVelocity.x -= plane.normal.x*hvdotN; 
    point.halfVelocity.y -= plane.normal.y*hvdotN; 

    point.velocity.x = point.halfVelocity.x + point.acc.x * dt2 ;
    point.velocity.y = point.halfVelocity.y + point.acc.y * dt2 ;
}

function reflectionVelocity(point, plane){

     // avoid penetration with tank
    let hvdotN = VdotN(point.halfVelocity, plane);
    let remove = hvdotN *dt * renderScale + (distanceToPlane(point.position, plane));
    if(remove < (waterSize/2 * renderScale)){

        point.halfVelocity.x -= (1 + restitution)* plane.normal.x*hvdotN ;
        point.halfVelocity.y -= (1 + restitution)* plane.normal.y*hvdotN ;

        point.velocity.x = point.halfVelocity.x + point.acc.x * dt2 ;
        point.velocity.y = point.halfVelocity.y + point.acc.y * dt2 ;
    }
}
function VdotN(velocity, plane){
    return velocity.x*plane.normal.x + velocity.y*plane.normal.y;
}
function distanceToPlane(position, plane){
    return position.x * plane.normal.x + position.y * plane.normal.y + plane.constant;
}

function updateSystem(){
    updateParticles();
    leapfrogStep();
}

function normalizeMass(){
    let densitySum = 0, densitySum2 = 0;
    
    waterMass = 1;
    for(let i = 0 ; i < waterPointOutView.length; i++){
        // initlize density
        waterPointOutView[i].density = 4 * waterMass / (Math.PI * waterSize2);

        densitySum2 += waterPointOutView[i].density * waterPointOutView[i].density;
        densitySum += waterPointOutView[i].density;
    }

    waterMass = waterDensity * densitySum / densitySum2;
    C0 = waterMass / (Math.PI * waterSize4);
    C1 = 4 * waterMass / (Math.PI * waterSize2);
    C2 = 4 * waterMass /(Math.PI * waterSize8);

}

function initializeSystem(){

    for(let i = 0 ; i < particleNumber; i ++){
        createParticle();
    }
    normalizeMass();
}

function produceParticle(){
    if(waterPointOutView.length > 0){
        let particle = waterPointOutView[0];
        // reset position
        particle.position.set( 0 , tankHeight*3 ,0);
        particle.pos.set(particle.position.x/ renderScale , particle.position.y/renderScale );

        // Reset acceleration
        particle.acc.set(0,-gravity);
        // reset velocity
        particle.velocity.set((Math.random()*2-1)/5, -Math.random()/10);
        particle.halfVelocity.x = particle.velocity.x + particle.acc.x *dt2;
        particle.halfVelocity.y = particle.velocity.y + particle.acc.y *dt2;
        
        particle.velocity.x = particle.acc.x*dt2;
        particle.velocity.y = particle.acc.y*dt2;

        waterPointInView.push(particle);
        waterPointOutView.splice(0,1);
    }
}

function createParticle(){
    let sprite = new THREE.Sprite( waterMaterial );

    let dx = -Math.random()/2;
    let dy = -Math.random()/2;
    sprite.velocity = new THREE.Vector2(dx,dy);
    sprite.density = 0;
    sprite.acc = new THREE.Vector2(0, -gravity);
    sprite.halfVelocity = new THREE.Vector2();
    sprite.pos = new THREE.Vector2();
    sprite.scale.set(waterSize * renderScale, waterSize * renderScale,1);

    // Update half step velocity
    sprite.halfVelocity.x = sprite.velocity.x + sprite.acc.x *dt2;
    sprite.halfVelocity.y = sprite.velocity.y + sprite.acc.y *dt2;
    // Update velocity
    sprite.velocity.x = sprite.acc.x*dt2;
    sprite.velocity.y = sprite.acc.y*dt2;

    sprite.position.set(screenWidth*2, screenHeight*2,0);
    waterPointOutView.push(sprite);
    scene.add(sprite);
}

function initGui () {

    var api = {
        'Water Gate': true,
        'Box Rotate': 0.0
    };

    var gui = new dat.GUI();
    gui.add( api, 'Water Gate' ).onChange( function () {
        waterGate = api[ 'Water Gate' ];
    } );

    // gui.add( api, 'Box Rotate',0.0 , Math.PI*2 ).step(0.1).onChange( function () {

    //     rotationRadian = api['Box Rotate'];
    //     setPlaneMatrix = true;

    // } );
}

// function arrangeParticle(){

//     let h = tankHeight*2;
//     let w = tankWidth/2;
//     let x = -w/2,y = h;
//     for(let i =0; i < waterPointCloud.length; i++){
//         waterPointCloud[i].position.set(x,y,0);
//         waterPointCloud[i].pos.x = waterPointCloud[i].position.x / renderScale;
//         waterPointCloud[i].pos.y = waterPointCloud[i].position.y / renderScale;
//         x += (waterSize*renderScale);
//         if(x > w/2){
//             y+=(waterSize*renderScale);
//             x = -w;
//         }
//     }
// }
// ====== Imports ======

import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.8.1/dist/ox-sdk.esm.js";

// ====== Onirix SDK ======

const OX = new OnirixSDK(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyMzMyLCJwcm9qZWN0SWQiOjg2Mzg2LCJyb2xlIjozLCJpYXQiOjE3MjQxMzQzOTR9.mdCZVPOq_G410PqY3yjqtlhOahxUrQKUIpth11jSxQ4"
);

var renderer, scene, camera, floor, raycaster, started, modelCreated, model;

AFRAME.registerComponent("onirix-sdk", {
    init: function () {
        const custumEventDetail = {
            message: 'Onirix SDK started',
        };

        window.parent.postMessage(custumEventDetail, '*');
        
        window.addEventListener('message', (event) => {
            const message = event.data;
          
            if (message.action === 'play') {
              resumeAnimation();
            } else if (message.action === 'pause') {
              pauseAnimation();
            } else if (message.action === 'stop') {
              stopAnimation();
            } else if (message.action === 'delete') {
                deleteModel();
            } else if (message.action === 'setTime') {
                setTimeAnimation(message.time);
            }
          });
          
        
        renderer = this.el.renderer;
        renderer.punctualLights = true;
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.coloSpace = THREE.SRGBColorSpace;
        renderer.toneMappingExposure = Math.pow(2, 0)
        renderer.shadowMap.enabled = true;  
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

        scene = this.el.sceneEl;
        camera = document.getElementById("camera");
        camera.object3D.matrixAutoUpdate = false;
        floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.ShadowMaterial({
                opacity: 0.5 
            })
        );

        // Rotate floor to be horizontal and place it 1 meter below camera
        floor.rotateX(-Math.PI / 2);
        floor.position.set(0, -1, 0);

        floor.receiveShadow = true; 
        scene.object3D.add(floor); 

        floor.updateMatrixWorld(true);
        raycaster = new THREE.Raycaster();

        modelCreated = false;

        const config = {
            mode: OnirixSDK.TrackingMode.Surface,
            renderCanvas: this.el.canvas,
            disableWebXR: true
        };


        var checkInterval = setInterval(function() {
            let isLanguage = localStorage.getItem('language');

            var dialog = document.getElementById('ox-permissions-dialog');
            if (dialog != null) {
                dialog.style.border = '1px solid #000';
            }
            if(isLanguage === 'en') {
                clearInterval(checkInterval);
                return;
            }

            if (dialog != null) {
                clearInterval(checkInterval); 
                dialog.style.display = 'none';
        
                document.getElementById('ox-permissions-dialog-title').innerText = '모션 센서 접근 권한 필요';
                document.getElementById('ox-permissions-dialog-message').innerText = '이 AR 경험을 위해 휴대폰 모션 센서 접근 권한이 필요합니다. 브라우저에서 권한을 허용하세요.';
                document.getElementById('ox-permissions-dialog-ok-button').innerText = '확인';
        
                dialog.style.display = 'block';
            }
        }, 10);

        OX.init(config)
            .then((_) => {
                const custumEventDetail = {
                    message: 'Onirix SDK initialized',
                };

                window.parent.postMessage(custumEventDetail, '*');

                started = false;

                // Force resize to setup camera projection and renderer size
                onResize();

                // All loaded, so hide loading screen
                document.getElementById("loading-screen").style.display = "none";

                // Subscribe to events
                OX.subscribe(OnirixSDK.Events.OnPose, function (pose) {
                    updatePose(pose);
                });

                OX.subscribe(OnirixSDK.Events.OnResize, function () {
                    onResize();
                });

                OX.subscribe(OnirixSDK.Events.OnTouch, function (touchPos) {
                    onTouch(touchPos);
                });

            }).catch((error) => {

                console.error(error);

                // An error ocurred, chech error type and display it
                document.getElementById("loading-screen").style.display = 'none';

                switch (error.name) {

                    case 'INTERNAL_ERROR':
                        document.getElementById("error-title").innerText = 'Internal Error';
                        document.getElementById("error-message").innerText = 'An unespecified error has occurred. Your device might not be compatible with this experience.';
                        break;

                    case 'CAMERA_ERROR':
                        document.getElementById("error-title").innerText = 'Camera Error';
                        document.getElementById("error-message").innerText = 'Could not access to your device\'s camera. Please, ensure you have given required permissions from your browser settings.';
                        break;

                    case 'SENSORS_ERROR':
                        document.getElementById("error-title").innerText = 'Sensors Error';
                        document.getElementById("error-message").innerText = 'Could not access to your device\'s motion sensors. Please, ensure you have given required permissions from your browser settings.';
                        break;

                    case 'LICENSE_ERROR':
                        document.getElementById("error-title").innerText = 'License Error';
                        document.getElementById("error-message").innerText = 'This experience does not exist or has been unpublished.';
                        break;
                }

                document.getElementById("error-screen").style.display = 'flex';

            });
    }
});

function updatePose(pose) {
    let modelViewMatrix = new THREE.Matrix4();
    modelViewMatrix = modelViewMatrix.fromArray(pose);
    camera.object3D.matrix = modelViewMatrix;
    camera.object3D.matrixWorldNeedsUpdate = true;
}

function onResize() {
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const cameraParams = OX.getCameraParameters();
    camera.object3DMap.camera.fov = cameraParams.fov;
    camera.object3DMap.camera.aspect = cameraParams.aspect;
    camera.object3DMap.camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function onTouch(touchPos) {
    raycaster.setFromCamera(touchPos, camera.object3DMap.camera);
    const intersects = raycaster.intersectObject(floor);
    if (intersects.length > 0) {
        if (!modelCreated) {
            model = document.createElement("a-entity");
            model.setAttribute("gltf-model", "#bearModel");
            model.setAttribute("scale", "2 2 2"); 
            model.setAttribute("animation-mixer", "clip: *; loop: repeat"); 
            model.setAttribute("shadow", "cast: true; receive: false"); 
            
            scene.appendChild(model);
            modelCreated = true;

            const customEventDetail = {
                message: 'Tracking has started',
            };
      
            window.parent.postMessage(customEventDetail, '*');
        }

        model.object3D.position.set(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);

        model.object3D.rotation.y = Math.atan2((camera.object3D.position.x - model.object3D.position.x), (camera.object3D.position.z - model.object3D.position.z));

        if (!started) {
            OX.start();
            started = true;
        }
    }
}

function pauseAnimation() {
    if (model && model.hasAttribute('animation-mixer')) {
        let animationMixer = model.components['animation-mixer'];
        if (animationMixer.mixer) {
            animationMixer.mixer.timeScale = 0; 
        }
    }
}

function resumeAnimation() {
    if (model && model.hasAttribute('animation-mixer')) {
        let animationMixer = model.components['animation-mixer'];
        if (animationMixer.mixer) {
            animationMixer.mixer.timeScale = 1; 
        }
    }
}

function stopAnimation() {
    if (model && model.hasAttribute('animation-mixer')) {
        let animationMixer = model.components['animation-mixer'];
        if (animationMixer.mixer) {
            animationMixer.mixer.stopAllAction(); 
        }
    }
}

function setTimeAnimation(time) {
    if (model && model.hasAttribute('animation-mixer')) {
        let animationMixer = model.components['animation-mixer'];
        if (animationMixer.mixer) {
            animationMixer.mixer.setTime(time); 
        }
    }
}

function deleteModel() {
    if (model) {
        model.parentNode.removeChild(model);
        modelCreated = false;
    }
}

setTimeout(() => {
        AFRAME.scenes[0].setAttribute("onirix-sdk", "");
}, 1000);

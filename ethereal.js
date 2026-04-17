function mapRange(value, fromLow, fromHigh, toLow, toHigh) {
    if (fromLow === fromHigh) return toLow;
    return toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow);
}

class EtherealShadow extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.animateShadow();
    }

    render() {
        const id = "shadow-" + Math.random().toString(36).substr(2, 9);
        const sizing = this.getAttribute('sizing') || 'fill';
        const color = this.getAttribute('color') || 'rgba(128, 128, 128, 1)';
        const scale = parseFloat(this.getAttribute('scale')) || 100;
        const speed = parseFloat(this.getAttribute('speed')) || 50;
        const noiseOpacity = parseFloat(this.getAttribute('noise-opacity')) || 1;
        const noiseScale = parseFloat(this.getAttribute('noise-scale')) || 1.25;

        const displacementScale = mapRange(scale, 1, 100, 20, 100);
        this.animationDuration = mapRange(speed, 1, 100, 1000, 50);

        const baseFreqX = mapRange(scale, 0, 100, 0.001, 0.0005);
        const baseFreqY = mapRange(scale, 0, 100, 0.004, 0.002);

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: fixed;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background-color: var(--ethereal-bg, #000);
                    z-index: 0;
                }
                .container {
                    position: absolute;
                    inset: -${displacementScale}px;
                    filter: url(#${id}) blur(4px);
                    opacity: var(--ethereal-opacity, 1);
                    transition: opacity 0.3s ease;
                }
                .mask {
                    background-color: var(--ethereal-shadow-color, ${color});
                    -webkit-mask-image: url('https://framerusercontent.com/images/ceBGguIpUU8luwByxuQz79t7To.png');
                    mask-image: url('https://framerusercontent.com/images/ceBGguIpUU8luwByxuQz79t7To.png');
                    -webkit-mask-size: ${sizing === "stretch" ? "100% 100%" : "cover"};
                    mask-size: ${sizing === "stretch" ? "100% 100%" : "cover"};
                    -webkit-mask-repeat: no-repeat;
                    mask-repeat: no-repeat;
                    -webkit-mask-position: center;
                    mask-position: center;
                    width: 100%;
                    height: 100%;
                    transition: background-color 0.3s ease;
                }
                .content-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    z-index: 10;
                    width: 100%;
                    height: 100%;
                }
                .noise {
                    position: absolute;
                    inset: 0;
                    background-image: url("https://framerusercontent.com/images/g0QcWrxr87K0ufOxIUFBakwYA8.png");
                    background-size: ${noiseScale * 200}px;
                    background-repeat: repeat;
                    opacity: calc(var(--ethereal-opacity, 1) * ${noiseOpacity / 2});
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                }
            </style>

            <div class="container">
                <svg style="position: absolute; width: 0; height: 0;">
                    <defs>
                        <filter id="${id}">
                            <feTurbulence result="undulation" numOctaves="2" baseFrequency="${baseFreqX},${baseFreqY}" seed="0" type="turbulence" />
                            <feColorMatrix id="hue-rotate" in="undulation" type="hueRotate" values="180" />
                            <feColorMatrix in="dist" result="circulation" type="matrix" values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0" />
                            <feDisplacementMap in="SourceGraphic" in2="circulation" scale="${displacementScale}" result="dist" />
                            <feDisplacementMap in="dist" in2="undulation" scale="${displacementScale}" result="output" />
                        </filter>
                    </defs>
                </svg>
                <div class="mask"></div>
            </div>

            ${noiseOpacity > 0 ? `<div class="noise"></div>` : ''}
            
            <div class="content-overlay">
                <slot></slot>
            </div>
        `;
        
        this.hueMatrix = this.shadowRoot.getElementById('hue-rotate');
    }

    animateShadow() {
        if (!this.hueMatrix) return;
        
        const durationSecs = this.animationDuration / 25;
        const degreesPerSec = 360 / durationSecs;
        
        let lastTime = performance.now();
        let hue = 0;

        const loop = (time) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;
            
            hue = (hue + degreesPerSec * dt) % 360;
            this.hueMatrix.setAttribute('values', hue);
            
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

customElements.define('ethereal-shadow', EtherealShadow);

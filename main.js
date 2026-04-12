const video = document.querySelector("#video");
const masks = document.querySelectorAll(".maskContainer");
const globalHud = document.querySelector(".globalHud");
let isHoveringMask = false;

const state = new Map();
const ctxCache = new Map();

let mouseX = 0, mouseY = 0;

const vertSrc = `
    attribute vec2 position;
    varying vec2 vTexCoord;
    void main() {
        vTexCoord = vec2(position.x * 0.5 + 0.5, 1.0 - (position.y * 0.5 + 0.5));
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragSrc = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec2 uBoxPos;
    uniform vec2 uBoxSize;
    uniform float uDw;
    uniform float uDh;
    uniform float uDx;
    uniform float uDy;
    varying vec2 vTexCoord;

    void main() {
        // boxのピクセル座標
        vec2 pixelPos = uBoxPos + vTexCoord * uBoxSize;

        // 動画のUV座標に変換（2DのdrawClippedと同じ計算）
        float u = (pixelPos.x - uDx) / uDw;
        float v = (pixelPos.y - uDy) / uDh;

        gl_FragColor = texture2D(uTexture, vec2(u,v));
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
    const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    return program;
}

function initWebGL(canvas) {
    const gl = canvas.getContext("webgl");
    const program = createProgram(gl, vertSrc, fragSrc);
    gl.useProgram(program);

    const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    const texLoc = gl.getUniformLocation(program, "uTexture");
    gl.uniform1i(texLoc, 0);

    const uBoxPos = gl.getUniformLocation(program, "uBoxPos");
    const uBoxSize = gl.getUniformLocation(program, "uBoxSize");
    const uDw = gl.getUniformLocation(program, "uDw");
    const uDh = gl.getUniformLocation(program, "uDh");
    const uDx = gl.getUniformLocation(program, "uDx");
    const uDy = gl.getUniformLocation(program, "uDy");

    return { gl, texture, program, uBoxPos, uBoxSize, uDw, uDh, uDx, uDy };
}

document.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isHoveringMask) {
        globalHud.innerHTML = `X: ${mouseX}px <br/> Y: ${mouseY}px`;
    }

    globalHud.style.transform = `translate3d(${mouseX + 2}px, ${mouseY + 2}px, 0)`
});

function updateCoords(mask) {
    const s = state.get(mask);
    mask.querySelector(".coords").textContent = `X: ${Math.round(s.x)}px Y:${Math.round(s.y)}px`;
}

function drawClipped(ctx, video, rect) {
    const videoAspect = video.videoWidth / video.videoHeight;
    const windowAspect = window.innerWidth / window.innerHeight;

    let dw, dh, dx, dy;

    if (videoAspect > windowAspect) {
        dh = window.innerHeight;
        dw = dh * videoAspect;
        dx = (window.innerWidth - dw) / 2;
        dy = 0;
    } else {
        dw = window.innerWidth;
        dh = dw / videoAspect;
        dx = 0;
        dy = (window.innerHeight - dh) / 2;
    }

    const scaleX = video.videoWidth / dw;
    const scaleY = video.videoHeight / dh;

    ctx.drawImage(
        video,
        (rect.x - dx) * scaleX,
        (rect.y - dy) * scaleY,
        rect.w * scaleX,
        rect.h * scaleY,
        0,
        0,
        rect.w,
        rect.h,
    );
}

function calcVideoLayout() {
    const videoAspect = video.videoWidth / video.videoHeight;
    const windowAspect = window.innerWidth / window.innerHeight;

    let dw, dh, dx, dy;

    if (videoAspect > windowAspect) {
        dh = window.innerHeight;
        dw = dh * videoAspect;
        dx = (window.innerWidth - dw) / 2;
        dy = 0;
    } else {
        dw = window.innerWidth;
        dh = dw / videoAspect;
        dx = 0;
        dy = (window.innerHeight - dh) / 2;
    }

    return { dw, dh, dx, dy };
}

function drawWebGL(cache, video, rect) {
    const { gl, texture, uBoxPos, uBoxSize, uDw, uDh, uDx, uDy } = cache;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    const { dw, dh, dx, dy } = calcVideoLayout();

    gl.uniform2f(uBoxPos, rect.x, rect.y);
    gl.uniform2f(uBoxSize, rect.w, rect.h);
    gl.uniform1f(uDw, dw);
    gl.uniform1f(uDh, dh);
    gl.uniform1f(uDx, dx);
    gl.uniform1f(uDy, dy);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function initMasks() {
    masks.forEach((mask, i) => {
        const r = mask.getBoundingClientRect();

        state.set(mask, {
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
            dragging: false,
            ox: 0,
            oy: 0,
            isWebGL: i === 0
        });

        mask.style.left = "0";
        mask.style.top = "0";
        mask.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;

        mask.addEventListener("mouseenter", () => {
            isHoveringMask = true;
            globalHud.textContent = "GRAB";
        });
        mask.addEventListener("mouseleave", () => {
            isHoveringMask = false;
        });
    });
}

function initCanvases() {
    masks.forEach((mask) => {
        const s = state.get(mask);
        const canvas = mask.querySelector("canvas");
        canvas.width = s.w;
        canvas.height = s.h;

        if (s.isWebGL) {
            const webglData = initWebGL(canvas);
            ctxCache.set(mask, { ...webglData, isWebGL: true });
        } else {
            ctxCache.set(mask, { ctx: canvas.getContext("2d"), isWebGL: false });
        }
    });
}

function draw() {
    masks.forEach(mask => {
        const s = state.get(mask);
        const cache = ctxCache.get(mask);

        if (s.dragging) {
            s.x = mouseX - s.ox;
            s.y = mouseY - s.oy;
            mask.style.transform = `translate3d(${s.x}px,${s.y}px,0)`;
        }

        if (cache.isWebGL) {
            drawWebGL(cache, video, s);
        } else {
            const ctx = cache.ctx;
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            drawClipped(ctx, video, s);
        }

        updateCoords(mask);
    });

    requestAnimationFrame(draw);
}

masks.forEach(mask => {
    mask.addEventListener("mousedown", e => {
        const s = state.get(mask);
        s.dragging = true;
        s.ox = e.clientX - s.x;
        s.oy = e.clientY - s.y;
        mask.style.cursor = "grabbing";
    });

    document.addEventListener("mouseup", () => {
        const s = state.get(mask);
        s.dragging = false;
        mask.style.cursor = "grab";
    });
});

video.addEventListener("playing", () => {
    initMasks();
    initCanvases();
    draw();
});
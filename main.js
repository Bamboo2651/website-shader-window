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
#extension GL_OES_standard_derivatives : enable
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec2 uBoxPos;
    uniform vec2 uBoxSize;
    uniform float uDw;
    uniform float uDh;
    uniform float uDx;
    uniform float uDy;
    uniform vec2 uMouse;
    varying vec2 vTexCoord;

    vec2 getDistortedUv(vec2 uv, vec2 direction, float factor) {
        return uv - direction * factor;
    }

    struct DistortedLens {
        vec2 uv_R;
        vec2 uv_G;
        vec2 uv_B;
        float focusSdf;
        float speherSdf;
        float inside;
    };

    DistortedLens getLensDistortion(
        vec2 p,
        vec2 uv,
        vec2 sphereCenter,
        float sphereRadius,
        float focusFactor,
        float chromaticAberrationFactor,
        vec2 boxSize
    ) {
        vec2 distortionDirection = normalize(p - sphereCenter);
        float focusRadius = sphereRadius * focusFactor;
        float focusStrength = sphereRadius / 5000.0;
        vec2 df = abs(p - sphereCenter) - boxSize * 0.5 * focusFactor;
        float focusSdf = length(max(df, 0.0)) + min(max(df.x, df.y), 0.0);
        vec2 d = abs(p - sphereCenter) - boxSize * 0.5;
        float speherSdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
        float inside = clamp(-speherSdf / fwidth(speherSdf), 0., 1.);

        float magnifierFactor = focusSdf / (sphereRadius - focusRadius);
        float mFactor = clamp(magnifierFactor * inside, 0., 1.);
        mFactor = pow(mFactor, 4.0);

        vec3 distortionFactors = vec3(
            mFactor * focusStrength * (1.0 + chromaticAberrationFactor),
            mFactor * focusStrength,
            mFactor * focusStrength * (1.0 - chromaticAberrationFactor)
        );

        vec2 uv_R = getDistortedUv(uv, distortionDirection, distortionFactors.r);
        vec2 uv_G = getDistortedUv(uv, distortionDirection, distortionFactors.g);
        vec2 uv_B = getDistortedUv(uv, distortionDirection, distortionFactors.g);

        return DistortedLens(uv_R, uv_G, uv_B, focusSdf, speherSdf, inside);
    }

    vec2 zoomUV(vec2 uv, vec2 center, float zoom) {
        float zoomFactor = 1.0 / zoom;
        vec2 centeredUV = uv - center;
        centeredUV *= zoomFactor;
        return centeredUV + center;
    }

    vec2 toVideoUV(vec2 pixelPos) {
        float u = (pixelPos.x - uDx) / uDw;
        float v = (pixelPos.y - uDy) / uDh;
        return vec2(u, v);
    }

    void main() {
        // boxのピクセル座標
        vec2 p = uBoxPos + vTexCoord * uBoxSize;

        // 通常のくりぬきUV
        vec2 vUv = toVideoUV(p);

        // マウス座標（box内の相対座標）
        vec2 sphereCenter = uBoxPos + uBoxSize / 2.0;

        float sphereRadius = uBoxSize.y * 0.6;
        float focusFactor = 0.7;
        float chromaticAberrationFactor = 0.2;
        float zoom = 1.0;

        vec2 sphereCenterUv = toVideoUV(sphereCenter);
        vec2 zoomedUv = zoomUV(vUv, sphereCenterUv, zoom);

        DistortedLens distortion = getLensDistortion(
            p, zoomedUv, sphereCenter, sphereRadius, focusFactor, chromaticAberrationFactor, uBoxSize
        );
        

        float r = texture2D(uTexture, distortion.uv_R).r;
        float g = texture2D(uTexture, distortion.uv_G).g;
        float b = texture2D(uTexture, distortion.uv_B).b;
        vec3 imageDistorted = vec3(r, g, b);

        vec3 image = texture2D(uTexture, vUv).rgb;
        image = mix(image, imageDistorted, distortion.inside);
        

        gl_FragColor = vec4(image, 1.0);
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

        // エラー確認
    console.log("vert error:", gl.getShaderInfoLog(vert));
    console.log("frag error:", gl.getShaderInfoLog(frag));
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    return program;
}

function initWebGL(canvas) {
    const gl = canvas.getContext("webgl");
    const ext = gl.getExtension("OES_standard_derivatives");
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

    const uBoxPos  = gl.getUniformLocation(program, "uBoxPos");
    const uBoxSize = gl.getUniformLocation(program, "uBoxSize");
    const uDw      = gl.getUniformLocation(program, "uDw");
    const uDh      = gl.getUniformLocation(program, "uDh");
    const uDx      = gl.getUniformLocation(program, "uDx");
    const uDy      = gl.getUniformLocation(program, "uDy");
    const uMouse   = gl.getUniformLocation(program, "uMouse");

    return { gl, texture, program, uBoxPos, uBoxSize, uDw, uDh, uDx, uDy, uMouse };
}

document.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isHoveringMask) {
        globalHud.innerHTML = `X: ${mouseX}px <br/> Y: ${mouseY}px`;
    }

    globalHud.style.transform = `translate3d(${mouseX + 2}px, ${mouseY + 2}px, 0)`;
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
    const { gl, texture, uBoxPos, uBoxSize, uDw, uDh, uDx, uDy, uMouse } = cache;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    const { dw, dh, dx, dy } = calcVideoLayout();

    gl.uniform2f(uBoxPos, rect.x, rect.y);
    gl.uniform2f(uBoxSize, rect.w, rect.h);
    gl.uniform1f(uDw, dw);
    gl.uniform1f(uDh, dh);
    gl.uniform1f(uDx, dx);
    gl.uniform1f(uDy, dy);
    gl.uniform2f(uMouse, mouseX, mouseY);

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
            isWebGL: i === 5 //box6
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
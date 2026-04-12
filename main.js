const video = document.querySelector("#video");
const masks = document.querySelectorAll(".maskContainer");
const globalHud = document.querySelector(".globalHud");
let isHoveringMask = false;

const state = new Map();
const ctxCache = new Map();

let mouseX = 0, mouseY = 0;

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

function initMasks() {
    masks.forEach(mask => {
        const r = mask.getBoundingClientRect();

        state.set(mask, {
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
            dragging: false,
            ox: 0,
            oy: 0
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
    masks.forEach(mask => {
        const s = state.get(mask);
        const canvas = mask.querySelector("canvas");
        canvas.width = s.w;
        canvas.height = s.h;
        ctxCache.set(mask, canvas.getContext("2d"));
    });
}

function draw() {
    masks.forEach(mask => {
        const s = state.get(mask);
        const ctx = ctxCache.get(mask);

        if (s.dragging) {
            s.x = mouseX - s.ox;
            s.y = mouseY - s.oy;
            mask.style.transform = `translate3d(${s.x}px,${s.y}px,0)`;
        }

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawClipped(ctx, video, s);
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
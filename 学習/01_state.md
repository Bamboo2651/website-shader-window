# 01 グローバル変数・状態管理

## 該当コード

```js
const video = document.querySelector("#video");
const masks = document.querySelectorAll(".maskContainer");
const globalHud = document.querySelector(".globalHud");
let isHoveringMask = false;

const state = new Map();
const ctxCache = new Map();

let mouseX = 0, mouseY = 0;
```

---

## 何をしているか

ファイルの一番上で、**後のコード全体から使う変数をまとめて用意している。**

---

## 各変数の役割

| 変数 | 役割 |
|---|---|
| `video` | 背景の動画要素 |
| `masks` | ボックス要素を全部まとめて取得（6個） |
| `globalHud` | カーソルに追従する座標表示UI |
| `isHoveringMask` | マウスがボックスの上にいるか（true/false） |
| `mouseX / mouseY` | マウスの現在座標 |
| `state` | 各ボックスの位置・サイズ・ドラッグ状態を管理 |
| `ctxCache` | 各ボックスのCanvas描画コンテキストを管理 |

---

## ポイント①：querySelectorとquerySelectorAllの違い

```js
document.querySelector(".maskContainer");
// → 1個目だけ取得

document.querySelectorAll(".maskContainer");
// → 全部取得（配列みたいなもので返ってくる）
```

ボックスが6個あるので `querySelectorAll` で全部まとめて取得している。

---

## ポイント②：なぜ一番上に書くのか

複数の関数をまたいで使うから。

```js
// マウスが動いたとき → 更新する
document.addEventListener("mousemove", e => {
    mouseX = e.clientX;
});

// 描画ループ → 使う
function draw() {
    s.x = mouseX - s.ox;
}
```

関数の中に書いてしまうとその関数の中でしか使えない。
**一番外に書く = どの関数からでも読み書きできる**（Pythonのグローバル変数と同じ考え方）

---

## ポイント③：MapはPythonの辞書と同じ

```python
# Python
state = {}
state["box1"] = { "x": 100, "y": 200 }
```

```js
// JavaScript
const state = new Map();
state.set(mask要素, { x: 100, y: 200 }); // 追加
state.get(mask要素); // → { x: 100, y: 200 } 取得
```

通常の辞書と違い、**キーにDOM要素そのものを使える**のがMapの特徴。
これによって「何番目のボックスか」を気にせず `state.get(mask)` で取り出せる。

---

## ポイント④：この時点ではMapは空

```js
const state = new Map();    // まだ空 {}
const ctxCache = new Map(); // まだ空 {}
```

中身が入るのは後で `initMasks()` が呼ばれたとき。
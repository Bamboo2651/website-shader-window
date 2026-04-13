# WebGLシェーダーエフェクト実装ロードマップ

## 目標
ShadertoyのGLSLシェーダーをboxのcanvasに適用する。

---

## STEP 1 ✅ 完了
### Canvas 2Dで動画をくりぬいて表示

- 背景動画を`<video>`で配置
- `canvas.getContext("2d")` で動画をcanvasに描画
- ドラッグで移動できるwindow UI

---

## STEP 2
### WebGL contextに切り替えて動作確認

**やること**
- `getContext("2d")` → `getContext("webgl")` に変更
- 最小限のVertex Shader・Fragment Shaderを書く
- canvasを赤く塗れたら成功

**覚えるもの**
- Vertex Shader：「どこに」描くか
- Fragment Shader：「何色で」描くか
- `gl_FragColor = vec4(R, G, B, A)` で色を指定（0〜1）

---

## STEP 3
### 動画をWebGLのテクスチャとして渡す

**やること**
- `gl.createTexture()` でテクスチャを作成
- 毎フレーム`gl.texImage2D()`で動画フレームをテクスチャに転送
- Fragment Shader内で`texture2D()`でサンプリングして表示

**この時点での見た目**
- STEP 1と同じに見えるが、内部はWebGLで動いている
- シェーダーにエフェクトを加える準備が整った状態

---

## STEP 4
### ShadertoyのシェーダーをWebGLに移植する

**Shadertoyとの変数の対応**

| Shadertoy | WebGL（自分で渡す） |
|-----------|-----------------|
| `iResolution` | canvasのwidth/height |
| `iTime` | 経過時間（秒） |
| `iChannel0` | 動画テクスチャ |

**やること**
- Shadertoyのコードを`main()`から`void main()`に書き換える
- `uniform`変数としてiResolution・iTime・iChannel0を渡す
- JS側から毎フレームuniformを更新する

---

## STEP 5
### 全boxにシェーダーを適用・仕上げ

**やること**
- 1つのboxで動いたら全boxに展開
- boxごとに別のエフェクトを適用するか検討
- パフォーマンス調整（重い場合はWebGL contextの共有を検討）

---

## 現在地
```
STEP 1 ✅ → STEP 2 ← いまここ
```
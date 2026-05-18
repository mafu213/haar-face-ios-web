# 基于 Haar 特征的人脸检测系统

## 项目简介

这是一个面向课程作业的前端网页应用，使用原生 HTML、CSS、JavaScript、OpenCV.js 和 Haar Cascade 分类器，在 iPhone Safari/Chrome 中调用前置摄像头并实时检测人脸。检测结果会绘制到 Canvas 上，包括红色人脸框和 `Face` 标签，并支持一键保存截图。

## 实现原理

- Haar-like 特征：通过明暗区域差异描述人脸局部结构，例如眼睛、鼻梁、脸部边缘等。
- 级联分类器：使用 OpenCV 官方训练好的 Haar Cascade XML 模型，逐级筛选图像窗口，快速排除非人脸区域。
- 灰度图检测：摄像头画面先绘制到 Canvas，再用 OpenCV.js 转为灰度图，减少计算量。
- 多尺度滑动窗口检测：`detectMultiScale` 会在不同窗口尺寸下扫描图像，从而检测不同远近、不同大小的人脸。
- OpenCV.js 前端实现：浏览器端直接加载 OpenCV.js，不需要后端服务；Haar XML 模型通过相对路径加载到 OpenCV.js 的虚拟文件系统中。

## 文件结构

```text
.
│
├─ index.html
├─ style.css
├─ app.js
├─ README.md
├─ models
│  └─ haarcascade_frontalface_default.xml
└─ screenshots
   └─ .gitkeep
```

## 电脑本地运行方法

1. 打开 PowerShell，进入项目目录：

```powershell
cd 项目目录
```

2. 启动一个本地静态服务器：

```powershell
python -m http.server 8080
```

3. 在电脑浏览器中打开：

```text
http://localhost:8080
```

说明：不要直接双击 `index.html` 用本地文件方式打开，因为浏览器摄像头权限和模型 `fetch` 加载都可能失败。

## iPhone 打开方法

iPhone 上必须通过 HTTPS 打开网页，Safari 和 Chrome 才能稳定调用摄像头。不能直接使用本地文件方式打开，也不建议使用普通 `http://` 局域网地址，因为 iPhone 上可能无法授权摄像头。

推荐方式：

- GitHub Pages
- Vercel
- Netlify

打开网页后，点击“开启摄像头”，浏览器弹出权限提示时选择允许。代码中使用了：

```javascript
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: "user",
    width: { ideal: 640 },
    height: { ideal: 480 }
  },
  audio: false
});
```

并且 `video` 标签已经设置 `autoplay`、`playsinline`、`webkit-playsinline`、`muted`，适配 iPhone 浏览器限制。

## 前后摄像头切换说明

本项目支持在 iPhone Safari/Chrome 中切换前置和后置摄像头。

- 前置摄像头使用 `facingMode: "user"`。
- 后置摄像头使用 `facingMode: "environment"`。
- iOS Safari 上切换摄像头时，需要先停止旧的 `MediaStream track`，再重新请求新的摄像头，否则旧摄像头可能继续被占用。
- 如果 iPhone 切换失败，可以刷新页面后重试。
- 必须通过 HTTPS 打开 GitHub Pages 链接，普通本地文件方式或不安全地址可能无法调用摄像头。

## GitHub Pages 部署步骤

1. 在 GitHub 新建一个仓库，例如 `haar-face-ios-web`。
2. 将项目目录中的所有文件上传到仓库根目录。
3. 进入仓库页面，点击 `Settings`。
4. 点击 `Pages`。
5. 在 `Build and deployment` 中选择 `Deploy from a branch`。
6. Branch 选择 `main`，目录选择 `/root`，点击保存。
7. 等待 GitHub Pages 生成 HTTPS 地址。
8. 用 iPhone Safari/Chrome 打开这个 HTTPS 地址。

所有代码和模型路径都使用相对路径，适合直接部署到 GitHub Pages：

```text
models/haarcascade_frontalface_default.xml
```

## 常见问题

### 摄像头打不开

- 检查是否通过 HTTPS 打开网页。
- 检查浏览器是否允许摄像头权限。
- 检查是否有其他 App 正在占用摄像头。
- iPhone 上优先使用 Safari 测试，再测试 Chrome。

### OpenCV.js 加载慢

- OpenCV.js 文件较大，首次打开需要等待。
- 建议使用稳定网络。
- 如果 CDN 访问不稳定，可以下载 OpenCV.js 到项目本地，再把 `app.js` 中的 `OPENCV_URL` 改成本地相对路径。

### 检测不到人脸

- 保持正脸面对前置摄像头。
- 增加环境光，避免逆光。
- 距离摄像头不要太远。
- Haar Cascade 对侧脸、遮挡、强光、暗光比较敏感。

### iPhone 页面黑屏

- 确认点击了“开启摄像头”，摄像头不能在页面加载时自动打开。
- 确认 `video` 标签包含 `autoplay`、`playsinline`、`muted`。
- 刷新页面后重新授权摄像头。
- 如果使用普通局域网 `http://` 地址，请改用 HTTPS 部署地址。

### 本地打开不能调用摄像头

直接双击 HTML 会以本地文件方式打开，浏览器通常会限制摄像头和模型文件加载。请使用本地服务器预览，或者部署到 GitHub Pages、Vercel、Netlify 后用 HTTPS 打开。

### Haar 模型加载失败

本项目已放置 OpenCV 官方 Haar 模型：

```text
models/haarcascade_frontalface_default.xml
```

如果文件丢失，可以从 OpenCV 官方仓库下载：

```text
https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades/haarcascade_frontalface_default.xml
```

下载后放到：

```text
models/haarcascade_frontalface_default.xml
```

## 课程作业提交建议

1. 用 HTTPS 地址在 iPhone 上打开网页。
2. 点击“开启摄像头”。
3. 等检测到人脸并出现红色检测框后，点击“截图保存”。
4. 截图时保留手机边框，能体现是在 iPhone 浏览器中运行。
5. 提交前将图片压缩到 1MB 以下。

## 技术说明

- 前端技术：HTML5、CSS3、JavaScript。
- 图像处理：OpenCV.js。
- 人脸检测模型：OpenCV 官方 `haarcascade_frontalface_default.xml`。
- 检测频率：每 100ms 检测一次，降低 iPhone 发热和卡顿风险。
- 截图格式：PNG，文件名格式类似 `haar_face_detection_时间戳.png`。

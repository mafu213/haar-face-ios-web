"use strict";

const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";
const HAAR_MODEL_PATH = "models/haarcascade_frontalface_default.xml";
const HAAR_FILE_NAME = "haarcascade_frontalface_default.xml";
const DETECT_INTERVAL_MS = 100;

const video = document.getElementById("cameraVideo");
const canvas = document.getElementById("outputCanvas");
const placeholder = document.getElementById("placeholder");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const captureBtn = document.getElementById("captureBtn");
const opencvStatus = document.getElementById("opencvStatus");
const cameraStatus = document.getElementById("cameraStatus");
const faceCount = document.getElementById("faceCount");
const message = document.getElementById("message");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let cvReady = false;
let modelReady = false;
let classifier = null;
let stream = null;
let detectTimer = null;
let detectBusy = false;
let opencvReadyHandled = false;

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function setFaceCount(count) {
  faceCount.textContent = String(count);
}

function setControls(active) {
  startBtn.disabled = active || !cvReady || !modelReady;
  stopBtn.disabled = !active;
  captureBtn.disabled = !active;
}

function loadOpenCv() {
  opencvStatus.textContent = "加载中";
  setMessage("正在加载 OpenCV.js，首次打开可能需要一些时间。");

  window.Module = {
    onRuntimeInitialized: onOpenCvReady
  };

  const script = document.createElement("script");
  script.src = OPENCV_URL;
  script.async = true;
  script.onload = () => {
    waitForOpenCvRuntime();
  };
  script.onerror = () => {
    opencvStatus.textContent = "加载失败";
    setMessage("OpenCV.js 加载失败，请检查网络或 CDN 是否可访问。", "error");
  };
  document.body.appendChild(script);
}

function waitForOpenCvRuntime() {
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (window.cv && cv.Mat && cv.CascadeClassifier) {
      window.clearInterval(timer);
      onOpenCvReady();
      return;
    }

    if (window.cv) {
      cv.onRuntimeInitialized = () => {
        window.clearInterval(timer);
        onOpenCvReady();
      };
    }

    if (Date.now() - startedAt > 30000) {
      window.clearInterval(timer);
      opencvStatus.textContent = "加载超时";
      setMessage("OpenCV.js 加载超时，请刷新页面或检查网络。", "error");
    }
  }, 100);
}

async function onOpenCvReady() {
  if (opencvReadyHandled) {
    return;
  }

  opencvReadyHandled = true;
  cvReady = true;
  opencvStatus.textContent = "OpenCV 已加载";
  setMessage("OpenCV 已加载，正在加载 Haar 模型。", "ok");

  try {
    await loadHaarModel();
    modelReady = true;
    setMessage("Haar 模型已加载，可以开启摄像头。", "ok");
  } catch (error) {
    modelReady = false;
    setMessage(`Haar 模型加载失败：${error.message}`, "error");
  }

  setControls(false);
}

async function loadHaarModel() {
  const response = await fetch(HAAR_MODEL_PATH);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());

  try {
    cv.FS_unlink(`/${HAAR_FILE_NAME}`);
  } catch (_) {
    // 首次加载时虚拟文件系统中还没有该文件，可以忽略。
  }

  cv.FS_createDataFile("/", HAAR_FILE_NAME, data, true, false, false);

  classifier = new cv.CascadeClassifier();
  const loaded = classifier.load(HAAR_FILE_NAME);
  if (!loaded) {
    classifier.delete();
    classifier = null;
    throw new Error("分类器初始化失败");
  }
}

async function startCamera() {
  if (!cvReady || !modelReady || !classifier) {
    setMessage("OpenCV 或 Haar 模型尚未准备好，请稍后再试。", "error");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();
    await waitForVideoMetadata();

    resizeCanvasToVideo();
    placeholder.classList.add("hidden");
    cameraStatus.textContent = "已开启";
    setFaceCount(0);
    setControls(true);
    setMessage("摄像头已开启，正在进行实时检测。", "ok");

    startDetectionLoop();
  } catch (error) {
    cameraStatus.textContent = "开启失败";
    setControls(false);
    setMessage(`摄像头开启失败：${getCameraErrorMessage(error)}`, "error");
  }
}

function waitForVideoMetadata() {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
}

function resizeCanvasToVideo() {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;
}

function startDetectionLoop() {
  stopDetectionLoopOnly();
  processFrame();
  detectTimer = window.setInterval(processFrame, DETECT_INTERVAL_MS);
}

function stopDetectionLoopOnly() {
  if (detectTimer) {
    window.clearInterval(detectTimer);
    detectTimer = null;
  }
  detectBusy = false;
}

function processFrame() {
  if (!stream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || detectBusy) {
    return;
  }

  detectBusy = true;

  let src = null;
  let gray = null;
  let faces = null;

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    src = cv.imread(canvas);
    gray = new cv.Mat();
    faces = new cv.RectVector();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, gray);

    const minSize = new cv.Size(90, 90);
    const maxSize = new cv.Size(420, 420);
    classifier.detectMultiScale(gray, faces, 1.2, 7, 0, minSize, maxSize);

    const validFaceCount = drawFaces(faces);
    setFaceCount(validFaceCount);
  } catch (error) {
    setMessage(`检测过程出错：${error.message}`, "error");
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (faces) faces.delete();
    detectBusy = false;
  }
}

function drawFaces(faces) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ff2222";
  ctx.fillStyle = "#ff2222";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

  const minArea = canvas.width * canvas.height * 0.02;
  const maxArea = canvas.width * canvas.height * 0.45;
  let validFaceCount = 0;

  for (let i = 0; i < faces.size(); i += 1) {
    const face = faces.get(i);
    const area = face.width * face.height;
    const ratio = face.width / face.height;

    if (area < minArea || area > maxArea) {
      continue;
    }

    if (ratio < 0.75 || ratio > 1.35) {
      continue;
    }

    validFaceCount += 1;
    ctx.strokeRect(face.x, face.y, face.width, face.height);

    const labelY = Math.max(face.y - 8, 24);
    ctx.fillText("Face", face.x, labelY);
  }

  return validFaceCount;
}

function stopDetection() {
  stopDetectionLoopOnly();

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  video.pause();
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  placeholder.classList.remove("hidden");
  cameraStatus.textContent = "摄像头已关闭";
  setFaceCount(0);
  setControls(false);
  setMessage("摄像头已关闭。");
}

function captureScreenshot() {
  if (!canvas.width || !canvas.height) {
    setMessage("当前没有可保存的检测画面。", "error");
    return;
  }

  const fileName = `haar_face_detection_${Date.now()}.png`;

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (!blob) {
        saveDataUrl(fileName);
        return;
      }
      const url = URL.createObjectURL(blob);
      triggerDownload(url, fileName);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  } else {
    saveDataUrl(fileName);
  }

  setMessage(`截图已生成：${fileName}`, "ok");
}

function saveDataUrl(fileName) {
  const dataUrl = canvas.toDataURL("image/png");
  triggerDownload(dataUrl, fileName);
}

function triggerDownload(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getCameraErrorMessage(error) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return "当前浏览器不支持 getUserMedia";
  }

  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return "摄像头权限被拒绝";
  }

  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "没有找到可用摄像头";
  }

  if (error.name === "NotReadableError") {
    return "摄像头正在被其他应用占用";
  }

  if (error.name === "OverconstrainedError") {
    return "摄像头参数不被当前设备支持";
  }

  return error.message || "未知错误";
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopDetection);
captureBtn.addEventListener("click", captureScreenshot);
window.addEventListener("pagehide", stopDetection);

setControls(false);
loadOpenCv();

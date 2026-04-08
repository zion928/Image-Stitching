// renderer.js — Canvas 렌더링, 다운로드, 클립보드 복사

const Renderer = {
  // cv.Mat을 Canvas에 그리기
  drawMat2Canvas(mat, canvasEl, x, y, width, height) {
    const tmpCanvas = document.createElement('canvas');
    cv.imshow(tmpCanvas, mat);
    if (width === undefined || width === -1) {
      canvasEl.getContext('2d').drawImage(tmpCanvas, x, y);
    } else {
      canvasEl.getContext('2d').drawImage(tmpCanvas, x, y, width, height);
    }
    tmpCanvas.remove();
  },

  // 병합 결과를 Canvas에 렌더링
  renderToCanvas(imgs, relativeHeights, canvasEl, showHeader) {
    const n = imgs.length;
    if (n === 0) return;

    const scrollWidth = Math.min(...imgs.map(img => img.scroll.cols));
    const scale = scrollWidth / imgs[0].scroll.cols;

    // 최상단/최하단 이미지 찾기
    let topIdx = 0, bottomIdx = 0;
    for (let i = 1; i < n; i++) {
      if (relativeHeights[i] < relativeHeights[topIdx]) topIdx = i;
      if (relativeHeights[i] + imgs[i].scroll.rows > relativeHeights[bottomIdx] + imgs[bottomIdx].scroll.rows) bottomIdx = i;
    }

    // 헤더 높이
    let headerHeight = 0;
    if (showHeader && imgs[topIdx] && imgs[topIdx].header) {
      headerHeight = Math.floor(imgs[topIdx].header.rows * scale);
    }

    // 푸터 높이
    let footerHeight = 0;
    if (imgs[bottomIdx] && imgs[bottomIdx].footer) {
      footerHeight = Math.floor(imgs[bottomIdx].footer.rows * scale);
    }

    // 스크롤 영역 전체 높이
    let maxBottom = 0;
    for (let i = 0; i < n; i++) {
      maxBottom = Math.max(maxBottom, relativeHeights[i] + imgs[i].scroll.rows);
    }

    const totalHeight = headerHeight + Math.floor(maxBottom * scale) + footerHeight;
    canvasEl.width = scrollWidth;
    canvasEl.height = totalHeight;

    const ctx = canvasEl.getContext('2d');
    ctx.fillStyle = 'rgb(242, 242, 242)';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    // 1. 헤더 그리기
    if (showHeader && headerHeight > 0 && imgs[topIdx].header) {
      this.drawMat2Canvas(imgs[topIdx].header, canvasEl, 0, 0, scrollWidth, headerHeight);
    }

    // 2. 스크롤 영역: 하단→상단 순서로 그리기
    //    하단 이미지를 먼저 그리고, 상단 이미지가 겹치는 부분을 덮어씀
    //    → 겹침 영역에서 상단 이미지의 콘텐츠가 우선 표시됨
    //    → 하단 이미지의 헤더/탭바 등 고정 요소가 겹침부에서 자연스럽게 가려짐
    const indices = [...Array(n).keys()].sort(
      (a, b) => relativeHeights[b] - relativeHeights[a]
    );

    indices.forEach(i => {
      const img = imgs[i];
      const imgScale = scrollWidth / img.scroll.cols;
      const drawY = headerHeight + Math.floor(relativeHeights[i] * imgScale);
      const drawW = scrollWidth;
      const drawH = Math.floor(img.scroll.rows * imgScale);

      this.drawMat2Canvas(img.scroll, canvasEl, 0, drawY, drawW, drawH);
    });

    // 3. 푸터 그리기 (최하단 이미지의 footer)
    if (footerHeight > 0 && imgs[bottomIdx].footer) {
      const footerY = headerHeight + Math.floor(maxBottom * scale);
      this.drawMat2Canvas(imgs[bottomIdx].footer, canvasEl, 0, footerY, scrollWidth, footerHeight);
    }
  },

  // 파일로 다운로드
  saveAsFile(canvasEl, format) {
    const date = new Date();
    const dateStr = date.getFullYear() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);

    const a = document.createElement('a');

    if (format === 'png') {
      a.href = canvasEl.toDataURL('image/png');
      a.download = 'stitched_' + dateStr + '.png';
    } else {
      a.href = canvasEl.toDataURL('image/jpeg', 0.95);
      a.download = 'stitched_' + dateStr + '.jpg';
    }

    a.click();
  },

  // 클립보드에 복사
  async copyToClipboard(canvasEl) {
    return new Promise((resolve, reject) => {
      canvasEl.toBlob(async (blob) => {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  },

  // 결과 이미지 크기 전환
  toggleImageSize(imgEl) {
    imgEl.classList.toggle('full-width-image');
  }
};

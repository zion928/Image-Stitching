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

  // 병합 결과를 Canvas에 렌더링 (겹침 영역 알파 블렌딩 포함)
  renderToCanvas(imgs, relativeHeights, canvasEl, showHeader, scrollbarWidth) {
    const n = imgs.length;
    if (n === 0) return;

    const rawScrollWidth = Math.min(...imgs.map(img => img.scroll.cols));
    // 스크롤바가 감지된 경우 해당 열을 크롭
    const cropRight = scrollbarWidth || 0;
    const scrollWidth = rawScrollWidth - cropRight;
    const scale = scrollWidth / (imgs[0].scroll.cols - cropRight);

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

    // 스크롤바 크롭용 임시 캔버스 생성 헬퍼
    const drawMatCropped = (mat, destCanvas, x, y, drawW, drawH) => {
      if (cropRight <= 0) {
        this.drawMat2Canvas(mat, destCanvas, x, y, drawW, drawH);
        return;
      }
      // Mat → 임시 캔버스 → 크롭하여 그리기
      const tmpCanvas = document.createElement('canvas');
      cv.imshow(tmpCanvas, mat);
      const srcW = mat.cols - cropRight;
      const srcH = mat.rows;
      destCanvas.getContext('2d').drawImage(tmpCanvas, 0, 0, srcW, srcH, x, y, drawW, drawH);
      tmpCanvas.remove();
    };

    // 1. 헤더 그리기
    if (showHeader && headerHeight > 0 && imgs[topIdx].header) {
      drawMatCropped(imgs[topIdx].header, canvasEl, 0, 0, scrollWidth, headerHeight);
    }

    // 2. 스크롤 영역: 하단→상단 순서로 그리기
    const indices = [...Array(n).keys()].sort(
      (a, b) => relativeHeights[b] - relativeHeights[a]
    );

    indices.forEach(i => {
      const img = imgs[i];
      const drawY = headerHeight + Math.floor(relativeHeights[i] * scale);
      const drawH = Math.floor(img.scroll.rows * scale);

      drawMatCropped(img.scroll, canvasEl, 0, drawY, scrollWidth, drawH);
    });

    // 3. 겹침 경계 알파 블렌딩
    //    상단→하단 순서로 인접 쌍의 겹침 구간에 그라디언트 블렌딩 적용
    const sortedByY = [...Array(n).keys()].sort(
      (a, b) => relativeHeights[a] - relativeHeights[b]
    );

    for (let k = 0; k < sortedByY.length - 1; k++) {
      const upper = sortedByY[k];
      const lower = sortedByY[k + 1];

      const upperBottom = relativeHeights[upper] + imgs[upper].scroll.rows;
      const lowerTop = relativeHeights[lower];
      const overlapPx = upperBottom - lowerTop;

      if (overlapPx <= 4) continue; // 겹침이 거의 없으면 스킵

      // 블렌딩 영역: 겹침 구간의 중앙 60%만 블렌딩 (상단/하단 끝은 원본 유지)
      const blendMargin = Math.floor(overlapPx * 0.2);
      const blendStart = lowerTop + blendMargin;
      const blendEnd = upperBottom - blendMargin;
      const blendHeight = blendEnd - blendStart;

      if (blendHeight <= 2) continue;

      const canvasBlendY = headerHeight + Math.floor(blendStart * scale);
      const canvasBlendH = Math.floor(blendHeight * scale);

      if (canvasBlendH <= 0) continue;

      // 상단 이미지의 겹침 부분을 임시 캔버스에 그리기
      const upperOffsetInScroll = blendStart - relativeHeights[upper];
      const lowerOffsetInScroll = blendStart - relativeHeights[lower];

      // 상단/하단 이미지의 해당 구간 픽셀을 ImageData로 블렌딩
      const tmpUpper = document.createElement('canvas');
      tmpUpper.width = scrollWidth;
      tmpUpper.height = canvasBlendH;
      const upperMat = imgs[upper].scroll;
      const tmpUpperFull = document.createElement('canvas');
      cv.imshow(tmpUpperFull, upperMat);
      const srcW = upperMat.cols - cropRight;
      tmpUpper.getContext('2d').drawImage(
        tmpUpperFull,
        0, upperOffsetInScroll, srcW, blendHeight,
        0, 0, scrollWidth, canvasBlendH
      );
      tmpUpperFull.remove();

      const tmpLower = document.createElement('canvas');
      tmpLower.width = scrollWidth;
      tmpLower.height = canvasBlendH;
      const lowerMat = imgs[lower].scroll;
      const tmpLowerFull = document.createElement('canvas');
      cv.imshow(tmpLowerFull, lowerMat);
      const srcWL = lowerMat.cols - cropRight;
      tmpLower.getContext('2d').drawImage(
        tmpLowerFull,
        0, lowerOffsetInScroll, srcWL, blendHeight,
        0, 0, scrollWidth, canvasBlendH
      );
      tmpLowerFull.remove();

      const upperData = tmpUpper.getContext('2d').getImageData(0, 0, scrollWidth, canvasBlendH);
      const lowerData = tmpLower.getContext('2d').getImageData(0, 0, scrollWidth, canvasBlendH);
      const blended = ctx.createImageData(scrollWidth, canvasBlendH);

      for (let row = 0; row < canvasBlendH; row++) {
        // alpha: 0(상단 100%) → 1(하단 100%)
        const alpha = row / (canvasBlendH - 1);
        for (let col = 0; col < scrollWidth; col++) {
          const idx = (row * scrollWidth + col) * 4;
          blended.data[idx]     = Math.round(upperData.data[idx]     * (1 - alpha) + lowerData.data[idx]     * alpha);
          blended.data[idx + 1] = Math.round(upperData.data[idx + 1] * (1 - alpha) + lowerData.data[idx + 1] * alpha);
          blended.data[idx + 2] = Math.round(upperData.data[idx + 2] * (1 - alpha) + lowerData.data[idx + 2] * alpha);
          blended.data[idx + 3] = 255;
        }
      }

      ctx.putImageData(blended, 0, canvasBlendY);

      tmpUpper.remove();
      tmpLower.remove();
    }

    // 4. 푸터 그리기 (최하단 이미지의 footer)
    if (footerHeight > 0 && imgs[bottomIdx].footer) {
      const footerY = headerHeight + Math.floor(maxBottom * scale);
      drawMatCropped(imgs[bottomIdx].footer, canvasEl, 0, footerY, scrollWidth, footerHeight);
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

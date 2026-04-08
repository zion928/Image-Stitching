// app.js — UI 이벤트, ImageManager, 파이프라인 오케스트레이션

// ── 유틸리티 ──

function raiseErrMsg(text) {
  text = text || '오류가 발생했습니다. 페이지를 새로고침해 주세요.';
  const el = document.getElementById('errMsg');
  el.textContent = text;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), Math.max(text.length * 100, 4000));
}

function raiseNormalMsg(text) {
  if (!text) return;
  const el = document.getElementById('normalMsg');
  el.textContent = text;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), Math.max(text.length * 100, 4000));
}

function changePercentage(val) {
  document.getElementById('percentage').innerText = Math.floor(val) + '%';
  if (val >= 100) {
    document.getElementById('loading').classList.add('hidden');
  } else {
    document.getElementById('loading').classList.remove('hidden');
  }
}

async function repaint() {
  for (let i = 0; i < 2; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}

// ── 버튼 상태 관리 ──

function manageBtnStatus(action) {
  const btnSubmit = document.getElementById('btnSubmit');
  const btnReset = document.getElementById('btnReset');

  switch (action) {
    case 'addImgNotReady':
      btnSubmit.classList.add('imgNotReady', 'disable');
      btnReset.classList.add('imgNotReady');
      break;
    case 'removeImgNotReady':
      btnSubmit.classList.remove('imgNotReady');
      btnReset.classList.remove('imgNotReady', 'disable');
      break;
    case 'removeCvNotReady':
      btnSubmit.classList.remove('cvNotReady');
      break;
  }

  if (!btnSubmit.classList.contains('imgNotReady') &&
      !btnSubmit.classList.contains('cvNotReady')) {
    btnSubmit.classList.remove('disable');
  }
}

// ── 이미지 업로드 / 미리보기 ──

function addPhoto(dataURL) {
  const container = document.querySelector('.container');

  const item = document.createElement('div');
  item.className = 'containerItem';
  item.setAttribute('draggable', 'true');

  const funcWrap = document.createElement('div');
  funcWrap.className = 'functionWrap';

  const cross = document.createElement('div');
  cross.className = 'icon--cross';
  cross.addEventListener('click', deletePhoto);

  const img = document.createElement('img');
  img.className = 'previewImage';
  img.src = dataURL;

  funcWrap.appendChild(cross);
  item.appendChild(funcWrap);
  item.appendChild(img);
  container.appendChild(item);

  // 드래그 앤 드롭 순서 변경 이벤트
  setupItemDrag(item);
}

function deletePhoto(e) {
  e.target.closest('.containerItem').remove();
  if (document.querySelectorAll('.containerItem').length === 0) {
    manageBtnStatus('addImgNotReady');
  }
}

function photoPreview(files) {
  if (!files || files.length === 0) return;
  let loaded = 0;

  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader();
    reader.onload = function(e) {
      addPhoto(e.target.result);
      loaded++;
      if (loaded === files.length) {
        manageBtnStatus('removeImgNotReady');
      }
    };
    reader.readAsDataURL(files[i]);
  }
}

async function addPhotoFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    const imageItems = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].types.includes('image/png')) {
        imageItems.push(i);
      }
    }

    if (imageItems.length === 0) {
      raiseErrMsg('클립보드에 이미지가 없습니다.');
      return;
    }

    changePercentage(0);
    let loaded = 0;

    for (let i = 0; i < imageItems.length; i++) {
      const blob = await items[imageItems[i]].getType('image/png');
      const reader = new FileReader();
      reader.onload = function(e) {
        addPhoto(e.target.result);
        loaded++;
        if (loaded === imageItems.length) {
          manageBtnStatus('removeImgNotReady');
          changePercentage(100);
        }
      };
      reader.readAsDataURL(blob);
    }
  } catch (e) {
    console.error(e);
    raiseErrMsg('클립보드에서 이미지를 읽을 수 없습니다. 브라우저가 지원하지 않을 수 있습니다.');
  }
}

// ── 드래그 앤 드롭 순서 변경 ──

let dragSourceItem = null;

function setupItemDrag(item) {
  item.addEventListener('dragstart', function(e) {
    dragSourceItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  item.addEventListener('dragend', function() {
    this.classList.remove('dragging');
    document.querySelectorAll('.containerItem').forEach(el => el.classList.remove('drag-over'));
    dragSourceItem = null;
  });

  item.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
  });

  item.addEventListener('dragleave', function() {
    this.classList.remove('drag-over');
  });

  item.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (dragSourceItem && dragSourceItem !== this) {
      const container = this.parentNode;
      const allItems = [...container.querySelectorAll('.containerItem')];
      const fromIdx = allItems.indexOf(dragSourceItem);
      const toIdx = allItems.indexOf(this);

      if (fromIdx < toIdx) {
        container.insertBefore(dragSourceItem, this.nextSibling);
      } else {
        container.insertBefore(dragSourceItem, this);
      }
    }
  });
}

// ── 메인 파이프라인 ──

async function generatePhoto() {
  let mats = [];
  let imgs = [];

  try {
    // 사전 검증
    const imgElements = document.querySelectorAll('.previewImage');
    if (imgElements.length === 0) {
      throw new Error('이미지가 업로드되지 않았습니다.');
    }
    if (imgElements.length < 2) {
      throw new Error('2장 이상의 이미지가 필요합니다.');
    }
    if (document.getElementById('btnSubmit').classList.contains('cvNotReady')) {
      throw new Error('라이브러리 로드가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    }

    // 로딩 시작
    changePercentage(0);
    await repaint();

    // 1. 이미지를 cv.Mat으로 변환
    for (let i = 0; i < imgElements.length; i++) {
      const tmpEl = document.createElement('img');
      tmpEl.src = imgElements[i].src;
      const mat = cv.imread(tmpEl);
      cv.cvtColor(mat, mat, cv.COLOR_RGBA2RGB);
      mats.push(mat);
    }

    changePercentage(5);
    await repaint();

    // 2. 해상도 통일
    console.log('해상도 통일');
    mats = Preprocessor.normalizeResolution(mats);
    changePercentage(10);
    await repaint();

    // 3. 고정 영역 감지
    console.log('고정 영역 감지');
    const fixedAreas = Preprocessor.detectFixedAreas(mats);
    console.log('고정 영역:', fixedAreas);
    changePercentage(20);
    await repaint();

    // 4. 스크롤 영역 추출
    console.log('스크롤 영역 추출');
    imgs = Preprocessor.extractScrollRegions(mats, fixedAreas);
    changePercentage(25);
    await repaint();

    // 5. 스크롤바 기반 순서 결정 + 겹침 매칭
    console.log('순서 결정 + 겹침 매칭');
    const n = imgs.length;
    const { order, overlaps, scrollbarWidth } = Matcher.matchAllWithOrder(imgs);
    console.log('최종 순서:', order);
    changePercentage(75);
    await repaint();

    // 6. 상대 좌표 계산
    console.log('상대 좌표 계산');
    const relativeHeights = Matcher.resolveHeights(order, overlaps, imgs);
    console.log('상대 좌표:', relativeHeights);
    changePercentage(82);
    await repaint();

    // 7. 미매칭 이미지 폴백
    const hasWarning = Matcher.alignMissing(relativeHeights, imgs);
    console.log('최종 좌표:', relativeHeights);
    changePercentage(85);
    await repaint();

    // 8. 품질 검증 — 기준 미달 시 병합 중단
    const totalPairs = overlaps.length;
    const validPairs = overlaps.filter(m => m !== null).length;
    const validRatio = totalPairs > 0 ? validPairs / totalPairs : 0;
    const avgDiff = validPairs > 0
      ? overlaps.filter(m => m).reduce((s, m) => s + m.diff, 0) / validPairs : 999;

    console.log(`품질 검증: 유효쌍 ${validPairs}/${totalPairs}, 평균diff ${avgDiff.toFixed(2)}`);

    if (validPairs === 0) {
      throw new Error('이미지 간 겹치는 영역을 찾을 수 없습니다.\n\n아래 조건을 확인해 주세요:\n· 인접 이미지 간 최소 2~3줄 이상 겹치도록 촬영\n· 동일한 화면을 스크롤하며 촬영한 이미지인지 확인\n· 수동으로 크롭/편집한 이미지는 지원하지 않습니다');
    }
    if (validRatio < 0.5) {
      throw new Error(`이미지 간 겹치는 영역이 부족합니다 (${validPairs}/${totalPairs}쌍만 매칭).\n\n촬영 시 이전 화면과 2~3줄 이상 겹치도록 스크롤해 주세요.`);
    }
    if (avgDiff > 8) {
      throw new Error('매칭 품질이 낮아 자연스러운 병합이 어렵습니다.\n\n아래 조건을 확인해 주세요:\n· 같은 화면을 스크롤하며 촬영한 이미지인지 확인\n· 촬영 사이에 화면 내용이 변경되지 않았는지 확인\n· 이미지가 압축되거나 편집되지 않았는지 확인');
    }

    // 8. Canvas 렌더링
    console.log('렌더링');
    let canvasEl = document.getElementById('canvasOutput');
    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
      canvasEl.id = 'canvasOutput';
      canvasEl.style.display = 'none';
      document.getElementById('resultSection').appendChild(canvasEl);
    }

    const showHeader = document.getElementById('showHeader').checked;
    Renderer.renderToCanvas(imgs, relativeHeights, canvasEl, showHeader, scrollbarWidth || 0);
    changePercentage(95);
    await repaint();

    // 9. 결과 표시
    const outputImage = document.getElementById('outputImage');
    outputImage.src = canvasEl.toDataURL('image/png');
    outputImage.classList.remove('hidden');

    document.getElementById('saveBtnArea').classList.remove('hidden');
    document.getElementById('outputAreaText').classList.add('hidden');
    document.getElementById('toggleSizeText').classList.remove('hidden');

    changePercentage(100);

    // 결과 영역으로 스크롤
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (e) {
    console.error(e);
    raiseErrMsg(e.message);
    document.getElementById('loading').classList.add('hidden');
  } finally {
    // 메모리 해제
    mats.forEach(m => { try { m.delete(); } catch (_) {} });
    Preprocessor.cleanupImgs(imgs);
  }
}

function resetAll() {
  // 미리보기 초기화
  const container = document.querySelector('.container');
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // 결과 초기화
  const canvasEl = document.getElementById('canvasOutput');
  if (canvasEl) canvasEl.remove();

  const outputImage = document.getElementById('outputImage');
  outputImage.src = '';
  outputImage.classList.add('hidden');
  outputImage.classList.remove('full-width-image');

  document.getElementById('saveBtnArea').classList.add('hidden');
  document.getElementById('outputAreaText').classList.remove('hidden');
  document.getElementById('toggleSizeText').classList.add('hidden');

  manageBtnStatus('addImgNotReady');
}

// ── OpenCV 로드 완료 ──

function onOpenCvReady() {
  console.log('OpenCV.js 로드 완료');
  manageBtnStatus('removeCvNotReady');
}

// ── 초기화 ──

window.onload = function() {
  // 파일 드래그 앤 드롭
  const dropArea = document.getElementById('dragDropArea');
  const fileInput = document.getElementById('fileInput');

  dropArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.classList.add('dragover');
  });

  dropArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
  });

  dropArea.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
    const files = e.dataTransfer.files;
    photoPreview(files);
  });

  // 파일 선택
  fileInput.addEventListener('change', function(e) {
    photoPreview(e.target.files);
  });

  // 클립보드 붙여넣기 버튼
  document.getElementById('btnUploadFromClipboard').addEventListener('click', addPhotoFromClipboard);

  // Ctrl+V 전역 붙여넣기
  document.addEventListener('paste', function(e) {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      photoPreview(e.clipboardData.files);
    } else {
      addPhotoFromClipboard();
    }
  });

  // 병합 버튼
  document.getElementById('btnSubmit').addEventListener('click', function() {
    generatePhoto();
  });

  // 리셋 버튼
  document.getElementById('btnReset').addEventListener('click', function() {
    resetAll();
  });

  // 저장 버튼들
  document.getElementById('btnSaveJPG').addEventListener('click', function() {
    const canvas = document.getElementById('canvasOutput');
    if (canvas) Renderer.saveAsFile(canvas, 'jpg');
  });

  document.getElementById('btnSavePNG').addEventListener('click', function() {
    const canvas = document.getElementById('canvasOutput');
    if (canvas) Renderer.saveAsFile(canvas, 'png');
  });

  document.getElementById('btnSaveClipboard').addEventListener('click', async function() {
    const canvas = document.getElementById('canvasOutput');
    if (!canvas) return;
    try {
      await Renderer.copyToClipboard(canvas);
      raiseNormalMsg('클립보드에 복사되었습니다.');
    } catch (e) {
      raiseErrMsg('클립보드에 복사할 수 없습니다. 브라우저가 지원하지 않을 수 있습니다.');
    }
  });

  // 결과 이미지 크기 전환
  document.getElementById('outputImage').addEventListener('click', function() {
    Renderer.toggleImageSize(this);
  });
};

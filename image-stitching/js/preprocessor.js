// preprocessor.js — 해상도 통일, 고정 영역 감지, 스크롤 영역 추출

const Preprocessor = {
  // 상수
  DIFF_WINDOW_SIZE: 32,
  THRES_DIFF_Y1: 20,
  THRES_DIFF_Y2: 12,
  LIMIT_PX: 2175,

  // 이동 평균 평활화
  smoothingList(arr, windowSize) {
    const out = [];
    for (let i = 0; i <= arr.length - windowSize; i++) {
      let sum = 0;
      for (let j = i; j < i + windowSize; j++) {
        sum += arr[j];
      }
      out.push(sum / windowSize);
    }
    return out;
  },

  // 스크롤 영역 시작/끝 인덱스 탐색 (클러스터 기반 + 내부 분할)
  //
  // 핵심 문제: 상태바(약한 차분) → 헤더(차분 0) → 인자 목록(강한 차분)에서
  // 이동 평균이 헤더의 0 구간을 평활화로 메워버려 상태바~인자가 하나의
  // 거대한 클러스터로 합쳐질 수 있다.
  //
  // 해결: 클러스터 내부에 "차분이 거의 0인 구간"이 일정 길이 이상 존재하면
  // 그 지점에서 분할하고, 분할된 서브클러스터 중 가장 큰 것을 채택한다.
  detectScrollArea(rawDiffs, smoothedDiffs, windowSize, thresV1, thresV2, totalHeight) {
    // 1. 평활화 리스트에서 thresV2 초과하는 연속 구간(클러스터) 수집
    const clusters = [];
    let clusterStart = -1;

    for (let i = 0; i < smoothedDiffs.length; i++) {
      if (smoothedDiffs[i] > thresV2) {
        if (clusterStart === -1) {
          clusters.push({ startI: i, endI: i, vSum: smoothedDiffs[i] });
          clusterStart = i;
        } else {
          clusters[clusters.length - 1].endI = i;
          clusters[clusters.length - 1].vSum += smoothedDiffs[i];
        }
      } else {
        clusterStart = -1;
      }
    }

    if (clusters.length === 0) {
      return { v1: -1, v2: -1 };
    }

    // 2. 가장 큰 클러스터 선택
    clusters.sort((a, b) => b.vSum - a.vSum);
    let best = clusters[0];

    // 3. 클러스터 내부 분할:
    //    rawDiffs에서 best 클러스터 내부를 스캔하여
    //    "차분 < thresV2 / 2 인 행이 (totalHeight * 5%) 이상 연속"인 구간이 있으면 분할
    const minGap = Math.floor((totalHeight || rawDiffs.length) * 0.25);
    const gapThres = thresV2 / 2;

    let subClusters = [];
    let subStart = best.startI;
    let gapCount = 0;

    for (let i = best.startI; i <= best.endI; i++) {
      if (rawDiffs[i] < gapThres) {
        gapCount++;
      } else {
        if (gapCount >= minGap && i - gapCount > subStart) {
          // 갭 발견 → 이전 구간을 서브클러스터로 저장
          const subEnd = i - gapCount - 1;
          let subSum = 0;
          for (let k = subStart; k <= subEnd; k++) subSum += rawDiffs[k];
          subClusters.push({ startI: subStart, endI: subEnd, vSum: subSum });
          subStart = i;
        }
        gapCount = 0;
      }
    }
    // 마지막 서브클러스터
    let subSum = 0;
    for (let k = subStart; k <= best.endI; k++) subSum += rawDiffs[k];
    subClusters.push({ startI: subStart, endI: best.endI, vSum: subSum });

    // 분할이 발생했으면 가장 큰 서브클러스터 채택
    if (subClusters.length > 1) {
      subClusters.sort((a, b) => b.vSum - a.vSum);
      best = subClusters[0];
      console.log(`클러스터 분할: ${subClusters.length}개 → 최대 서브클러스터 [${best.startI}~${best.endI}]`);
    }

    // 4. 비평활화 리스트에서 정확한 경계 탐색
    let v1 = best.startI;
    v1 = rawDiffs.findIndex((e, i) => i >= v1 && e > thresV1);

    let v2 = -1;
    for (let i = Math.min(best.endI + windowSize, rawDiffs.length - 1); i >= best.startI; i--) {
      if (rawDiffs[i] > thresV2) {
        v2 = i;
        break;
      }
    }

    return { v1, v2 };
  },

  // 해상도 통일 및 장변 제한
  normalizeResolution(mats) {
    if (mats.length <= 1) return mats;

    // 장변 2175px 제한
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m.rows > this.LIMIT_PX || m.cols > this.LIMIT_PX) {
        let dst = new cv.Mat();
        let dsize;
        if (m.rows > m.cols) {
          dsize = new cv.Size(Math.floor(this.LIMIT_PX / m.rows * m.cols), this.LIMIT_PX);
        } else {
          dsize = new cv.Size(this.LIMIT_PX, Math.floor(this.LIMIT_PX / m.cols * m.rows));
        }
        cv.resize(m, dst, dsize);
        m.delete();
        mats[i] = dst;
      }
    }

    // 해상도가 다르면 최소 너비 기준으로 리사이즈
    const widths = mats.map(m => m.cols);
    const heights = mats.map(m => m.rows);
    const allSameSize = (Math.min(...widths) === Math.max(...widths)) &&
                        (Math.min(...heights) === Math.max(...heights));

    if (!allSameSize) {
      const minW = Math.min(...widths);
      for (let i = 0; i < mats.length; i++) {
        if (mats[i].cols !== minW) {
          const scale = minW / mats[i].cols;
          const dst = new cv.Mat();
          const dsize = new cv.Size(minW, Math.floor(mats[i].rows * scale));
          cv.resize(mats[i], dst, dsize);
          mats[i].delete();
          mats[i] = dst;
        }
      }
    }

    return mats;
  },

  // 고정 영역 감지: 이미지 쌍별 차분의 **최대값**으로 스크롤 영역 검출
  // 평균 대신 최대값을 사용하면, 한 쌍이라도 차이가 나는 행은 스크롤 영역으로 판정됨.
  // → 이미지 간 겹침 영역이 diff=0이 되어 스크롤 영역이 축소되는 문제 방지.
  detectFixedAreas(mats) {
    if (mats.length <= 1) {
      return [{
        scrollY1: 0,
        scrollY2: mats[0].rows,
        headerHeight: 0,
        footerHeight: 0
      }];
    }

    // 모든 쌍을 비교하여 행별 최대 차분을 구함
    const maxRowDiffs = new Array(mats[0].rows).fill(0);
    const grays = [];
    for (let i = 0; i < mats.length; i++) {
      const g = new cv.Mat();
      cv.cvtColor(mats[i], g, cv.COLOR_RGBA2GRAY);
      grays.push(g);
    }

    for (let a = 0; a < mats.length; a++) {
      for (let b = a + 1; b < mats.length; b++) {
        const diff = new cv.Mat();
        cv.absdiff(grays[a], grays[b], diff);

        for (let y = 0; y < diff.rows; y++) {
          let sum = 0;
          for (let x = 0; x < diff.cols; x++) {
            sum += diff.ucharAt(y, x);
          }
          const rowDiff = sum / diff.cols;
          maxRowDiffs[y] = Math.max(maxRowDiffs[y], rowDiff);
        }

        diff.delete();
      }
    }

    grays.forEach(g => g.delete());

    const rowDiffs = maxRowDiffs;

    // 평활화
    const smoothed = this.smoothingList(rowDiffs, this.DIFF_WINDOW_SIZE);
    console.log('행별 차분 (상위 10):', [...smoothed].sort((a, b) => b - a).slice(0, 10));

    // 클러스터 기반 스크롤 영역 탐색 (totalHeight 전달로 내부 분할 기준 계산)
    const area = this.detectScrollArea(
      rowDiffs, smoothed, this.DIFF_WINDOW_SIZE,
      this.THRES_DIFF_Y1, this.THRES_DIFF_Y2, mats[0].rows
    );

    let globalY1, globalY2;

    if (area.v1 !== -1 && area.v2 !== -1) {
      globalY1 = area.v1;
      globalY2 = area.v2;
    } else {
      // 감지 실패 → 전체를 스크롤 영역으로
      globalY1 = 0;
      globalY2 = mats[0].rows;
    }

    // 검증 및 폴백
    const scrollRatio = (globalY2 - globalY1) / mats[0].rows;
    console.log(`스크롤 영역 (1차): ${globalY1} ~ ${globalY2} (헤더: ${globalY1}px=${(globalY1/mats[0].rows*100).toFixed(1)}%, 스크롤: ${globalY2-globalY1}px=${(scrollRatio*100).toFixed(1)}%, 푸터: ${mats[0].rows-globalY2}px)`);

    // 스크롤 영역이 20% 미만이면 감지 실패로 판단
    // → 전체를 쓰지 않고, 하단 고정 영역(네비바)만 제거한 나머지를 스크롤 영역으로 사용
    if (scrollRatio < 0.30) {
      console.warn(`스크롤 영역이 ${(scrollRatio*100).toFixed(1)}%로 너무 작음 → 하단 고정 영역 재감지`);

      // rowDiffs를 하단에서 위로 스캔하여 고정 영역(네비바) 경계 탐색
      // 하단에서 diff가 낮은 연속 구간 = 고정 네비바
      let footerStart = rowDiffs.length;
      const footerThres = this.THRES_DIFF_Y2;
      for (let y = rowDiffs.length - 1; y >= 0; y--) {
        if (rowDiffs[y] > footerThres) {
          footerStart = y + 1;
          break;
        }
      }

      // 상단도 동일하게 스캔 — 상단에서 diff가 낮은 연속 구간 = 고정 헤더(있는 경우)
      let headerEnd = 0;
      for (let y = 0; y < rowDiffs.length; y++) {
        if (rowDiffs[y] > footerThres) {
          headerEnd = y;
          break;
        }
      }

      globalY1 = headerEnd;
      globalY2 = footerStart;

      const newScrollRatio = (globalY2 - globalY1) / mats[0].rows;
      console.log(`재감지 결과: ${globalY1} ~ ${globalY2} (헤더: ${globalY1}px, 스크롤: ${globalY2-globalY1}px=${(newScrollRatio*100).toFixed(1)}%, 푸터: ${mats[0].rows-globalY2}px)`);

      // 그래도 너무 작으면 전체 사용
      if (newScrollRatio < 0.10) {
        console.warn('재감지도 실패 → 전체를 스크롤 영역으로 처리');
        globalY1 = 0;
        globalY2 = mats[0].rows;
      }
    }

    const results = [];
    for (let i = 0; i < mats.length; i++) {
      results.push({
        scrollY1: globalY1,
        scrollY2: globalY2,
        headerHeight: globalY1,
        footerHeight: mats[i].rows - globalY2
      });
    }

    return results;
  },

  // 스크롤 영역 추출: 각 이미지를 header/scroll/footer/bottom_row 등으로 분리
  extractScrollRegions(mats, fixedAreas) {
    const imgs = [];

    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      const fa = fixedAreas[i];
      const obj = {};

      // 헤더 (고정 영역 상단)
      if (fa.headerHeight > 0) {
        obj.header = m.roi(new cv.Rect(0, 0, m.cols, fa.headerHeight)).clone();
      }

      // 스크롤 영역
      const scrollH = fa.scrollY2 - fa.scrollY1;
      obj.scroll = m.roi(new cv.Rect(0, fa.scrollY1, m.cols, scrollH)).clone();

      // 푸터 (고정 영역 하단)
      if (fa.footerHeight > 0) {
        obj.footer = m.roi(new cv.Rect(0, fa.scrollY2, m.cols, fa.footerHeight)).clone();
      }

      // bottom_row: 스크롤 영역 하단 1/3 (매칭 템플릿 — matcher.js에서 직접 생성하므로 여기서는 참조용)
      const brH = Math.max(1, Math.floor(scrollH / 3));
      obj.bottom_row = obj.scroll.roi(new cv.Rect(0, scrollH - brH, obj.scroll.cols, brH)).clone();

      // bottom_row_higher: 스크롤 영역 하단 1/2 (폴백용)
      const brhH = Math.max(1, Math.floor(scrollH / 2));
      obj.bottom_row_higher = obj.scroll.roi(new cv.Rect(0, scrollH - brhH, obj.scroll.cols, brhH)).clone();

      imgs.push(obj);
    }

    return imgs;
  },

  // 이미지 파츠 메모리 해제
  cleanupImgs(imgs) {
    const parts = ['header', 'scroll', 'footer', 'bottom_row', 'bottom_row_higher'];
    imgs.forEach(img => {
      parts.forEach(p => {
        if (img[p]) {
          img[p].delete();
          img[p] = null;
        }
      });
    });
  }
};

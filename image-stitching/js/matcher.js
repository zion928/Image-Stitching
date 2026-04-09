// matcher.js — 스크롤바 기반 순서 결정 + 픽셀 슬라이딩 겹침 매칭

const Matcher = {
  // 스크롤바 감지
  SCROLLBAR_WIDTH: 8,
  SCROLLBAR_BRIGHTNESS: 210,
  SCROLLBAR_H_RATIO: 0.90,

  // 겹침 매칭
  MIN_OVERLAP_RATIO: 0.05,
  MAX_OVERLAP_RATIO: 0.92,
  THRES_PIXEL_DIFF: 10,
  THRES_BAD_PIXEL_RATIO: 0.08,
  BAD_PIXEL_THRESHOLD: 20,
  COARSE_STEP: 8,

  // ── 스크롤바 감지 ──

  detectScrollBarByDiff(grays) {
    const n = grays.length;
    const h = grays[0].rows;
    const w = grays[0].cols;
    const barW = Math.min(this.SCROLLBAR_WIDTH, Math.floor(w * 0.05));
    const startX = w - barW;

    const allBrightness = [];
    for (let idx = 0; idx < n; idx++) {
      const rowB = [];
      for (let y = 0; y < h; y++) {
        let minVal = 255;
        for (let x = startX; x < w; x++) {
          minVal = Math.min(minVal, grays[idx].ucharAt(y, x));
        }
        rowB.push(minVal);
      }
      allBrightness.push(rowB);
    }

    const bars = [];
    for (let idx = 0; idx < n; idx++) {
      const diffFromAvg = [];
      for (let y = 0; y < h; y++) {
        let otherSum = 0, otherCount = 0;
        for (let other = 0; other < n; other++) {
          if (other !== idx) { otherSum += allBrightness[other][y]; otherCount++; }
        }
        const otherAvg = otherSum / otherCount;
        diffFromAvg.push(otherAvg - allBrightness[idx][y]);
      }

      const thres = 5;
      let bestStart = -1, bestEnd = -1, bestSum = 0;
      let curStart = -1, curSum = 0;

      for (let y = 0; y < h; y++) {
        if (diffFromAvg[y] > thres) {
          if (curStart === -1) curStart = y;
          curSum += diffFromAvg[y];
        } else {
          if (curStart !== -1 && curSum > bestSum) {
            bestStart = curStart; bestEnd = y - 1; bestSum = curSum;
          }
          curStart = -1; curSum = 0;
        }
      }
      if (curStart !== -1 && curSum > bestSum) {
        bestStart = curStart; bestEnd = h - 1; bestSum = curSum;
      }

      if (bestStart !== -1) {
        bars.push({ y: Math.floor((bestStart + bestEnd) / 2), h: bestEnd - bestStart, sum: bestSum });
      } else {
        bars.push({ y: -1, h: -1, sum: 0 });
      }
    }
    return bars;
  },

  getOrderByScrollBar(imgs) {
    const n = imgs.length;
    if (n < 2) return null;

    const grays = [];
    for (let i = 0; i < n; i++) {
      const gray = new cv.Mat();
      cv.cvtColor(imgs[i].scroll, gray, cv.COLOR_RGBA2GRAY);
      grays.push(gray);
    }

    const bars = this.detectScrollBarByDiff(grays);
    grays.forEach(g => g.delete());

    for (let i = 0; i < n; i++) {
      console.log(`  이미지 ${i}: 스크롤바 y=${bars[i].y}, h=${bars[i].h}`);
    }

    const detected = bars.filter(b => b.y !== -1);
    if (detected.length < n) {
      console.log('스크롤바 감지 실패: 일부 이미지에서 스크롤바를 찾을 수 없음');
      return null;
    }

    const uniqueY = new Set(bars.map(b => b.y));
    if (uniqueY.size < 2) {
      console.log('스크롤바 감지 실패: 모든 이미지에서 동일한 위치');
      return null;
    }

    const heights = bars.map(b => b.h);
    const hMin = Math.min(...heights);
    const hMax = Math.max(...heights);
    if (hMax > 0 && hMin / hMax < this.SCROLLBAR_H_RATIO) {
      console.log(`스크롤바 감지 실패: 높이 불일치 (${heights.join(', ')}, min/max=${(hMin/hMax).toFixed(3)})`);
      return null;
    }

    const indexed = bars.map((b, i) => ({ index: i, y: b.y }));
    indexed.sort((a, b) => a.y - b.y);

    const order = indexed.map(item => item.index);
    console.log('스크롤바 기반 순서:', order, '(y좌표:', indexed.map(item => item.y), ')');
    return order;
  },

  // ── 픽셀 슬라이딩 겹침 매칭 ──

  // 전수 검사 (최종 검증용만 사용)
  calcDiffMetrics(grayA, grayB, startYa, startYb, height, width) {
    let sum = 0, badCount = 0, count = 0;
    // 2px 간격 샘플링 (속도 4배 향상, 정확도 유지)
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const d = Math.abs(grayA.ucharAt(startYa + y, x) - grayB.ucharAt(startYb + y, x));
        sum += d;
        if (d > this.BAD_PIXEL_THRESHOLD) badCount++;
        count++;
      }
    }
    return {
      meanDiff: count > 0 ? sum / count : 999,
      badRatio: count > 0 ? badCount / count : 1
    };
  },

  // 거친 탐색용 (극도로 빠른 샘플링)
  calcMeanDiffSampled(grayA, grayB, startYa, startYb, height, width, sampleRows) {
    let sum = 0, count = 0;
    const step = Math.max(1, Math.floor(height / sampleRows));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += 4) {
        sum += Math.abs(grayA.ucharAt(startYa + y, x) - grayB.ucharAt(startYb + y, x));
        count++;
      }
    }
    return count > 0 ? sum / count : 999;
  },

  findOverlap(grayI, grayJ) {
    const hI = grayI.rows, hJ = grayJ.rows;
    const w = Math.min(grayI.cols, grayJ.cols);
    const minH = Math.min(hI, hJ);
    const minOverlap = Math.max(10, Math.floor(minH * this.MIN_OVERLAP_RATIO));
    const maxOverlap = Math.floor(minH * this.MAX_OVERLAP_RATIO);
    if (maxOverlap <= minOverlap) return null;

    // 1단계: 거친 탐색 — diff가 낮은 후보를 여러 개 수집
    const candidates = [];
    for (let overlap = minOverlap; overlap <= maxOverlap; overlap += this.COARSE_STEP) {
      const diff = this.calcMeanDiffSampled(grayI, grayJ, hI - overlap, 0, overlap, w, 20);
      candidates.push({ overlap, diff });
    }

    // diff 기준 상위 후보들을 선별 (bestDiff * 1.5 이내)
    candidates.sort((a, b) => a.diff - b.diff);
    if (candidates[0].diff > this.THRES_PIXEL_DIFF * 2) return null;

    const diffCutoff = Math.max(candidates[0].diff * 1.5, candidates[0].diff + 2);
    const topCandidates = candidates.filter(c => c.diff <= diffCutoff);

    // 2단계: 각 후보 주변을 정밀 탐색 (샘플링으로 빠르게)
    let bestOverlap = -1, bestDiff = 999;

    for (const cand of topCandidates) {
      const fineStart = Math.max(minOverlap, cand.overlap - this.COARSE_STEP * 2);
      const fineEnd = Math.min(maxOverlap, cand.overlap + this.COARSE_STEP * 2);

      for (let overlap = fineStart; overlap <= fineEnd; overlap++) {
        const diff = this.calcMeanDiffSampled(grayI, grayJ, hI - overlap, 0, overlap, w, 40);
        if (diff < bestDiff - 0.3 ||
            (Math.abs(diff - bestDiff) <= 0.3 && overlap < bestOverlap)) {
          bestDiff = diff;
          bestOverlap = overlap;
        }
      }
    }

    if (bestOverlap === -1) return null;

    // 최종 검증 1회만 정밀 계산
    const final = this.calcDiffMetrics(grayI, grayJ, hI - bestOverlap, 0, bestOverlap, w);
    if (final.meanDiff > this.THRES_PIXEL_DIFF) return null;
    if (final.badRatio > this.THRES_BAD_PIXEL_RATIO) return null;

    return {
      overlap: bestOverlap,
      diff: final.meanDiff,
      badRatio: final.badRatio,
      offset: hI - bestOverlap
    };
  },

  findOverlapDebug(grayI, grayJ, idxI, idxJ) {
    const hI = grayI.rows, hJ = grayJ.rows;
    const w = Math.min(grayI.cols, grayJ.cols);
    const minH = Math.min(hI, hJ);
    const minOverlap = Math.max(10, Math.floor(minH * this.MIN_OVERLAP_RATIO));
    const maxOverlap = Math.floor(minH * this.MAX_OVERLAP_RATIO);
    if (maxOverlap <= minOverlap) return null;

    // 거친 탐색 — 후보 수집
    const candidates = [];
    for (let overlap = minOverlap; overlap <= maxOverlap; overlap += this.COARSE_STEP) {
      const diff = this.calcMeanDiffSampled(grayI, grayJ, hI - overlap, 0, overlap, w, 20);
      candidates.push({ overlap, diff });
    }

    candidates.sort((a, b) => a.diff - b.diff);
    console.log(`  ${idxI}->${idxJ}: 거친탐색 bestDiff=${candidates[0].diff.toFixed(2)}, bestOverlap=${candidates[0].overlap}`);

    if (candidates[0].diff > this.THRES_PIXEL_DIFF * 2) return null;

    const diffCutoff = Math.max(candidates[0].diff * 1.5, candidates[0].diff + 2);
    const topCandidates = candidates.filter(c => c.diff <= diffCutoff);

    // 정밀 탐색 (샘플링으로 빠르게)
    let bestOverlap = -1, bestDiff = 999;

    for (const cand of topCandidates) {
      const fineStart = Math.max(minOverlap, cand.overlap - this.COARSE_STEP * 2);
      const fineEnd = Math.min(maxOverlap, cand.overlap + this.COARSE_STEP * 2);

      for (let overlap = fineStart; overlap <= fineEnd; overlap++) {
        const diff = this.calcMeanDiffSampled(grayI, grayJ, hI - overlap, 0, overlap, w, 40);
        if (diff < bestDiff - 0.3 ||
            (Math.abs(diff - bestDiff) <= 0.3 && overlap < bestOverlap)) {
          bestDiff = diff;
          bestOverlap = overlap;
        }
      }
    }

    if (bestOverlap === -1) return null;

    // 최종 검증 1회만 정밀 계산
    const final = this.calcDiffMetrics(grayI, grayJ, hI - bestOverlap, 0, bestOverlap, w);

    if (final.meanDiff <= this.THRES_PIXEL_DIFF && final.badRatio <= this.THRES_BAD_PIXEL_RATIO) {
      console.log(`  ✓ ${idxI}->${idxJ}: overlap=${bestOverlap}px (${(bestOverlap/minH*100).toFixed(0)}%), diff=${final.meanDiff.toFixed(2)}, badRatio=${(final.badRatio*100).toFixed(1)}%`);
      return { overlap: bestOverlap, diff: final.meanDiff, badRatio: final.badRatio, offset: hI - bestOverlap };
    }

    console.log(`  ✗ ${idxI}->${idxJ}: diff=${final.meanDiff.toFixed(2)}, badRatio=${(final.badRatio*100).toFixed(1)}% (임계값 초과)`);
    return null;
  },

  // ── 메인 파이프라인 ──

  matchAllWithOrder(imgs) {
    const n = imgs.length;

    console.log('스크롤바 감지:');
    let order = this.getOrderByScrollBar(imgs);
    // 스크롤바가 감지되면 렌더링 시 크롭할 너비 계산
    const detectedBarW = order ? Math.min(this.SCROLLBAR_WIDTH, Math.floor(Math.min(imgs[0].scroll.cols) * 0.05)) : 0;

    if (!order) {
      console.log('스크롤바 감지 실패 → 전 쌍 매칭 폴백');
      const result = this.matchAllBruteForce(imgs);
      result.scrollbarWidth = 0;
      return result;
    }

    console.log('인접 쌍 겹침 매칭:');
    const grays = [];
    for (let i = 0; i < n; i++) {
      const gray = new cv.Mat();
      cv.cvtColor(imgs[i].scroll, gray, cv.COLOR_RGBA2GRAY);
      grays.push(gray);
    }

    const overlaps = [];
    for (let k = 0; k < order.length - 1; k++) {
      const i = order[k], j = order[k + 1];
      const match = this.findOverlap(grays[i], grays[j]);
      overlaps.push(match);
      if (match) {
        console.log(`  ✓ ${i}->${j}: overlap=${match.overlap}px, diff=${match.diff.toFixed(2)}, badRatio=${(match.badRatio*100).toFixed(1)}%`);
      } else {
        console.log(`  ✗ ${i}->${j}: 겹침 없음 → 단순 연결`);
      }
    }

    grays.forEach(g => g.delete());
    return { order, overlaps, scrollbarWidth: detectedBarW };
  },

  // 그리디 체인 빌딩: O(N²)로 최적 순서를 결정
  // 모든 (i→j) 쌍의 매칭 점수를 구한 뒤, 점수가 좋은 쌍부터 체인에 연결
  matchAllBruteForce(imgs) {
    const n = imgs.length;
    const grays = [];
    for (let i = 0; i < n; i++) {
      const gray = new cv.Mat();
      cv.cvtColor(imgs[i].scroll, gray, cv.COLOR_RGBA2GRAY);
      grays.push(gray);
    }

    console.log('모든 쌍 기본 매칭 (그리디 체인):');
    const pairResults = Array.from({ length: n }, () => new Array(n).fill(null));
    const edges = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const match = this.findOverlapDebug(grays[i], grays[j], i, j);
        if (match) {
          pairResults[i][j] = match;
          edges.push({ from: i, to: j, diff: match.diff });
        }
      }
    }

    grays.forEach(g => g.delete());

    // 점수 좋은 순서로 정렬
    edges.sort((a, b) => a.diff - b.diff);

    // 그리디 체인 빌딩: 각 노드는 최대 1개의 next, 1개의 prev만 가짐
    const next = new Array(n).fill(-1);
    const prev = new Array(n).fill(-1);
    let linkedCount = 0;

    for (const edge of edges) {
      if (linkedCount >= n - 1) break;
      const { from, to } = edge;
      // from의 next가 비어있고, to의 prev가 비어있고, 사이클이 생기지 않으면 연결
      if (next[from] !== -1 || prev[to] !== -1) continue;

      // 사이클 검사: to에서 next를 따라가면 from에 도달하는지
      let cur = from;
      let hasCycle = false;
      while (prev[cur] !== -1) {
        cur = prev[cur];
        if (cur === to) { hasCycle = true; break; }
      }
      if (hasCycle) continue;

      next[from] = to;
      prev[to] = from;
      linkedCount++;
    }

    // 체인의 시작점(prev가 없는 노드) 찾기
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (prev[i] === -1) { start = i; break; }
    }

    const order = [];
    let cur = start;
    const visited = new Set();
    while (cur !== -1 && !visited.has(cur)) {
      visited.add(cur);
      order.push(cur);
      cur = next[cur];
    }

    // 체인에 포함되지 않은 이미지 추가
    for (let i = 0; i < n; i++) {
      if (!visited.has(i)) order.push(i);
    }

    console.log(`그리디 체인 순서: [${order}] (연결된 쌍: ${linkedCount}/${n-1})`);

    const overlaps = [];
    for (let k = 0; k < order.length - 1; k++) {
      overlaps.push(pairResults[order[k]][order[k + 1]]);
    }

    return { order, overlaps };
  },

  resolveHeights(order, overlaps, imgs) {
    const n = imgs.length;
    const relativeHeights = new Array(n).fill(null);

    relativeHeights[order[0]] = 0;
    for (let k = 0; k < order.length - 1; k++) {
      const ci = order[k], cj = order[k + 1];
      const m = overlaps[k];
      if (m) {
        relativeHeights[cj] = relativeHeights[ci] + m.offset;
      } else {
        relativeHeights[cj] = relativeHeights[ci] + imgs[ci].scroll.rows;
      }
    }

    const placed = relativeHeights.filter(h => h !== null);
    if (placed.length > 0) {
      const minH = Math.min(...placed);
      for (let i = 0; i < n; i++) {
        if (relativeHeights[i] !== null) relativeHeights[i] -= minH;
      }
    }

    return relativeHeights;
  },

  alignMissing(relativeHeights, imgs) {
    let hasWarning = false;
    let maxBottom = 0;
    for (let i = 0; i < relativeHeights.length; i++) {
      if (relativeHeights[i] !== null) {
        maxBottom = Math.max(maxBottom, relativeHeights[i] + imgs[i].scroll.rows);
      }
    }
    for (let i = 0; i < relativeHeights.length; i++) {
      if (relativeHeights[i] === null) {
        relativeHeights[i] = maxBottom;
        maxBottom += imgs[i].scroll.rows;
        hasWarning = true;
      }
    }
    return hasWarning;
  }
};

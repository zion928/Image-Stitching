// matcher.js — 스크롤바 기반 순서 결정 + 픽셀 슬라이딩 겹침 매칭

const Matcher = {
  // 스크롤바 감지
  SCROLLBAR_WIDTH: 8,
  SCROLLBAR_BRIGHTNESS: 210,
  SCROLLBAR_H_RATIO: 0.90,

  // 겹침 매칭
  MIN_OVERLAP_RATIO: 0.05,
  MAX_OVERLAP_RATIO: 0.55,
  THRES_PIXEL_DIFF: 10,
  THRES_BAD_PIXEL_RATIO: 0.08,
  BAD_PIXEL_THRESHOLD: 20,
  COARSE_STEP: 4,

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

  calcDiffMetrics(grayA, grayB, startYa, startYb, height, width) {
    let sum = 0, badCount = 0, count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
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

  calcMeanDiffSampled(grayA, grayB, startYa, startYb, height, width, sampleRows) {
    let sum = 0, count = 0;
    const step = Math.max(1, Math.floor(height / sampleRows));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += 2) {
        sum += Math.abs(grayA.ucharAt(startYa + y, x) - grayB.ucharAt(startYb + y, x));
        count++;
      }
    }
    return count > 0 ? sum / count : 999;
  },

  findOverlap(grayI, grayJ) {
    const hI = grayI.rows, hJ = grayJ.rows;
    const w = Math.min(grayI.cols, grayJ.cols);
    const minOverlap = Math.max(10, Math.floor(Math.min(hI, hJ) * this.MIN_OVERLAP_RATIO));
    const maxOverlap = Math.floor(Math.min(hI, hJ) * this.MAX_OVERLAP_RATIO);
    if (maxOverlap <= minOverlap) return null;

    let bestOverlap = -1, bestDiff = 999;

    for (let overlap = minOverlap; overlap <= maxOverlap; overlap += this.COARSE_STEP) {
      const diff = this.calcMeanDiffSampled(grayI, grayJ, hI - overlap, 0, overlap, w, 20);
      if (diff < bestDiff) { bestDiff = diff; bestOverlap = overlap; }
    }

    if (bestDiff > this.THRES_PIXEL_DIFF * 2) return null;

    const fineStart = Math.max(minOverlap, bestOverlap - this.COARSE_STEP * 2);
    const fineEnd = Math.min(maxOverlap, bestOverlap + this.COARSE_STEP * 2);

    for (let overlap = fineStart; overlap <= fineEnd; overlap++) {
      const metrics = this.calcDiffMetrics(grayI, grayJ, hI - overlap, 0, overlap, w);
      if (metrics.meanDiff < bestDiff) { bestDiff = metrics.meanDiff; bestOverlap = overlap; }
    }

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
    const minOverlap = Math.max(10, Math.floor(Math.min(hI, hJ) * this.MIN_OVERLAP_RATIO));
    const maxOverlap = Math.floor(Math.min(hI, hJ) * this.MAX_OVERLAP_RATIO);
    if (maxOverlap <= minOverlap) return null;

    let bestOverlap = -1, bestDiff = 999;

    for (let overlap = minOverlap; overlap <= maxOverlap; overlap += this.COARSE_STEP) {
      const diff = this.calcMeanDiffSampled(grayI, grayJ, hI - overlap, 0, overlap, w, 20);
      if (diff < bestDiff) { bestDiff = diff; bestOverlap = overlap; }
    }

    console.log(`  ${idxI}->${idxJ}: 거친탐색 bestDiff=${bestDiff.toFixed(2)}, bestOverlap=${bestOverlap}`);

    if (bestDiff > this.THRES_PIXEL_DIFF * 2) return null;

    const fineStart = Math.max(minOverlap, bestOverlap - this.COARSE_STEP * 2);
    const fineEnd = Math.min(maxOverlap, bestOverlap + this.COARSE_STEP * 2);

    for (let overlap = fineStart; overlap <= fineEnd; overlap++) {
      const metrics = this.calcDiffMetrics(grayI, grayJ, hI - overlap, 0, overlap, w);
      if (metrics.meanDiff < bestDiff) { bestDiff = metrics.meanDiff; bestOverlap = overlap; }
    }

    const final = this.calcDiffMetrics(grayI, grayJ, hI - bestOverlap, 0, bestOverlap, w);

    if (final.meanDiff <= this.THRES_PIXEL_DIFF && final.badRatio <= this.THRES_BAD_PIXEL_RATIO) {
      console.log(`  ✓ ${idxI}->${idxJ}: overlap=${bestOverlap}px, diff=${final.meanDiff.toFixed(2)}, badRatio=${(final.badRatio*100).toFixed(1)}%`);
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

    if (!order) {
      console.log('스크롤바 감지 실패 → 전 쌍 매칭 폴백');
      return this.matchAllBruteForce(imgs);
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
    return { order, overlaps };
  },

  matchAllBruteForce(imgs) {
    const n = imgs.length;
    const grays = [];
    for (let i = 0; i < n; i++) {
      const gray = new cv.Mat();
      cv.cvtColor(imgs[i].scroll, gray, cv.COLOR_RGBA2GRAY);
      grays.push(gray);
    }

    console.log('모든 쌍 기본 매칭:');
    const pairResults = Array.from({ length: n }, () => new Array(n).fill(null));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const match = this.findOverlapDebug(grays[i], grays[j], i, j);
        if (match) pairResults[i][j] = match;
      }
    }

    grays.forEach(g => g.delete());

    const permutations = this.getPermutations([...Array(n).keys()]);
    console.log(`${n}장 → ${permutations.length}개 순열 탐색`);

    let bestOrder = null;
    let bestScore = { validPairs: -1, totalDiff: Infinity };

    for (const perm of permutations) {
      let validPairs = 0, totalDiff = 0;

      for (let k = 0; k < perm.length - 1; k++) {
        const m = pairResults[perm[k]][perm[k + 1]];
        if (m) { validPairs++; totalDiff += m.diff; }
        else { totalDiff += 100; }
      }

      if (validPairs > bestScore.validPairs ||
          (validPairs === bestScore.validPairs && totalDiff < bestScore.totalDiff)) {
        bestScore = { validPairs, totalDiff };
        bestOrder = [...perm];
      }
    }

    console.log(`최적 순열: [${bestOrder}] (유효쌍: ${bestScore.validPairs}/${n-1}, 총diff: ${bestScore.totalDiff.toFixed(2)})`);

    const overlaps = [];
    for (let k = 0; k < bestOrder.length - 1; k++) {
      overlaps.push(pairResults[bestOrder[k]][bestOrder[k + 1]]);
    }

    return { order: bestOrder, overlaps };
  },

  getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of this.getPermutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
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

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Auto Image Stitcher — Web Worker
// Runs all heavy image-processing work off the main thread.
// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = function (event) {
  const { type, payload } = event.data;
  if (type === 'stitch') {
    try {
      stitch(payload.images, payload.options);
    } catch (err) {
      self.postMessage({ type: 'error', payload: { message: err.message } });
    }
  }
};

function postProgress(percent, message) {
  self.postMessage({ type: 'progress', payload: { percent, message } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

function stitch(images, options) {
  if (!images || images.length === 0) throw new Error('No images provided.');

  // Validate
  const valid = images.filter(function (img) {
    return img && img.data && img.width > 0 && img.height > 0;
  });
  if (valid.length === 0) throw new Error('No valid images found.');

  if (valid.length === 1) {
    postProgress(100, '완료!');
    var single = valid[0];
    self.postMessage(
      { type: 'result', payload: { data: single.data, width: single.width, height: single.height } },
      [single.data.buffer]
    );
    return;
  }

  postProgress(5, '이미지 분석 중…');
  var imgs = valid;
  var sigs = imgs.map(computeRowSignatures);

  // Step 1 – Fixed-UI removal
  if (options.removeFixedUI) {
    postProgress(15, '고정 UI 감지 중…');
    var fixed = detectFixedUI(imgs, sigs);
    if (fixed.headerH > 0 || fixed.footerH > 0) {
      imgs = imgs.map(function (img) { return cropImage(img, fixed.headerH, fixed.footerH); });
      sigs = imgs.map(computeRowSignatures);
    }
  }

  // Step 2 – Auto-reorder
  if (options.autoReorder) {
    postProgress(25, '이미지 순서 정렬 중…');
    var ordered = autoReorder(imgs, sigs);
    imgs = ordered.images;
    sigs = ordered.sigs;
  }

  // Step 3 – Merge
  postProgress(50, '이미지 병합 중…');
  var result = mergeImages(imgs, sigs, function (p) {
    postProgress(50 + Math.round(p * 48), '이미지 병합 중…');
  });

  postProgress(100, '병합 완료!');
  self.postMessage(
    { type: 'result', payload: { data: result.data, width: result.width, height: result.height } },
    [result.data.buffer]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row signatures
// Average R, G, B per row (sampled for speed).
// Returns Float32Array of length height × 3.
// ─────────────────────────────────────────────────────────────────────────────

function computeRowSignatures(img) {
  var data = img.data, width = img.width, height = img.height;
  var sigs = new Float32Array(height * 3);
  // 128 samples per row: benchmarks show this provides accurate row signatures
  // while keeping the signature computation fast enough for images up to ~4K wide.
  var step = Math.max(1, Math.floor(width / 128));

  for (var y = 0; y < height; y++) {
    var r = 0, g = 0, b = 0, count = 0;
    for (var x = 0; x < width; x += step) {
      var i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    sigs[y * 3]     = r / count;
    sigs[y * 3 + 1] = g / count;
    sigs[y * 3 + 2] = b / count;
  }
  return sigs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlap detection
// Finds how many rows at the bottom of imgA overlap with the top of imgB.
// Uses a coarse→fine search for speed.
// ─────────────────────────────────────────────────────────────────────────────

function computeOverlapScore(sigsA, hA, sigsB, overlap) {
  var total = 0;
  for (var i = 0; i < overlap; i++) {
    var aRow = hA - overlap + i;
    var bRow = i;
    var dr = sigsA[aRow * 3]     - sigsB[bRow * 3];
    var dg = sigsA[aRow * 3 + 1] - sigsB[bRow * 3 + 1];
    var db = sigsA[aRow * 3 + 2] - sigsB[bRow * 3 + 2];
    total += Math.abs(dr) + Math.abs(dg) + Math.abs(db);
  }
  return total / overlap; // average per-row SAD (lower = better)
}

function findOverlap(sigsA, hA, sigsB, hB) {
  var minO = Math.max(10, Math.floor(Math.min(hA, hB) * 0.05));
  var maxO = Math.floor(Math.min(hA, hB) * 0.92);
  if (minO >= maxO) return { overlap: 0, score: Infinity, reliable: false };

  // Coarse pass
  var coarseStep = Math.max(1, Math.floor((maxO - minO) / 120));
  var coarseBest = minO, coarseBestScore = Infinity;
  for (var o = minO; o <= maxO; o += coarseStep) {
    var s = computeOverlapScore(sigsA, hA, sigsB, o);
    if (s < coarseBestScore) { coarseBestScore = s; coarseBest = o; }
  }

  // Fine pass around coarse best
  var fineMin = Math.max(minO, coarseBest - coarseStep * 2);
  var fineMax = Math.min(maxO, coarseBest + coarseStep * 2);
  var bestO = coarseBest, bestScore = coarseBestScore;
  for (var o2 = fineMin; o2 <= fineMax; o2++) {
    var s2 = computeOverlapScore(sigsA, hA, sigsB, o2);
    if (s2 < bestScore) { bestScore = s2; bestO = o2; }
  }

  // Per-channel average SAD threshold: empirically, genuine overlaps score < 5 for clean
  // images and < 15 for JPEG-compressed captures; 20 gives a comfortable safety margin.
  var OVERLAP_RELIABILITY_THRESHOLD = 20;
  var reliable = bestScore < OVERLAP_RELIABILITY_THRESHOLD;
  return { overlap: reliable ? bestO : 0, score: bestScore, reliable: reliable };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixed-UI detection
// Rows that are visually identical across all images are fixed UI (header/footer).
// ─────────────────────────────────────────────────────────────────────────────

function detectFixedUI(imgs, sigs) {
  var n = imgs.length;
  var minH = imgs.reduce(function (m, img) { return Math.min(m, img.height); }, Infinity);
  var maxSearch = Math.floor(minH * 0.25);
  // Per-channel tolerance: accounts for JPEG compression artifacts while still
  // distinguishing scrolled content (where row colours differ significantly).
  var PER_CHANNEL_TOLERANCE = 12;

  function rowFixed(y) {
    for (var i = 1; i < n; i++) {
      var r0 = sigs[0][y * 3], g0 = sigs[0][y * 3 + 1], b0 = sigs[0][y * 3 + 2];
      var ri = sigs[i][y * 3], gi = sigs[i][y * 3 + 1], bi = sigs[i][y * 3 + 2];
      if ((Math.abs(r0 - ri) + Math.abs(g0 - gi) + Math.abs(b0 - bi)) / 3 > PER_CHANNEL_TOLERANCE) return false;
    }
    return true;
  }

  // Header: scan top down
  var headerH = 0;
  for (var y = 0; y < maxSearch; y++) {
    if (rowFixed(y)) headerH = y + 1; else break;
  }

  // Footer: scan bottom up
  var footerH = 0;
  for (var yf = 0; yf < maxSearch; yf++) {
    var ay = minH - 1 - yf;
    if (rowFixed(ay)) footerH = yf + 1; else break;
  }

  return { headerH: headerH, footerH: footerH };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crop image (remove header/footer rows)
// ─────────────────────────────────────────────────────────────────────────────

function cropImage(img, headerH, footerH) {
  var newH = img.height - headerH - footerH;
  if (newH <= 0) return img;
  var newData = new Uint8ClampedArray(img.width * newH * 4);
  var rowBytes = img.width * 4;
  for (var y = 0; y < newH; y++) {
    var srcOff = (y + headerH) * rowBytes;
    newData.set(img.data.subarray(srcOff, srcOff + rowBytes), y * rowBytes);
  }
  return { data: newData, width: img.width, height: newH };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-reorder
// Finds the correct top-to-bottom ordering using pairwise overlap scores.
// Greedy nearest-neighbour starting from the image least likely to be preceded
// by any other image.
// ─────────────────────────────────────────────────────────────────────────────

function autoReorder(imgs, sigs) {
  var n = imgs.length;
  if (n <= 1) return { images: imgs, sigs: sigs };

  // Build pairwise score matrix: score[i][j] = quality if i is directly above j
  var scores = [];
  for (var i = 0; i < n; i++) {
    scores.push([]);
    for (var j = 0; j < n; j++) {
      if (i === j) { scores[i].push(Infinity); continue; }
      var res = findOverlap(sigs[i], imgs[i].height, sigs[j], imgs[j].height);
      scores[i].push(res.score);
    }
  }

  // Find start image: the one with the worst best-predecessor score
  // (i.e. no image fits well above it → it is the topmost image)
  var startIdx = 0, maxMinPred = -Infinity;
  for (var ii = 0; ii < n; ii++) {
    var minPred = Infinity;
    for (var jj = 0; jj < n; jj++) {
      if (jj !== ii) minPred = Math.min(minPred, scores[jj][ii]);
    }
    if (minPred > maxMinPred) { maxMinPred = minPred; startIdx = ii; }
  }

  // Greedily build the chain
  var used = new Array(n).fill(false);
  var order = [startIdx];
  used[startIdx] = true;

  while (order.length < n) {
    var last = order[order.length - 1];
    var bestNext = -1, bestScore = Infinity;
    for (var k = 0; k < n; k++) {
      if (!used[k] && scores[last][k] < bestScore) {
        bestScore = scores[last][k];
        bestNext = k;
      }
    }
    if (bestNext === -1) {
      // fallback: append remaining in original order
      for (var r = 0; r < n; r++) { if (!used[r]) { order.push(r); used[r] = true; } }
      break;
    }
    order.push(bestNext);
    used[bestNext] = true;
  }

  return {
    images: order.map(function (idx) { return imgs[idx]; }),
    sigs:   order.map(function (idx) { return sigs[idx]; })
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge images
// Stacks images vertically, skipping the overlapping rows at the top of each
// subsequent image.
// ─────────────────────────────────────────────────────────────────────────────

function mergeImages(imgs, sigs, onProgress) {
  if (imgs.length === 0) throw new Error('No images to merge.');
  if (imgs.length === 1) return imgs[0];

  var width = imgs[0].width;

  // Find seams between consecutive pairs
  var cuts = []; // cuts[i] = rows to skip at the top of imgs[i+1]
  for (var i = 0; i < imgs.length - 1; i++) {
    var res = findOverlap(sigs[i], imgs[i].height, sigs[i + 1], imgs[i + 1].height);
    cuts.push(res.reliable ? res.overlap : 0);
    if (onProgress) onProgress((i + 1) / (imgs.length - 1));
  }

  // Compute total output height
  var totalH = imgs[0].height;
  for (var j = 1; j < imgs.length; j++) {
    totalH += imgs[j].height - cuts[j - 1];
  }

  var rowBytes = width * 4;
  var result = new Uint8ClampedArray(width * totalH * 4);
  var dstY = 0;

  for (var idx = 0; idx < imgs.length; idx++) {
    var img = imgs[idx];
    var startY = idx === 0 ? 0 : cuts[idx - 1];
    var copyW = Math.min(img.width, width);

    for (var y = startY; y < img.height; y++) {
      var srcOff = y * img.width * 4;
      var dstOff = dstY * width * 4;
      // Fast copy when widths match
      if (copyW === width) {
        result.set(img.data.subarray(srcOff, srcOff + rowBytes), dstOff);
      } else {
        // Different width: copy pixel by pixel up to min width
        for (var x = 0; x < copyW; x++) {
          result[dstOff + x * 4]     = img.data[srcOff + x * 4];
          result[dstOff + x * 4 + 1] = img.data[srcOff + x * 4 + 1];
          result[dstOff + x * 4 + 2] = img.data[srcOff + x * 4 + 2];
          result[dstOff + x * 4 + 3] = img.data[srcOff + x * 4 + 3];
        }
      }
      dstY++;
    }
  }

  return { data: result, width: width, height: totalH };
}

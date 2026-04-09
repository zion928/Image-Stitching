// i18n.js — 다국어 지원 (한국어/영어) + 다크모드

const I18n = {
  current: 'ko',

  texts: {
    ko: {
      title: '스크롤 캡처 자동 병합',
      dragDrop: '여기에 파일을 드래그 앤 드롭',
      orFile: '또는',
      pasteClip: '클립보드에서 붙여넣기',
      autoSort: '자동으로 순서를 정렬하므로 순서는 신경쓰지 않아도 됩니다',
      showHeader: '헤더 표시',
      stitch: '병합',
      reset: '리셋',
      saveJPG: 'JPG로 저장',
      savePNG: 'PNG로 저장',
      copyClip: '클립보드에 복사',
      resultHere: '여기에 결과가 표시됩니다',
      clickToggle: '이미지를 클릭하면 크기를 전환합니다',
      howToUse: '사용 방법',
      step1Title: '1. 스크린샷 촬영',
      step1Desc: '화면을 스크롤하며 스크린샷을 여러 장 촬영합니다.',
      step2Title: '2. 업로드',
      step2Desc: '촬영한 스크린샷을 드래그 앤 드롭, 파일 선택, 또는 Ctrl+V로 업로드합니다.',
      step2Desc2: '순서는 자동으로 정렬되므로 신경 쓰지 않아도 됩니다.',
      step3Title: '3. 병합',
      step3Desc: '"병합" 버튼을 클릭합니다. 이미지 수에 따라 즉시~수십 초 소요됩니다.',
      step4Title: '4. 저장',
      step4Desc: '결과를 확인하고 JPG/PNG 저장 또는 클립보드 복사를 합니다.',
      guideTitle: '촬영 가이드',
      guideReq: '필수 조건',
      guideReq1: '인접 이미지 간 <strong>최소 2~3줄 이상 겹치도록</strong> 촬영해 주세요.',
      guideReq2: '같은 화면을 스크롤하며 촬영한 이미지여야 합니다.',
      guideReq3: '모든 이미지의 <strong>해상도(가로x세로)가 동일</strong>해야 합니다.',
      guideReq4: '최소 <strong>2장 이상</strong>, 최대 8장까지 권장합니다.',
      guideGood: '잘 되는 경우',
      guideGood1: '스크롤바가 보이는 화면 (게임 상세, 설정 등) — 자동 순서 정렬 가능',
      guideGood2: '고정 헤더/하단바가 있는 화면 (메신저, 게임 UI 등)',
      guideGood3: '전체 화면 캡처 (Alt+PrintScreen, 폰 기본 스크린샷)',
      guideBad: '잘 안 되는 경우',
      guideBad1: '수동으로 크롭하거나 편집한 이미지',
      guideBad2: '겹치는 영역이 전혀 없거나 1줄 미만인 경우',
      guideBad3: '서로 다른 페이지/화면의 스크린샷을 혼합한 경우',
      guideBad4: '스크롤 사이에 화면 내용이 변경된 경우 (실시간 피드 등)',
      footer: 'image-stitching | 클라이언트 사이드 처리 (서버 전송 없음)',
      // 에러 메시지
      errNoImage: '이미지가 업로드되지 않았습니다.',
      errMinTwo: '2장 이상의 이미지가 필요합니다.',
      errCvNotReady: '라이브러리 로드가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      errNoOverlap: '이미지 간 겹치는 영역을 찾을 수 없습니다.\n\n아래 조건을 확인해 주세요:\n· 인접 이미지 간 최소 2~3줄 이상 겹치도록 촬영\n· 동일한 화면을 스크롤하며 촬영한 이미지인지 확인\n· 수동으로 크롭/편집한 이미지는 지원하지 않습니다',
      errLowOverlap: '이미지 간 겹치는 영역이 부족합니다 ({0}/{1}쌍만 매칭).\n\n촬영 시 이전 화면과 2~3줄 이상 겹치도록 스크롤해 주세요.',
      errLowQuality: '매칭 품질이 낮아 자연스러운 병합이 어렵습니다.\n\n아래 조건을 확인해 주세요:\n· 같은 화면을 스크롤하며 촬영한 이미지인지 확인\n· 촬영 사이에 화면 내용이 변경되지 않았는지 확인\n· 이미지가 압축되거나 편집되지 않았는지 확인',
      errClipboardEmpty: '클립보드에 이미지가 없습니다.',
      errClipboardFail: '클립보드에서 이미지를 읽을 수 없습니다. 브라우저가 지원하지 않을 수 있습니다.',
      errCopyFail: '클립보드에 복사할 수 없습니다. 브라우저가 지원하지 않을 수 있습니다.',
      msgCopied: '클립보드에 복사되었습니다.'
    },
    en: {
      title: 'Auto Scroll Capture Stitcher',
      dragDrop: 'Drag & drop files here',
      orFile: 'or',
      pasteClip: 'Paste from clipboard',
      autoSort: 'Images are automatically sorted — order does not matter',
      showHeader: 'Show header',
      stitch: 'Stitch',
      reset: 'Reset',
      saveJPG: 'Save as JPG',
      savePNG: 'Save as PNG',
      copyClip: 'Copy to clipboard',
      resultHere: 'Result will appear here',
      clickToggle: 'Click the image to toggle size',
      howToUse: 'How to use',
      step1Title: '1. Take screenshots',
      step1Desc: 'Scroll through the screen and take multiple screenshots.',
      step2Title: '2. Upload',
      step2Desc: 'Upload screenshots via drag & drop, file picker, or Ctrl+V.',
      step2Desc2: 'Images are automatically sorted — order does not matter.',
      step3Title: '3. Stitch',
      step3Desc: 'Click the "Stitch" button. It takes a few seconds depending on image count.',
      step4Title: '4. Save',
      step4Desc: 'Review the result and save as JPG/PNG or copy to clipboard.',
      guideTitle: 'Capture guide',
      guideReq: 'Requirements',
      guideReq1: 'Adjacent images must <strong>overlap by at least 2-3 lines</strong>.',
      guideReq2: 'Images must be from the same scrolled screen.',
      guideReq3: 'All images must have the <strong>same resolution</strong>.',
      guideReq4: 'Minimum <strong>2 images</strong>, up to 8 recommended.',
      guideGood: 'Works well with',
      guideGood1: 'Screens with visible scrollbar (game details, settings) — enables auto-sort',
      guideGood2: 'Screens with fixed header/bottom bar (messenger, game UI)',
      guideGood3: 'Full screen captures (Alt+PrintScreen, phone screenshots)',
      guideBad: 'May not work with',
      guideBad1: 'Manually cropped or edited images',
      guideBad2: 'No overlap or less than 1 line of overlap',
      guideBad3: 'Screenshots from different pages/screens mixed together',
      guideBad4: 'Screen content changed between captures (live feeds, etc.)',
      footer: 'image-stitching | Client-side processing (no server upload)',
      errNoImage: 'No images uploaded.',
      errMinTwo: 'At least 2 images are required.',
      errCvNotReady: 'Library not loaded yet. Please try again shortly.',
      errNoOverlap: 'No overlapping areas found between images.\n\nPlease check:\n· Adjacent images must overlap by at least 2-3 lines\n· Images must be from the same scrolled screen\n· Manually cropped/edited images are not supported',
      errLowOverlap: 'Insufficient overlap between images (only {0}/{1} pairs matched).\n\nPlease scroll with 2-3 lines of overlap between captures.',
      errLowQuality: 'Match quality is too low for a natural stitch.\n\nPlease check:\n· Images are from the same scrolled screen\n· Screen content did not change between captures\n· Images are not compressed or edited',
      errClipboardEmpty: 'No image found in clipboard.',
      errClipboardFail: 'Cannot read image from clipboard. Your browser may not support this.',
      errCopyFail: 'Cannot copy to clipboard. Your browser may not support this.',
      msgCopied: 'Copied to clipboard.'
    }
  },

  t(key, ...args) {
    let text = this.texts[this.current][key] || this.texts['ko'][key] || key;
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, arg);
    });
    return text;
  },

  apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (text) el.innerHTML = text;
    });
    document.title = this.t('title');
  },

  toggle() {
    this.current = this.current === 'ko' ? 'en' : 'ko';
    localStorage.setItem('lang', this.current);
    this.apply();
    const btn = document.getElementById('btnLang');
    btn.textContent = this.current === 'ko' ? 'EN' : 'KO';
    btn.title = this.current === 'ko' ? 'English' : '한국어';
  },

  init() {
    const saved = localStorage.getItem('lang');
    if (saved && this.texts[saved]) {
      this.current = saved;
    } else {
      const browserLang = navigator.language || navigator.userLanguage || 'ko';
      this.current = browserLang.startsWith('ko') ? 'ko' : 'en';
    }
    this.apply();
    const btn = document.getElementById('btnLang');
    btn.textContent = this.current === 'ko' ? 'EN' : 'KO';
    btn.title = this.current === 'ko' ? 'English' : '한국어';
  }
};

// 다크모드
const DarkMode = {
  init() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark');
    }
  },

  toggle() {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
  }
};

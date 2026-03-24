# Conceptualization Document
**프로젝트명:** 스크롤 캡처 자동 병합 웹 서비스 (Auto Image Stitcher)

## 1) Business Purpose

### 1.1 Project Background
긴 웹페이지, 메신저 대화, 문서 화면을 캡처할 때 사용자는 여러 장의 이미지를 촬영해야 하며, 이를 수동으로 이어 붙이는 과정은 비효율적입니다. 본 서비스는 여러 장의 캡처 이미지를 업로드하면 겹침 영역을 자동 인식해 하나의 긴 이미지로 병합함으로써 시간과 작업 부담을 줄입니다.

### 1.2 Goal
- 다중 캡처 이미지의 중복 영역 자동 탐지 및 정합(Stitching)
- 병합 결과를 고화질 `PNG/JPG`로 다운로드
- 민감 정보 보호를 위해 서버 업로드 없이 브라우저 내(Client-side) 처리

### 1.3 Target Market
- 긴 캡처 이미지를 자주 공유하는 일반 사용자
- 보고서/증빙용으로 다중 캡처를 취합하는 직장인/학생
- 보안 이슈로 로컬 처리 방식을 선호하는 사용자

## 2) Actors and User Actions

- **User**
  1. 병합할 이미지 여러 장 업로드
  2. 순서 드래그 앤 드롭 정렬, 불필요 이미지 삭제
  3. 자동 병합 실행 및 결과 미리보기 확인
  4. 결과를 `PNG/JPG` 저장 또는 클립보드 복사

## 3) Concept of Operation

### 3.1 Input and Auto Reorder (이미지 입력 및 자동 정렬)
- **Purpose:** 업로드 순서에 의존하지 않고 자동으로 올바른 순서 재구성
- **Approach:** 이미지 간 상/하단 겹침 유사도를 계산해 시퀀스 추정
- **Expected Value:** 파일명/업로드 순서가 뒤섞여도 자동 정렬 지원

### 3.2 Stitching with Fixed UI Removal (고정 UI 제거 + 병합)
- **Purpose:** 상태바/하단바/고정 버튼 등 반복 UI 제거
- **Approach:**
  - 연속 이미지의 상/하단에서 변화가 적은 고정 영역 탐지
  - 본문(스크롤로 변화하는 영역) 중심 특징 매칭 후 합성
- **Expected Value:** 중간에 헤더/푸터가 반복되지 않는 자연스러운 결과

### 3.3 Export and View (결과 출력 및 내보내기)
- **Purpose:** 즉시 활용 가능한 결과 제공
- **Approach:**
  - 브라우저 내 미리보기(축소/확대 토글)
  - `클립보드 복사`, `PNG 저장`, `JPG 저장` 제공
- **Expected Value:** 공유/보관까지 원클릭에 가까운 UX

## 4) Problem Statements and Mitigations

### 4.1 과도한 중복 또는 부족한 겹침 영역
- **Risk:** 정합 실패, 잘못된 연결
- **Mitigation:**
  - 매칭 실패 시 폴백 모드(단순 연결 또는 수동 정렬 유도)
  - 사용자 피드백: "이미지 간 겹치는 영역이 부족합니다."

### 4.2 기기/해상도 파편화
- **Risk:** 고정 UI 높이, 해상도 차이로 잘못된 크롭
- **Mitigation:**
  - 절대 좌표 대신 상대 비율 + 동적 유사도 기반 탐지
  - 템플릿 매칭/다중 스케일 비교로 적응형 처리

### 4.3 클라이언트 성능 한계
- **Risk:** 브라우저 멈춤, 메모리 급증
- **Mitigation:**
  - Web Worker로 병합 연산 분리
  - 진행률 표시, 대용량 입력 시 단계적 처리(Chunking/Downsample 옵션)

## 5) Functional Requirements (MVP)

- 다중 이미지 업로드 (드래그 앤 드롭, 파일 선택)
- 이미지 순서 변경/삭제
- 자동 정렬(옵션: ON/OFF)
- 고정 UI 제거 후 자동 병합
- 병합 결과 미리보기
- 결과 내보내기: `PNG`, `JPG`, 클립보드 복사
- 실패 시 오류 메시지/가이드 제공

## 6) Non-Functional Requirements

- **Privacy:** 이미지 데이터 외부 전송 금지(기본 로컬 처리)
- **Performance:** UI 프리즈 없이 진행률 표시
- **Reliability:** 다양한 해상도/비율에서 일관된 결과
- **Usability:** 초보자도 3클릭 내 결과 획득
- **Compatibility:** 최신 Chrome/Edge 우선 지원

## 7) Suggested Technical Direction (초기 제안)

- **Frontend:** React + TypeScript
- **Image Processing:** OpenCV.js (template matching + similarity scoring)
- **Background Processing:** Web Worker
- **Rendering/Export:** Canvas API (`toBlob`, `toDataURL`)
- **Clipboard:** Clipboard API (`navigator.clipboard` + fallback)

## 8) Success Metrics (KPI)

- 자동 병합 성공률 (정상 결과 비율)
- 평균 처리 시간 (이미지 N장 기준)
- 사용자 재시도율 (실패/불만족 간접 지표)
- 내보내기 완료율 (`PNG/JPG/Clipboard`)
- 이탈률 (업로드 후 병합 전 종료 비율)

## 9) Glossary

- **Image Stitching:** 겹침 영역을 기준으로 여러 이미지를 하나로 연결하는 기술
- **Fixed UI:** 스크롤해도 고정되는 상태바/헤더/푸터 요소
- **Template Matching:** 특정 이미지 패턴의 위치를 유사도로 찾는 기법
- **Web Worker:** 메인 스레드와 분리된 백그라운드 연산 환경

## 10) References

- [レシート因子メーカー](https://lt900ed.github.io/receipt_factor/)
- [OpenCV.js Template Matching](https://docs.opencv.org/3.4/d8/dd1/tutorial_js_template_matching.html)
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)

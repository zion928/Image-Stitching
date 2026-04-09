# 스크롤 캡처 자동 병합 웹 서비스 (image-stitching)

## - 2. Analysis -

---

### Revision history

| Revision date | Version # | Description | Author |
|:---|:---|:---|:---|
| 2026/03/24 | 1.0.0 | 초안 작성 | |
| 2026/04/02 | 1.0.1 | 내용 보완 | |
| 2026/04/09 | 1.1.0 | 예제 형식에 맞춰 전면 개정 | |

---

### Contents

1. Introduction
2. Use case analysis
3. Domain analysis
4. User Interface prototype
5. Glossary
6. References

---

## 1. Introduction

### 1.1 Summary

스마트폰이나 PC를 사용하다 보면 긴 웹페이지, 메신저 대화, 문서 등을 캡처해야 할 때가 많다. 하지만 화면에 한 번에 담기지 않아 여러 장으로 나누어 캡처한 뒤, 이를 다시 하나의 이미지로 자연스럽게 이어 붙이는 작업은 매우 번거롭고 시간이 오래 걸린다.

이러한 불편함을 해소하기 위해, 사용자가 순서대로(혹은 순서와 무관하게) 여러 장의 캡처 이미지를 업로드하면 시스템이 겹치는 영역을 자동으로 인식하여 한 장의 깔끔한 긴 이미지로 병합해 주는 웹 서비스를 기획했다.

본 문서에서는 lt900ed/receipt_factor 프로젝트의 이미지 스티칭 알고리즘을 분석하여 범용화된 image-stitching 서비스의 설계에 필요한 Use Case, Domain, UI Prototype을 기술한다.

### 1.2 Business Goals

- 여러 장의 캡처 이미지 간의 중복 영역을 자동으로 탐지하고 병합(Stitching)하는 웹 서비스를 개발해야 한다.
- 병합된 이미지를 고화질의 JPG 또는 PNG 포맷으로 다운로드하는 기능을 제공해야 한다.
- 개인정보 유출 우려를 줄이기 위해 서버 전송 없이 브라우저(Client-side) 내에서 병합 처리를 지원해야 한다.
- 사용자가 직관적으로 이미지를 업로드, 정렬, 병합, 저장할 수 있어야 한다.

### 1.3 Technical Goals

- 이미지 간의 겹침 영역을 정확하게 탐지할 수 있어야 한다.
- 고정 UI(상태바, 네비게이션 바 등)를 자동으로 인식하고 제거할 수 있어야 한다.
- 이미지 병합 처리를 Web Worker로 분리하여 UI가 멈추지 않아야 한다.
- 다양한 해상도와 기기에서 촬영된 캡처 이미지에 유연하게 대응해야 한다.
- 사용자 친화적인 한글 UX/UI를 제공해야 한다.

---

## 2. Use case analysis

### 2.1 Use Case Diagram

제안된 시스템은 개인 사용자를 대상으로 하기 때문에 Actor는 User 한 명이다. 서버가 존재하지 않으므로 Secondary Actor도 없다. 모든 처리는 브라우저 내에서 수행된다.

아래는 각 Use Case의 ID, Name, Actor를 나타낸 표이다. Use Case Description에서는 위에서부터 차례대로 각 Use Case에 대해 표로 Description을 보여줄 것이다.

| Use Case Name | Use Case ID | Korean Name | Actor |
|:---|:---|:---|:---|
| Upload Images | #1 | 이미지 업로드 | User |
| Paste from Clipboard | #2 | 클립보드에서 붙여넣기 | User |
| Reorder Images | #3 | 이미지 순서 변경 | User |
| Remove Image | #4 | 이미지 삭제 | User |
| Run Stitching | #5 | 자동 병합 실행 | User |
| Preview Result | #6 | 결과 미리보기 | User |
| Download Result | #7 | 결과 다운로드 | User |
| Copy to Clipboard | #8 | 클립보드로 복사 | User |
| Reset | #9 | 초기화 | User |

```
                        +---------------------------+
                        |     image-stitching        |
                        |                           |
                        |  +---------------------+  |
                        |  |  Upload Images (#1)  |  |
                        |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Paste from          |  |
         +------+       |  |  Clipboard (#2)      |  |
         |      |       |  +---------------------+  |
         | User |-------+  +---------------------+  |
         |      |       |  |  Reorder Images (#3) |  |
         +------+       |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Remove Image (#4)   |  |
                        |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Run Stitching (#5)  |  |
                        |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Preview Result (#6) |  |
                        |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Download Result (#7)|  |
                        |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Copy to             |  |
                        |  |  Clipboard (#8)      |  |
                        |  +---------------------+  |
                        |  +---------------------+  |
                        |  |  Reset (#9)          |  |
                        |  +---------------------+  |
                        +---------------------------+
```

---

### 2.2 Use Case Description

#### 2.2.1 Upload Images

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #1 |
| Summary | 사용자는 병합할 여러 장의 캡처 이미지를 드래그 앤 드롭 또는 파일 선택을 통해 시스템에 업로드한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None (클라이언트 전용) |
| Preconditions | 웹 페이지가 정상적으로 로드되어 있어야 한다. |
| Trigger | 사용자가 파일을 드래그 앤 드롭하거나 파일 선택 버튼을 클릭한다. |
| Success Post Condition | 업로드된 이미지가 미리보기 영역에 표시되고, "병합" 버튼과 "리셋" 버튼이 활성화된다. |
| Failed Post Condition | 에러 메시지를 표시하고 업로드를 재시도하게 한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 이미지 파일을 드래그 앤 드롭 영역에 놓거나 파일 선택 버튼을 클릭한다. |
| 2 | 시스템은 이미지 파일을 FileReader API로 읽어 Data URL로 변환한다. |
| 3 | 시스템은 각 이미지의 썸네일을 미리보기 영역에 표시한다. |
| 4 | 시스템은 "병합" 버튼과 "리셋" 버튼을 활성화한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 1 | 1a. 사용자가 이미지가 아닌 파일을 업로드한 경우 |
| | 1a.1. 시스템은 해당 파일을 무시하고 이미지 파일만 처리한다 (input의 accept="image/*" 속성에 의해 필터링). |
| 2 | 2a. 이미지 파일을 읽을 수 없는 경우 |
| | 2a.1. FileReader의 onerror 이벤트가 발생하며 해당 파일은 건너뛴다. |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 2 Seconds |
| Frequency | 병합 작업 시작 시 최소 1회 |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | 최소 2장, 최대 8장 권장 |

---

#### 2.2.2 Paste from Clipboard

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #2 |
| Summary | 사용자는 클립보드에 복사된 이미지를 Ctrl+V 또는 버튼을 통해 시스템에 추가한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 웹 페이지가 정상적으로 로드되어 있어야 한다. |
| Trigger | 사용자가 Ctrl+V를 누르거나 "클립보드에서 붙여넣기" 버튼을 클릭한다. |
| Success Post Condition | 클립보드의 이미지가 미리보기 영역에 추가되고, 버튼이 활성화된다. |
| Failed Post Condition | 에러 메시지를 표시한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 Ctrl+V를 누르거나 "클립보드에서 붙여넣기" 버튼을 클릭한다. |
| 2 | 시스템은 Clipboard API (navigator.clipboard.read())를 통해 클립보드의 이미지를 읽는다. |
| 3 | 시스템은 읽어들인 이미지를 FileReader로 Data URL 변환 후 미리보기 영역에 추가한다. |
| 4 | 시스템은 "병합" 버튼과 "리셋" 버튼을 활성화한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 2 | 2a. 클립보드에 이미지가 없는 경우 |
| | 2a.1. 시스템은 "클립보드에 이미지가 없습니다" 에러 메시지를 표시한다. |
| 2 | 2b. 브라우저가 Clipboard API를 지원하지 않는 경우 |
| | 2b.1. 시스템은 "클립보드에서 이미지를 읽을 수 없습니다" 에러 메시지를 표시한다. |
| 1 | 1a. Ctrl+V 이벤트에서 clipboardData.files가 존재하는 경우 |
| | 1a.1. Clipboard API 대신 직접 files를 읽어 photoPreview()로 처리한다 (구형 브라우저 호환). |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 2 Seconds |
| Frequency | Variable |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | image/png 타입만 지원 |

---

#### 2.2.3 Reorder Images

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #3 |
| Summary | 사용자는 미리보기 영역에서 이미지의 순서를 드래그 앤 드롭으로 변경한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 미리보기 영역에 2장 이상의 이미지가 업로드되어 있어야 한다. |
| Trigger | 사용자가 미리보기 영역의 이미지를 드래그하여 다른 위치에 놓는다. |
| Success Post Condition | 이미지의 순서가 변경된다. |
| Failed Post Condition | 이미지 순서가 변경되지 않고 원래 순서를 유지한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 미리보기 영역의 이미지 썸네일을 드래그한다 (dragstart 이벤트). |
| 2 | 시스템은 드래그 중인 이미지에 dragging 클래스를 적용하여 시각적으로 표시한다. |
| 3 | 사용자가 원하는 위치의 이미지 위에서 드롭한다 (drop 이벤트). |
| 4 | 시스템은 DOM 노드의 위치를 교환하여 이미지 순서를 갱신한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 3 | 3a. 사용자가 미리보기 영역 밖에 이미지를 놓은 경우 |
| | 3a.1. dragend 이벤트가 발생하고 dragging 클래스가 제거되며 원래 순서를 유지한다. |
| 3 | 3b. 같은 위치에 드롭한 경우 |
| | 3b.1. dragSourceItem === this 조건에 의해 아무 변경도 하지 않는다. |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 1 Seconds |
| Frequency | Variable |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | 자동 순서 정렬 기능이 있으므로 수동 정렬은 선택적 |

---

#### 2.2.4 Remove Image

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #4 |
| Summary | 사용자는 미리보기 영역에서 불필요한 이미지를 삭제한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 미리보기 영역에 1장 이상의 이미지가 업로드되어 있어야 한다. |
| Trigger | 사용자가 이미지 썸네일의 삭제(X) 버튼을 클릭한다. |
| Success Post Condition | 해당 이미지가 미리보기 영역에서 제거된다. |
| Failed Post Condition | 이미지가 제거되지 않는다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 미리보기 영역의 이미지 썸네일 좌측 상단의 삭제(X) 버튼을 클릭한다. |
| 2 | 시스템은 closest('.containerItem')로 해당 DOM 요소를 찾아 제거한다. |
| 3 | 시스템은 남은 이미지 수를 확인한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 3 | 3a. 미리보기 영역에 이미지가 0장이 된 경우 |
| | 3a.1. 시스템은 "병합" 버튼과 "리셋" 버튼을 비활성화한다 (manageBtnStatus('addImgNotReady')). |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 1 Seconds |
| Frequency | Variable |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | None |

---

#### 2.2.5 Run Stitching

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #5 |
| Summary | 사용자가 "병합" 버튼을 클릭하면 시스템이 업로드된 이미지들을 자동으로 분석하여 고정 UI를 제거하고, 겹침 영역을 탐지하여 하나의 이미지로 병합한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 미리보기 영역에 2장 이상의 이미지가 업로드되어 있어야 하며, OpenCV.js 라이브러리 로드가 완료되어 있어야 한다. |
| Trigger | 사용자가 "병합" 버튼을 클릭한다. |
| Success Post Condition | 병합된 결과 이미지가 결과 영역에 표시되고 저장 버튼들이 활성화된다. |
| Failed Post Condition | 에러 메시지를 표시하고 실패 원인을 사용자에게 안내한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 "병합" 버튼을 클릭한다. |
| 2 | 시스템은 로딩 오버레이와 진행률(%)을 표시한다. |
| 3 | 시스템은 각 이미지를 OpenCV.js cv.Mat 객체로 변환하고 RGBA→RGB 변환을 수행한다. |
| 4 | 시스템은 이미지의 해상도를 통일한다 (장변 2175px 제한, 최소 너비 기준 리사이즈). |
| 5 | 시스템은 이미지 쌍별 픽셀 차분(cv.absdiff)의 행별 최대값을 계산하여 고정 영역(상태바, 네비바)과 스크롤 영역을 분리한다. |
| 6 | 시스템은 각 이미지에서 header, scroll, footer 영역을 추출한다. |
| 7 | 시스템은 스크롤바 위치를 감지하여 이미지의 순서를 결정한다. 스크롤바 감지에 실패하면 그리디 체인 빌딩(O(N²))으로 폴백한다. |
| 8 | 시스템은 인접 이미지 쌍에 대해 Coarse-to-Fine 픽셀 슬라이딩으로 겹침 위치를 탐색한다. |
| 9 | 시스템은 매칭 결과로부터 각 이미지의 상대적 y 오프셋을 누적 계산한다. |
| 10 | 시스템은 품질 검증(유효 쌍 비율, 평균 diff)을 수행한다. |
| 11 | 시스템은 하단 이미지부터 상단 이미지 순서로 Canvas에 렌더링하고, 겹침 경계에 알파 블렌딩을 적용한다. |
| 12 | 시스템은 결과 이미지를 결과 영역에 표시하고 저장 버튼을 활성화한다. |
| 13 | 시스템은 로딩 오버레이를 해제하고 결과 영역으로 스크롤한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 1 | 1a. 이미지가 2장 미만인 경우 |
| | 1a.1. 시스템은 "2장 이상의 이미지가 필요합니다" 에러 메시지를 표시한다. |
| 1 | 1b. OpenCV.js 로드가 완료되지 않은 경우 |
| | 1b.1. 시스템은 "라이브러리 로드가 완료되지 않았습니다" 에러 메시지를 표시한다. |
| 4 | 4a. 이미지의 해상도가 서로 다른 경우 |
| | 4a.1. 시스템은 최소 너비 기준으로 리사이즈하여 통일한다. |
| 5 | 5a. 스크롤 영역이 전체의 30% 미만인 경우 |
| | 5a.1. 시스템은 하단/상단에서 역방향으로 고정 영역을 재감지한다. |
| | 5a.2. 재감지에도 스크롤 영역이 10% 미만이면 전체를 스크롤 영역으로 처리한다. |
| 8 | 8a. 이미지 간 겹침 영역이 부족하여 매칭에 실패한 경우 (meanDiff > 임계값) |
| | 8a.1. 해당 쌍은 단순 상하 연결로 폴백 처리한다. |
| 10 | 10a. 유효 쌍이 0개인 경우 |
| | 10a.1. 시스템은 "이미지 간 겹치는 영역을 찾을 수 없습니다" 에러 메시지와 촬영 가이드를 표시한다. |
| 10 | 10b. 유효 비율이 50% 미만인 경우 |
| | 10b.1. 시스템은 "이미지 간 겹치는 영역이 부족합니다" 에러 메시지를 표시한다. |
| 10 | 10c. 평균 diff가 8을 초과하는 경우 |
| | 10c.1. 시스템은 "매칭 품질이 낮아 자연스러운 병합이 어렵습니다" 에러 메시지를 표시한다. |

| | RELATED INFORMATION |
|:---|:---|
| Performance | 이미지 수와 해상도에 따라 즉시 ~ 수십 초 소요 |
| Frequency | 이미지 업로드 후 최소 1회 |
| Concurrency | None (메인 스레드에서 단일 처리) |
| Due Date | 2026-04-30 |
| Etc | 처리 완료 시 cv.Mat 메모리를 finally 블록에서 해제 |

---

#### 2.2.6 Preview Result

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #6 |
| Summary | 사용자는 병합된 결과 이미지를 미리보기하고, 이미지를 클릭하여 등배/화면 맞춤 표시를 전환한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 병합(Use Case #5)이 성공적으로 완료되어 결과 이미지가 표시되어 있어야 한다. |
| Trigger | 사용자가 결과 이미지를 클릭한다. |
| Success Post Condition | 결과 이미지의 표시 크기가 전환된다 (등배 ↔ 화면 맞춤). |
| Failed Post Condition | 표시 크기가 변경되지 않는다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 결과 이미지를 클릭한다. |
| 2 | 시스템은 full-width-image CSS 클래스를 토글하여 등배 표시와 화면 너비 맞춤 표시를 전환한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| (없음) | |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 1 Seconds |
| Frequency | Variable |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | None |

---

#### 2.2.7 Download Result

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #7 |
| Summary | 사용자는 병합된 결과 이미지를 JPG 또는 PNG 파일로 로컬 기기에 저장한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 병합(Use Case #5)이 성공적으로 완료되어 결과 Canvas가 존재해야 한다. |
| Trigger | 사용자가 "JPG로 저장" 또는 "PNG로 저장" 버튼을 클릭한다. |
| Success Post Condition | 결과 이미지가 선택한 포맷으로 로컬에 다운로드된다. |
| Failed Post Condition | 다운로드에 실패한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 "JPG로 저장" 또는 "PNG로 저장" 버튼을 클릭한다. |
| 2 | 시스템은 Canvas에서 해당 포맷의 Data URL을 생성한다 (JPG: quality 0.95). |
| 3 | 시스템은 앵커 태그(<a>)를 동적 생성하고 download 속성에 타임스탬프 파일명을 설정한다. |
| 4 | 시스템은 앵커 태그의 click()을 호출하여 브라우저가 파일 다운로드를 수행한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 1 | 1a. Canvas 요소가 존재하지 않는 경우 (병합 미실행) |
| | 1a.1. 함수가 즉시 반환되며 아무 동작도 하지 않는다. |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 3 Seconds |
| Frequency | 병합 성공 후 최소 1회 |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | 파일명 형식: stitched_YYYYMMDDHHmmss.jpg/png |

---

#### 2.2.8 Copy to Clipboard

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #8 |
| Summary | 사용자는 병합된 결과 이미지를 클립보드로 복사하여 다른 앱에 즉시 붙여넣을 수 있게 한다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 병합(Use Case #5)이 성공적으로 완료되어 결과 Canvas가 존재해야 한다. |
| Trigger | 사용자가 "클립보드에 복사" 버튼을 클릭한다. |
| Success Post Condition | 결과 이미지가 클립보드에 복사되고 성공 메시지가 표시된다. |
| Failed Post Condition | 에러 메시지를 표시한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 "클립보드에 복사" 버튼을 클릭한다. |
| 2 | 시스템은 Canvas.toBlob()으로 PNG Blob 객체를 생성한다. |
| 3 | 시스템은 ClipboardItem을 생성하고 navigator.clipboard.write()로 클립보드에 기록한다. |
| 4 | 시스템은 "클립보드에 복사되었습니다" 성공 메시지를 표시한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 3 | 3a. 브라우저가 Clipboard API (navigator.clipboard.write)를 지원하지 않는 경우 |
| | 3a.1. 시스템은 "클립보드에 복사할 수 없습니다. 브라우저가 지원하지 않을 수 있습니다." 에러 메시지를 표시한다. |
| 1 | 1a. Canvas가 존재하지 않는 경우 |
| | 1a.1. 함수가 즉시 반환되며 아무 동작도 하지 않는다. |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 2 Seconds |
| Frequency | Variable |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | HTTPS 환경에서만 Clipboard API 사용 가능 |

---

#### 2.2.9 Reset

| | GENERAL CHARACTERISTICS |
|:---|:---|
| Use Case ID | #9 |
| Summary | 사용자가 "리셋" 버튼을 클릭하면 시스템이 모든 업로드 이미지와 결과를 초기 상태로 되돌린다. |
| Scope | image-stitching |
| Level | User Level |
| Author | |
| Last Update | 2026-04-09 |
| Status | Analysis |
| Primary Actor | User |
| Secondary Actors | None |
| Preconditions | 1장 이상의 이미지가 업로드되어 있거나 결과 이미지가 존재해야 한다. |
| Trigger | 사용자가 "리셋" 버튼을 클릭한다. |
| Success Post Condition | 미리보기 영역, 결과 영역이 초기 상태로 돌아간다. |
| Failed Post Condition | 초기화에 실패한다. |

**MAIN SUCCESS SCENARIO**

| Step | Action |
|:---|:---|
| 1 | 사용자가 "리셋" 버튼을 클릭한다. |
| 2 | 시스템은 미리보기 영역(.container)의 모든 자식 DOM 요소를 제거한다. |
| 3 | 시스템은 결과 영역의 Canvas 요소를 제거하고 결과 이미지의 src를 초기화한다. |
| 4 | 시스템은 저장 버튼을 숨기고 "병합" 버튼을 비활성화한다. |
| 5 | 시스템은 초기 안내 문구("여기에 결과가 표시됩니다")를 표시한다. |

**EXTENSION SCENARIOS**

| Step | Branching Action |
|:---|:---|
| 1 | 1a. "리셋" 버튼이 비활성화(disable) 상태인 경우 |
| | 1a.1. 버튼 클릭이 무시되어 아무 동작도 하지 않는다. |

| | RELATED INFORMATION |
|:---|:---|
| Performance | ≦ 1 Seconds |
| Frequency | Variable |
| Concurrency | None |
| Due Date | 2026-04-30 |
| Etc | None |

---

## 3. Domain analysis

아래의 그림은 Domain Analysis에서 나오는 모듈(클래스)들의 관계를 나타낸 것이다. 본 시스템은 서버 없이 브라우저 내에서 동작하므로, 모든 모듈은 클라이언트 사이드 JavaScript로 구현된다.

### 3.1 Domain Diagram

```
+------------------+       +------------------+       +------------------+
|    app.js        |       |  preprocessor.js |       |   matcher.js     |
|  (Controller)    |------>|  (Preprocessor)  |------>|   (Matcher)      |
+------------------+       +------------------+       +------------------+
        |                                                     |
        |                                                     |
        v                                                     v
+------------------+       +------------------+       +------------------+
|   index.html     |       |  OpenCV.js       |       |   renderer.js    |
|   (View/UI)      |       |  (External Lib)  |       |   (Renderer)     |
+------------------+       +------------------+       +------------------+
```

### 3.2 Domain Description

#### 1) app.js (Controller)

사용자 인터페이스에서 발생하는 모든 이벤트(파일 업로드, 드래그 앤 드롭, 버튼 클릭, 클립보드 붙여넣기 등)를 처리하는 중앙 제어 모듈이다. 이미지 미리보기 관리, 버튼 상태 관리, 로딩 화면 제어, 에러/성공 메시지 표시를 담당한다. 병합 실행 시 Preprocessor → Matcher → Renderer를 순차적으로 호출하는 파이프라인 오케스트레이션을 수행하며, 완료 후 cv.Mat 메모리를 해제한다.

#### 2) preprocessor.js (Preprocessor)

입력 이미지들의 전처리를 담당하는 모듈이다. 세 가지 핵심 기능을 제공한다:
- **normalizeResolution**: 장변 2175px 제한 및 최소 너비 기준 리사이즈로 해상도 통일
- **detectFixedAreas**: 이미지 쌍별 그레이스케일 변환 후 cv.absdiff로 행별 최대 차분을 계산하고, 이동 평균 평활화 → 클러스터 기반 탐색으로 고정 영역(상태바, 네비바)과 스크롤 영역의 경계를 판별
- **extractScrollRegions**: 감지된 경계 좌표에 따라 각 이미지를 header, scroll, footer, bottom_row 등으로 분리

#### 3) matcher.js (Matcher)

이미지의 올바른 순서를 결정하고 인접 쌍의 겹침 위치를 탐색하는 모듈이다. 두 가지 전략을 사용한다:
- **스크롤바 기반 순서 결정**: 이미지 우측 끝 영역에서 스크롤바 thumb의 y 좌표를 감지하고, y 오름차순으로 정렬하여 O(N) 순서 결정. 스크롤바 높이 불일치, 미감지 등의 검증을 수행
- **그리디 체인 빌딩 (폴백)**: 스크롤바 감지 실패 시 모든 (i→j) 쌍을 매칭하고, diff가 작은 쌍부터 사이클 없이 체인에 연결하는 O(N²) 알고리즘

겹침 매칭은 Coarse-to-Fine 2단계 픽셀 슬라이딩 방식으로, 4px 간격 거친 탐색 후 ±8px 정밀 탐색을 수행한다. 평균 diff와 bad pixel 비율로 매칭 품질을 판정한다.

#### 4) renderer.js (Renderer)

결정된 순서와 좌표에 따라 Canvas에 이미지를 렌더링하는 모듈이다. 하단 이미지를 먼저 그리고 상단 이미지가 덮어쓰는 방식으로 겹침부를 처리한다. 겹침 경계에 알파 그라디언트 블렌딩을 적용하여 이음새를 자연스럽게 만든다. 스크롤바 감지 시 우측 스크롤바 열을 크롭하여 렌더링한다. 결과 Canvas에서 JPG/PNG 다운로드(Data URL → 앵커 태그), Blob 기반 클립보드 복사, 등배/축소 전환 기능을 제공한다.

#### 5) index.html (View/UI)

사용자 인터페이스를 정의하는 HTML 문서이다. 로딩 오버레이, 토스트 메시지, 업로드 섹션(드래그 앤 드롭 영역, 미리보기, 옵션, 버튼), 결과 섹션(저장 버튼, 결과 이미지), 사용 방법/촬영 가이드를 포함한다.

#### 6) OpenCV.js (External Library)

이미지 처리를 위한 외부 라이브러리이다. cv.imread (이미지 로드), cv.cvtColor (색공간 변환), cv.absdiff (차분), cv.resize (리사이즈), cv.imshow (Canvas 출력) 등의 함수를 제공한다. CDN에서 비동기로 로드되며, 로드 완료 시 onOpenCvReady 콜백이 호출되어 "병합" 버튼이 활성화된다.

---

## 4. User Interface Prototype

### 4.1 초기 화면 (이미지 업로드 전)

웹 페이지에 접속하면 가장 먼저 나타나는 화면이다. 상단에 서비스명이 표시되고, 중앙에 드래그 앤 드롭 영역이 위치한다. "병합" 버튼과 "리셋" 버튼은 이미지가 업로드되지 않은 상태이므로 비활성화되어 있다. 하단에는 사용 방법과 촬영 가이드가 안내된다.

```
+---------------------------------------------+
|  스크롤 캡처 자동 병합                       |
+---------------------------------------------+
|                                             |
|  +-------------------------------------+   |
|  |                                     |   |
|  |     여기에 파일을 드래그 앤 드롭     |   |
|  |                                     |   |
|  |     또는  [파일 선택]               |   |
|  |     [클립보드에서 붙여넣기]          |   |
|  |                                     |   |
|  |  자동으로 순서를 정렬하므로          |   |
|  |  순서는 신경쓰지 않아도 됩니다       |   |
|  |                                     |   |
|  +-------------------------------------+   |
|                                             |
|  [v] 헤더 표시                              |
|                                             |
|  [병합(비활성)]  [리셋(비활성)]              |
|                                             |
|  -------------------------------------------+
|  여기에 결과가 표시됩니다                    |
|                                             |
|  -------------------------------------------+
|  사용 방법 / 촬영 가이드                     |
+---------------------------------------------+
|  image-stitching | 클라이언트 사이드 처리    |
+---------------------------------------------+
```

### 4.2 이미지 업로드 후 (병합 실행 전)

이미지를 업로드하면 드래그 앤 드롭 영역 아래에 썸네일 미리보기가 나타난다. 각 썸네일 좌측 상단에 삭제(X) 버튼이 있으며, 드래그 앤 드롭으로 순서를 변경할 수 있다. "병합" 버튼과 "리셋" 버튼이 활성화된다.

```
+---------------------------------------------+
|  스크롤 캡처 자동 병합                       |
+---------------------------------------------+
|  +-------------------------------------+   |
|  |     여기에 파일을 드래그 앤 드롭     |   |
|  +-------------------------------------+   |
|                                             |
|  미리보기:                                   |
|  +-----+ +-----+ +-----+ +-----+           |
|  |[X]  | |[X]  | |[X]  | |[X]  |           |
|  |img1 | |img2 | |img3 | |img4 |           |
|  |     | |     | |     | |     |           |
|  +-----+ +-----+ +-----+ +-----+           |
|    <-- 드래그 앤 드롭으로 순서 변경 -->       |
|                                             |
|  [v] 헤더 표시                              |
|                                             |
|  [병합(활성)]  [리셋(활성)]                  |
|                                             |
|  -------------------------------------------+
|  여기에 결과가 표시됩니다                    |
+---------------------------------------------+
```

### 4.3 병합 처리 중 (로딩)

병합 버튼을 클릭하면 화면 전체를 덮는 로딩 오버레이가 표시된다. 12개의 점으로 구성된 스피너 애니메이션과 진행률(%)이 실시간으로 갱신된다.

```
+---------------------------------------------+
|                                             |
|                                             |
|              * * *                          |
|             *     *                         |
|              * * *                          |
|                                             |
|                47%                          |
|                                             |
|                                             |
+---------------------------------------------+
```

### 4.4 병합 완료 후

병합이 완료되면 결과 영역으로 자동 스크롤된다. 저장 버튼 3개(JPG, PNG, 클립보드)가 나타나고, 병합된 결과 이미지가 표시된다. 이미지를 클릭하면 등배/화면 맞춤 표시를 전환할 수 있다.

```
+---------------------------------------------+
|  스크롤 캡처 자동 병합                       |
+---------------------------------------------+
|  (업로드 영역 + 미리보기 영역 유지)          |
|                                             |
|  [병합(활성)]  [리셋(활성)]                  |
|                                             |
|  -------------------------------------------+
|                                             |
|  [JPG로 저장] [PNG로 저장] [클립보드에 복사] |
|                                             |
|  이미지를 클릭하면 크기를 전환합니다         |
|                                             |
|  +-------------------------------------+   |
|  |                                     |   |
|  |         (병합된 결과 이미지)         |   |
|  |                                     |   |
|  |                                     |   |
|  |                                     |   |
|  |                                     |   |
|  +-------------------------------------+   |
|                                             |
+---------------------------------------------+
```

### 4.5 에러 발생 시

처리 중 에러가 발생하면 화면 상단에 에러 메시지가 토스트 형태로 일정 시간(메시지 길이 × 100ms, 최소 4초) 표시된 후 자동으로 사라진다. 성공 메시지도 동일한 형태로 표시된다.

```
+---------------------------------------------+
|  +-------------------------------------+   |
|  | ! 이미지 간 겹치는 영역이 부족합니다  |   |
|  +-------------------------------------+   |
|                                             |
|  (이하 일반 화면)                           |
|                                             |
+---------------------------------------------+
```

---

## 5. Glossary

아래의 표는 본 문서에서 사용된 용어에 대한 설명이다.

| Terms | Description |
|:---|:---|
| image-stitching | 본 프로젝트의 이름이다. 스크롤 캡처 자동 병합 웹 서비스를 지칭한다. |
| User | 웹 서비스를 사용하는 사용자이다. 별도의 역할 구분 없이 단일 Actor이다. |
| Image Stitching (이미지 병합) | 여러 장의 사진에서 겹치는 부분을 찾아 하나의 매끄러운 이미지로 연결하는 기술이다. |
| Fixed UI (고정 UI) | 스크롤을 내려도 화면 상단/하단에 고정되어 움직이지 않는 요소(상태바, 네비게이션 바 등)이다. |
| Scroll Area (스크롤 영역) | 스크롤에 따라 내용이 변하는 화면의 본문 영역이다. 고정 UI를 제외한 나머지 부분을 가리킨다. |
| Pixel Difference (픽셀 차분) | 두 이미지의 동일 위치 픽셀 값의 차이를 계산하는 기법이다. OpenCV의 cv.absdiff 함수를 사용한다. |
| Coarse-to-Fine Search | 거친 탐색(큰 간격)으로 후보를 좁힌 후 정밀 탐색(1px 단위)으로 최적 위치를 찾는 2단계 탐색 전략이다. |
| Greedy Chain Building | 매칭 점수가 좋은 쌍부터 사이클 없이 체인에 연결하는 O(N²) 순서 결정 알고리즘이다. |
| Alpha Blending (알파 블렌딩) | 두 이미지의 겹침 경계에서 투명도 그라디언트를 적용하여 이음새를 자연스럽게 만드는 기법이다. |
| Web Worker | 브라우저 메인 스레드와 분리되어 무거운 연산을 처리하는 백그라운드 실행 기술이다. |
| Canvas | HTML5의 그래픽 요소로, 이미지 렌더링 및 결과 출력에 사용된다. |
| Fallback (폴백) | 자동 매칭에 실패했을 때 단순 상하 연결로 대체하는 대안 처리 방식이다. |
| cv.Mat | OpenCV.js에서 이미지를 표현하는 행렬(Matrix) 객체이다. 사용 후 delete()로 메모리를 해제해야 한다. |
| Data URL | Base64로 인코딩된 이미지 데이터를 포함하는 URL 문자열이다. img 태그의 src에 직접 사용할 수 있다. |

---

## 6. References

- OpenCV.js Documentation: https://docs.opencv.org/4.9.0/d5/d10/tutorial_js_root.html
- OpenCV.js Core Operations (absdiff): https://docs.opencv.org/3.4/de/d06/tutorial_js_basic_ops.html
- MDN Web Docs - Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- MDN Web Docs - Web Workers API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- MDN Web Docs - Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN Web Docs - Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- MDN Web Docs - FileReader API: https://developer.mozilla.org/en-US/docs/Web/API/FileReader

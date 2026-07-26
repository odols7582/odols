# 매일 밤 11시 가계부 보고서 (dailyReport)

`dailyReport.js` = 매일 **23:00 KST**에 두 사람 폰으로 보고서 푸시를 보내는 예약 Cloud Function.

보고서 내용:
- 💵 예상 잔액 (정산을 현재 지출로 실시간 재계산 + 홈 위젯도 갱신)
- 🧾 오늘 지출 합계·건수 (최다 카테고리)
- ⚠️ 예산 현황 (초과 카테고리)
- 📥 미수금(N빵) + 카드 실부담

---

## 사전 조건
- Firebase 프로젝트가 **Blaze(종량제) 요금제**여야 함 — 예약 함수(Cloud Scheduler)는 Blaze 필요.
  단, 하루 1회 실행이라 **무료 한도 안에 들어와서 실제 비용은 사실상 0원.**
- 로컬에 Firebase CLI 설치: `npm i -g firebase-tools`, 그리고 `firebase login`.

## 배포 (기존 Functions 프로젝트가 이미 있는 경우 — 알림 함수가 이미 돌고 있으니 아마 이 경우)
1. 기존 `functions/` 폴더에 `dailyReport.js`를 복사해 넣기.
2. 기존 `functions/index.js` 맨 아래에 한 줄 추가:
   ```js
   exports.dailyReport = require("./dailyReport").dailyReport;
   ```
3. 의존성 확인 (functions 폴더에서): `npm install firebase-admin firebase-functions`
4. 배포:
   ```
   firebase deploy --only functions:dailyReport
   ```
5. 첫 배포 시 자동으로 Cloud Scheduler 작업(매일 23:00 KST)이 생성됩니다.

## 배포 (Functions를 처음 세팅하는 경우)
1. 프로젝트 루트(=`firebase.json` 있는 곳)에서:
   ```
   firebase init functions
   ```
   (언어 JavaScript, 프로젝트는 `ggom-922e9` 선택)
2. 생성된 `functions/` 안의 `index.js`를 이 폴더의 `dailyReport.js` 내용으로 바꾸거나,
   `dailyReport.js`를 넣고 `index.js`에 `exports.dailyReport = require("./dailyReport").dailyReport;` 추가.
3. `functions/package.json`의 dependencies에 firebase-admin / firebase-functions 있는지 확인 후 `npm install`.
4. `firebase deploy --only functions:dailyReport`

## 테스트 (즉시 1회 실행)
- Google Cloud Console → Cloud Scheduler → `dailyReport` 작업 → **"지금 실행"** 누르면 즉시 발송 테스트 가능.
- 또는 시간을 잠깐 몇 분 뒤로 바꿔서 확인.

## 커스터마이즈
- 시간 변경: `dailyReport.js`의 `schedule: "0 23 * * *"` (분 시 * * *). 예) 오전 8시 = `"0 8 * * *"`.
- 내용 변경: 함수 안 `lines.push(...)` 부분 수정.

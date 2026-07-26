/**
 * 매일 밤 11시(KST) 가계부 보고서를 두 사람 폰으로 푸시하는 예약 함수.
 *
 * 앱(index.html)의 계산 로직을 그대로 복제:
 *  - 기간(월분): 매월 22일 시작 (22일~다음달 21일). day<22면 전월분.
 *  - 예상 잔액: 정산(settlements) 문서를 현재 records로 실시간 재계산 (computeSettleLive)
 *  - 오늘 지출: 오늘 날짜 expense 합계·건수 (투자성 제외)
 *  - 예산 현황: settings/budgets 대비 이번 월분 지출 (투자성 제외)
 *  - 미수금: split && !splitReceived 의 splitCollect 합
 *  - 카드 예상: 카드별 지출 합 − 수금완료액 = 실부담
 *
 * 배포:  firebase deploy --only functions:dailyReport   (Blaze 요금제 필요)
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const CARD_PAYMENTS = [
  { key: "shinhan", payment: "신한 신용카드(오소리)" },
  { key: "kukmin",  payment: "국민 신용카드(오소리)" },
  { key: "samsung", payment: "삼성 신용카드(오소리)" },
  { key: "baekchai", payment: "백채 신용카드" },
  { key: "phone_b", payment: "휴대폰결제(부엉이)" },
];
const INVEST_CATS = ["주식 매수", "코인 매수", "적금/예금"];

function fmt(n) { return Math.abs(Math.round(n)).toLocaleString("ko-KR"); }

// 앱의 getPeriodKey와 동일 (22일 시작 주기)
function getPeriodKey(d) {
  let y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  if (day < 22) { m -= 1; if (m < 1) { m = 12; y -= 1; } }
  return y + "-" + String(m).padStart(2, "0");
}

exports.dailyReport = onSchedule(
  { schedule: "0 23 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const db = admin.firestore();

    // KST 기준 "지금"
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const period = getPeriodKey(now);
    const todayStr =
      now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");

    // 이번 월분 records
    const recSnap = await db.collection("records").where("period", "==", period).get();
    const records = recSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    // 1) 오늘 지출 (투자성 제외)
    const todayExp = records.filter(
      (r) => r.type === "expense" && r.date === todayStr && INVEST_CATS.indexOf(r.category) < 0
    );
    const todayTotal = todayExp.reduce((a, r) => a + (r.amount || 0), 0);
    const todayCatMap = {};
    todayExp.forEach((r) => { todayCatMap[r.category] = (todayCatMap[r.category] || 0) + (r.amount || 0); });
    let topCat = "", topAmt = 0;
    Object.keys(todayCatMap).forEach((c) => { if (todayCatMap[c] > topAmt) { topAmt = todayCatMap[c]; topCat = c; } });

    // 2) 예상 잔액 — 정산을 현재 records로 실시간 재계산 + 위젯도 함께 갱신
    let remain = null;
    const setSnap = await db.collection("settlements").where("period", "==", period).get();
    const settles = setSnap.docs
      .map((d) => Object.assign({ id: d.id }, d.data()))
      .sort((a, b) => (a.seq || 1) - (b.seq || 1));
    if (settles.length) {
      const s = settles[0];
      let inc = 0, exp = 0;
      if (s.autoOn !== false) {
        CARD_PAYMENTS.forEach((cp) => {
          const ov = s.autoAmts && typeof s.autoAmts[cp.key] === "number" ? s.autoAmts[cp.key] : null;
          if (ov !== null) { exp += ov; return; }
          exp += records
            .filter((r) => r.type === "expense" && r.payment === cp.payment)
            .reduce((a, r) => a + (r.amount || 0), 0);
        });
      }
      (s.rows || []).forEach((r) => { if (r.type === "income") inc += r.amt; else exp += r.amt; });
      remain = inc - exp;
      // 홈 위젯도 최신값으로 갱신
      await db.collection("settlements").doc(s.id).set(
        { income: inc, expense: exp, remain, updatedAt: Date.now() },
        { merge: true }
      );
    }

    // 3) 예산 현황
    let budgets = {};
    const bdoc = await db.collection("settings").doc("budgets").get();
    if (bdoc.exists) budgets = (bdoc.data().data) || {};
    const spentByCat = {};
    records.forEach((r) => {
      if (r.type === "expense" && INVEST_CATS.indexOf(r.category) < 0)
        spentByCat[r.category] = (spentByCat[r.category] || 0) + (r.amount || 0);
    });
    const over = [];
    Object.keys(budgets).forEach((cat) => {
      const sp = spentByCat[cat] || 0;
      if (sp > budgets[cat]) over.push({ cat, diff: sp - budgets[cat] });
    });
    over.sort((a, b) => b.diff - a.diff);

    // 4) 미수금 + 카드 예상(실부담)
    const due = records.filter((r) => r.split && !r.splitReceived);
    const dueTotal = due.reduce((a, r) => a + (r.splitCollect || 0), 0);
    let cardTotal = 0, cardCollected = 0;
    CARD_PAYMENTS.forEach((cp) => {
      cardTotal += records
        .filter((r) => r.type === "expense" && r.payment === cp.payment)
        .reduce((a, r) => a + (r.amount || 0), 0);
      cardCollected += records
        .filter((r) => r.split && r.splitReceived && r.payment === cp.payment)
        .reduce((a, r) => a + (r.splitCollect || 0), 0);
    });
    const cardReal = Math.max(0, cardTotal - cardCollected);

    // 메시지 조립
    const lines = [];
    if (remain !== null) lines.push("💵 예상 잔액 " + fmt(remain) + "원");
    lines.push(
      "🧾 오늘 지출 " + todayExp.length + "건 · " + fmt(todayTotal) + "원" +
      (topCat ? " (최다 " + topCat + ")" : "")
    );
    if (Object.keys(budgets).length) {
      lines.push(
        over.length
          ? "⚠️ 예산 초과 " + over.length + "건: " +
            over.slice(0, 2).map((o) => o.cat + " +" + fmt(o.diff)).join(", ")
          : "✅ 모든 예산 이내"
      );
    }
    lines.push("📥 미수금 " + fmt(dueTotal) + "원 · 카드 실부담 " + fmt(cardReal) + "원");

    const title = "📊 오늘의 가계부 (" + (now.getMonth() + 1) + "/" + now.getDate() + ")";
    const body = lines.join("\n");

    // FCM 토큰 (fcmTokens 컬렉션)
    const tokSnap = await db.collection("fcmTokens").get();
    const tokDocs = tokSnap.docs
      .map((d) => ({ id: d.id, userId: (d.data() || {}).userId || d.id, token: (d.data() || {}).token }))
      .filter((t) => t.token);
    if (!tokDocs.length) { console.log("FCM 토큰 없음 - 전송 생략"); return; }

    const res = await admin.messaging().sendEachForMulticast({
      tokens: tokDocs.map((t) => t.token),
      notification: { title, body },
      webpush: {
        notification: {
          title, body,
          icon: "https://odols7582.github.io/odols/icon-192.png",
          badge: "https://odols7582.github.io/odols/icon-192.png",
        },
        fcmOptions: { link: "https://odols7582.github.io/odols/" },
      },
    });

    // 토큰별 결과 로깅 + 무효 토큰 자동 정리
    const INVALID = [
      "messaging/registration-token-not-registered",
      "messaging/invalid-registration-token",
      "messaging/invalid-argument",
    ];
    await Promise.all(res.responses.map(async (r, i) => {
      const t = tokDocs[i];
      if (r.success) {
        console.log("✅ 전송 성공:", t.userId);
      } else {
        const code = r.error && r.error.code;
        console.error("❌ 전송 실패:", t.userId, "|", code, "|", r.error && r.error.message);
        if (INVALID.indexOf(code) >= 0) {
          await db.collection("fcmTokens").doc(t.id).delete().catch(() => {});
          console.log("🗑 만료 토큰 삭제:", t.userId, "(앱에서 알림 다시 허용하면 새 토큰 생성됨)");
        }
      }
    }));
    console.log("보고서 전송:", res.successCount + "/" + tokDocs.length, "\n" + body);
  }
);

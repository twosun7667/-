const cardsEl = document.getElementById("cards");
const updatedAtEl = document.getElementById("updatedAt");
const errorBoxEl = document.getElementById("errorBox");
const refreshBtn = document.getElementById("refreshBtn");

function formatBasDt(basDt) {
  if (!basDt || basDt.length !== 8) return basDt || "-";
  return `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;
}

function formatNumber(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("ko-KR");
}

function changeClass(vs) {
  const n = Number(vs);
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}

function changeSign(vs) {
  const n = Number(vs);
  if (n > 0) return "▲";
  if (n < 0) return "▼";
  return "-";
}

function drawChart(canvas, history) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const closes = history.map((item) => Number(item.clpr)).filter((v) => !Number.isNaN(v));
  if (closes.length < 2) {
    ctx.fillStyle = "#9aa1ac";
    ctx.font = "12px sans-serif";
    ctx.fillText("차트를 그릴 데이터가 부족합니다.", 8, h / 2);
    return;
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const padding = 6;

  const points = closes.map((v, i) => {
    const x = padding + (i / (closes.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return [x, y];
  });

  const rising = closes[closes.length - 1] >= closes[0];
  ctx.strokeStyle = rising ? "#e5484d" : "#2f7de1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = rising ? "rgba(229,72,77,0.12)" : "rgba(47,125,225,0.12)";
  ctx.lineTo(points[points.length - 1][0], h - padding);
  ctx.lineTo(points[0][0], h - padding);
  ctx.closePath();
  ctx.fill();
}

function renderCard(stock) {
  const history = stock.history || [];
  const latest = history[history.length - 1];

  const card = document.createElement("section");
  card.className = "card";

  if (!latest) {
    card.innerHTML = `
      <div class="card-top">
        <span class="card-name">${stock.name}</span>
        <span class="card-code">${stock.code}</span>
      </div>
      <p class="skeleton">해당 기간에 조회된 시세 데이터가 없습니다.</p>
    `;
    return card;
  }

  const cls = changeClass(latest.vs);
  const sign = changeSign(latest.vs);

  card.innerHTML = `
    <div class="card-top">
      <span class="card-name">${stock.name}</span>
      <span class="card-code">${stock.code}</span>
    </div>
    <div class="card-price">${formatNumber(latest.clpr)}원</div>
    <div class="card-change ${cls}">
      ${sign} ${formatNumber(Math.abs(Number(latest.vs) || 0))}원
      (${Number(latest.fltRt) > 0 ? "+" : ""}${latest.fltRt}%)
    </div>
    <div class="card-basdt">기준일 ${formatBasDt(latest.basDt)} · 1영업일 지연 데이터</div>
    <div class="card-meta">
      <span>거래량 <b>${formatNumber(latest.trqu)}</b></span>
      <span>시가총액 <b>${formatNumber(latest.mrktTotAmt)}</b>원</span>
    </div>
    <div class="chart-wrap"><canvas></canvas></div>
  `;

  requestAnimationFrame(() => {
    const canvas = card.querySelector("canvas");
    drawChart(canvas, history);
  });

  return card;
}

let lastStocks = null;

function renderAll(stocks) {
  cardsEl.innerHTML = "";
  stocks.forEach((stock) => cardsEl.appendChild(renderCard(stock)));
}

async function loadQuotes() {
  refreshBtn.disabled = true;
  errorBoxEl.hidden = true;
  updatedAtEl.textContent = "불러오는 중...";

  try {
    const res = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        "데이터 파일을 찾을 수 없습니다. GitHub Actions 워크플로가 아직 한 번도 실행되지 않았을 수 있습니다."
      );
    }
    const data = await res.json();

    lastStocks = data.stocks;
    renderAll(lastStocks);

    const t = new Date(data.updatedAt);
    updatedAtEl.textContent = `마지막 갱신: ${t.toLocaleString("ko-KR")}`;
  } catch (err) {
    errorBoxEl.textContent = err.message || "알 수 없는 오류가 발생했습니다.";
    errorBoxEl.hidden = false;
    updatedAtEl.textContent = "불러오기 실패";
  } finally {
    refreshBtn.disabled = false;
  }
}

let resizeTimer = null;
refreshBtn.addEventListener("click", loadQuotes);
window.addEventListener("resize", () => {
  if (!lastStocks) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderAll(lastStocks), 150);
});
loadQuotes();

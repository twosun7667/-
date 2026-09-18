// Cloudflare Worker — 정적 파일은 ASSETS 바인딩이 서빙하고,
// /api/* 요청만 이 스크립트가 처리해 data.go.kr을 대신 호출한다(API 키를 브라우저에 감춤).
const STOCKS = [
  { code: "005930", name: "삼성전자" },
  { code: "000660", name: "SK하이닉스" },
];

function formatDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchStockHistory(apiKey, code, beginBasDt, endBasDt) {
  const url = new URL(
    "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
  );
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("resultType", "json");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("likeSrtnCd", code);
  url.searchParams.set("beginBasDt", beginBasDt);
  url.searchParams.set("endBasDt", endBasDt);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`data.go.kr 응답 오류 (HTTP ${res.status})`);
  }

  const json = await res.json();
  const header = json?.response?.header;
  if (header && header.resultCode !== "00") {
    throw new Error(header.resultMsg || "공공데이터포털 API 오류");
  }

  const raw = json?.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // likeSrtnCd는 부분일치 검색이라 동일 코드만 남기고, 혹시 필터 결과가
  // 비면(코드 형식이 다른 예외 케이스) 원본 리스트를 그대로 사용한다.
  const filtered = list.filter((item) => item.srtnCd === code);
  const finalList = filtered.length > 0 ? filtered : list;

  finalList.sort((a, b) => a.basDt.localeCompare(b.basDt));
  return finalList;
}

async function handleQuotes(env) {
  const apiKey = env.STOCK_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "서버에 STOCK_API_KEY가 설정되지 않았습니다. Cloudflare 대시보드의 Settings → Variables and Secrets에서 등록해주세요.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const end = new Date();
  const begin = new Date();
  begin.setMonth(begin.getMonth() - 3);
  const beginBasDt = formatDate(begin);
  const endBasDt = formatDate(end);

  try {
    const stocks = await Promise.all(
      STOCKS.map(async ({ code, name }) => {
        const history = await fetchStockHistory(apiKey, code, beginBasDt, endBasDt);
        return { code, name, history };
      })
    );

    return new Response(
      JSON.stringify({ updatedAt: new Date().toISOString(), stocks }),
      {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "알 수 없는 오류가 발생했습니다." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/quotes") {
      return handleQuotes(env);
    }
    return env.ASSETS.fetch(request);
  },
};

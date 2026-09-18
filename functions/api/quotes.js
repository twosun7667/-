// Cloudflare Pages Function — 브라우저 대신 서버에서 data.go.kr을 호출해 API 키를 감춘다.
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

export async function onRequestGet(context) {
  const apiKey = context.env.STOCK_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "서버에 STOCK_API_KEY가 설정되지 않았습니다. Cloudflare Pages 프로젝트 설정에서 Secret을 등록해주세요.",
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

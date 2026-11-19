export const M3u8ProxyV1 = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  // ค่าเริ่มต้นต่างๆ รวมถึง User-Agent
  const refererUrl =
    url.searchParams.get("referer") || "https://www.watchlakorn.org";

  const targetUrl =
    url.searchParams.get("url") ||
    "https://www.watchlakorn.org/pegdeny/ccddaaad84c9f04aeca7a3a380031692/aGQ=/master.m3u8";

  const originUrl =
    url.searchParams.get("origin") || "https://www.watchlakorn.org";

  // รับค่า user-agent จาก query string หรือกำหนดค่าเริ่มต้นเป็น "XP Player"
  const userAgent =
    url.searchParams.get("user-agent") ||
    url.searchParams.get("agent") ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // อนุญาตเฉพาะ URL แบบ HTTP/HTTPS
  let target: URL;
  try {
    target = new URL(targetUrl);
    if (!["http:", "https:"].includes(target.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return new Response("Invalid URL", {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    // ส่ง User-Agent ไปพร้อมกับ Request ไปยังเซิร์ฟเวอร์ต้นทาง
    const response = await fetch(target.toString(), {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers: {
        Referer: refererUrl,
        Origin: originUrl,
        "User-Agent": userAgent,
      },
      redirect: "follow",
    });

    const contentType =
      response.headers.get("Content-Type") || "";

    const isM3u8 =
      /\.m3u8(?:$|[?#])/i.test(target.toString()) ||
      contentType.includes("mpegurl");

    const headers = new Headers(corsHeaders);
    headers.set(
      "Content-Type",
      contentType || "application/vnd.apple.mpegurl"
    );

    if (!response.ok) {
      return new Response(
        request.method === "HEAD" ? null : `Upstream error: ${response.status}`,
        { status: response.status, headers }
      );
    }

    if (request.method === "HEAD") {
      return new Response(null, {
        status: response.status,
        headers,
      });
    }

    if (isM3u8) {
      const playlist = await response.text();

      // แปลง URL ของ playlist, segment และ key พร้อมส่งต่อ userAgent ไปด้วย
      const rewritten = playlist
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();

          if (!trimmed) return line;

          if (trimmed.startsWith("#")) {
            return line.replace(
              /URI="([^"]+)"/g,
              (_match, uri) => {
                const absolute = new URL(uri, target).toString();
                return `URI="${makeProxyUrl(absolute, url.origin, refererUrl, originUrl, userAgent)}"`;
              }
            );
          }

          const absolute = new URL(trimmed, target).toString();
          return makeProxyUrl(
            absolute,
            url.origin,
            refererUrl,
            originUrl,
            userAgent
          );
        })
        .join("\n");

      return new Response(rewritten, {
        status: response.status,
        headers,
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch {
    return new Response("Upstream request failed", {
      status: 502,
      headers: corsHeaders,
    });
  }
};

function makeProxyUrl(
  target: string,
  proxyOrigin: string,
  referer: string,
  origin: string,
  userAgent: string
): string {
  const params = new URLSearchParams({
    url: target,
    referer,
    origin,
    "user-agent": userAgent,
  });

  return `${proxyOrigin}/?${params.toString()}`;
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // กำหนด Target Backend ปลายทางของคุณ (Xtream Codes API / Streaming Server)
  const targetHost = 'http://119.10.136.162:8080';
  
  // ส่งต่อ Path และ Query String ทั้งหมด (เช่น /player_api.php?username=...)
  const targetUrl = targetHost + url.pathname + url.search;

  // จัดการ Preflight Request (CORS Options)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // สร้าง Request ใหม่เพื่อยิงไปยังเซิร์ฟเวอร์ปลายทาง
  const modifiedRequest = new Request(targetUrl, {
    headers: request.headers,
    method: request.method,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'follow'
  });

  // (ทางเลือก) กำหนด User-Agent หรือ Header เพิ่มเติมถ้าเซิร์ฟเวอร์ปลายทางจำกัด
  modifiedRequest.headers.set('X-Forwarded-Host', url.host);

  try {
    const response = await fetch(modifiedRequest);
    
    // คัดลอก Response เพื่อแก้ไข Header สำหรับ CORS
    const newResponse = new Response(response.body, response);
    
    // เพิ่ม CORS Header เพื่อให้เบราว์เซอร์ยอมรับการเชื่อมต่อ
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', '*');
    
    // ป้องกันการแคชผิดพลาด (ถ้าจำเป็น)
    newResponse.headers.delete('Content-Security-Policy');

    return newResponse;
    
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy Fetch Failed: ' + err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

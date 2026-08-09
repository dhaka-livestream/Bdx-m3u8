// _worker.js – সম্পূর্ণ স্মার্ট ও শক্তিশালী M3U8 প্রক্সি

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 📌 আপনার সব চ্যানেলের লিংক (সঠিক ফরম্যাটে)
    const CHANNELS = {
      // ১. স্টার জলসা (HTTP IP লিংক)
      'star_jalsha': 'http://103.165.93.31:8095/starJalsha/tracks-v1a1/mono.m3u8',

      // ২. জি বাংলা (Toffeelive - আগের মতই কাজ করবে)
      'zee_bangla': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/zee_bangla_576/zee_bangla_576.m3u8?bitrate=1000000&channel=zee_bangla_576&gp_id=',

      // ৩. স্টার প্লাস (Toffeelive - ফরম্যাট ঠিক করা হয়েছে)
      'starplus': 'https://bldcmprod-cdn.toffeelive.com/cdn/live/slang/starplus_576/starplus_576.m3u8?bitrate=1000000&channel=starplus_576&gp_id=',
    };

    const match = path.match(/^\/(.+)\.m3u8$/);

    if (match) {
      const channelName = match[1];
      const originalUrl = CHANNELS[channelName];

      if (!originalUrl) {
        const available = Object.keys(CHANNELS).join(', ');
        return new Response(`Channel "${channelName}" not found. Available: ${available}`, { status: 404 });
      }

      // 🔍 স্মার্ট ডিটেকশন: কোন লিংকের জন্য কীভাবে ফেচ করবে
      let targetUrl = originalUrl;
      let useS2Proxy = originalUrl.includes('toffeelive.com');

      if (useS2Proxy) {
        // toffeelive লিংক: s2.itcnbd.live প্রক্সি দিয়ে ফেচ করবে
        targetUrl = `https://s2.itcnbd.live/server-2/proxy/${channelName}/playlist?u=${encodeURIComponent(originalUrl)}`;
      }

      try {
        // 📥 প্লেলিস্ট ফেচ করুন
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Referer': originalUrl.includes('toffeelive.com') ? 'https://www.toffeelive.com/' : 'http://103.165.93.31:8095/',
          }
        });

        if (!response.ok) {
          return new Response(`Fetch failed: ${response.status} - ${response.statusText}`, { status: response.status });
        }

        let content = await response.text();

        // 🛠️ বেস URL বের করুন (সেগমেন্ট রিরাইটের জন্য)
        const baseUrlObj = new URL(originalUrl);
        const baseOrigin = baseUrlObj.origin;
        // পাথ থেকে শেষের ফাইল নাম বাদ দিন (যেমন mono.m3u8 বা zee_bangla_576.m3u8)
        const basePath = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);

        // লাইন বাই লাইন প্রক্রিয়া করুন (সব ধরনের রিলেটিভ পাথ সাপোর্ট করবে)
        const lines = content.split('\n');
        const newLines = lines.map(line => {
          // খালি লাইন বা কমেন্ট লাইন (# দিয়ে শুরু) অপরিবর্তিত রাখুন
          if (line.trim() === '' || line.startsWith('#')) {
            return line;
          }

          // যদি লাইনটি ইতিমধ্যে পূর্ণাঙ্গ URL (http/https) হয়, তবে অপরিবর্তিত রাখুন
          if (line.match(/^https?:\/\//)) {
            return line;
          }

          // যদি লাইন স্ল্যাশ দিয়ে শুরু হয় (যেমন /segment.ts)
          if (line.startsWith('/')) {
            return baseOrigin + line;
          }

          // বাকি সব ক্ষেত্রে (যেমন segment.ts, ../folder/segment.ts)
          // বেস পাথের সাথে যুক্ত করুন
          return baseOrigin + basePath + line;
        });

        content = newLines.join('\n');

        // M3U8 রেসপন্স রিটার্ন করুন
        return new Response(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'public, max-age=2',
            'Access-Control-Allow-Origin': '*',
          }
        });

      } catch (error) {
        return new Response('Proxy Error: ' + error.message, { status: 500 });
      }
    }

    // হোম পেজ
    const list = Object.keys(CHANNELS).map(ch => `/${ch}.m3u8`).join('\n');
    return new Response(`✅ Smart Proxy Active.\n\nAvailable Channels:\n${list}`, { status: 200 });
  }
};

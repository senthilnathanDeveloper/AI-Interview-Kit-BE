const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// Security helper to validate URLs & SSRF protection
function isSafeUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    
    // Allow localhost/127.0.0.1 in non-production for local batch testing (Spec Appendix B uses localhost:8099)
    if (process.env.NODE_ENV === 'production') {
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('172.16.')
      ) {
        return false;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function fetchPageContent(url, timeoutMs = 5000) {
  if (!isSafeUrl(url)) {
    throw new Error(`Invalid or unsafe URL: ${url}`);
  }

  const response = await axios.get(url, {
    timeout: timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 (AI-Interview-Kit-Crawler/1.0; +https://interviewprep.ai)'
    },
    maxContentLength: 500000, // 500KB limit
    validateStatus: status => status >= 200 && status < 300
  });

  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('json')) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav noise
  $('script, style, noscript, svg, iframe').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim() || url;
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  // Extract relative/absolute links for crawling ranking
  const links = [];
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const absoluteUrl = new URL(href, url).href;
        const text = $(el).text().trim();
        links.push({ url: absoluteUrl, text });
      }
    } catch (e) {
      // ignore invalid URLs
    }
  });

  return {
    url,
    title,
    text: bodyText.slice(0, 8000), // Cap per page
    links
  };
}

// Rank discovered links for hiring / about / handbook interest
function rankLinks(links, baseUrl) {
  const baseHost = new URL(baseUrl).hostname;
  const keywords = ['career', 'job', 'hiring', 'about', 'handbook', 'culture', 'team', 'interview', 'engineering', 'value'];

  const candidateLinks = links.filter(link => {
    try {
      const parsed = new URL(link.url);
      return parsed.hostname === baseHost || parsed.hostname.endsWith('.' + baseHost);
    } catch (e) {
      return false;
    }
  });

  candidateLinks.sort((a, b) => {
    const scoreA = keywords.reduce((acc, kw) => acc + (a.url.toLowerCase().includes(kw) || a.text.toLowerCase().includes(kw) ? 1 : 0), 0);
    const scoreB = keywords.reduce((acc, kw) => acc + (b.url.toLowerCase().includes(kw) || b.text.toLowerCase().includes(kw) ? 1 : 0), 0);
    return scoreB - scoreA;
  });

  // Unique URLs
  const uniqueUrls = [];
  const seen = new Set([baseUrl]);
  for (const l of candidateLinks) {
    if (!seen.has(l.url) && uniqueUrls.length < 3) {
      seen.add(l.url);
      uniqueUrls.push(l.url);
    }
  }

  return uniqueUrls;
}

async function crawlCompanySite(companyUrl) {
  const result = {
    success: false,
    companyName: '',
    pages: [],
    sourcesUsed: [],
    error: null
  };

  if (!companyUrl || typeof companyUrl !== 'string') {
    result.error = 'No company URL provided';
    return result;
  }

  let formattedUrl = companyUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  try {
    // 1. Fetch home page
    const homepage = await fetchPageContent(formattedUrl);
    result.pages.push(homepage);
    result.sourcesUsed.push(homepage.url);
    result.success = true;

    // Derive company name from domain or page title
    try {
      const parsed = new URL(formattedUrl);
      const hostParts = parsed.hostname.replace('www.', '').split('.');
      result.companyName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
    } catch (e) {
      result.companyName = homepage.title.split('-')[0].split('|')[0].trim() || 'Company';
    }

    // 2. Discover and crawl top 2-3 relevant child links (/careers, /about, etc.)
    const topChildUrls = rankLinks(homepage.links, homepage.url);
    for (const childUrl of topChildUrls) {
      try {
        const childPage = await fetchPageContent(childUrl, 4000);
        result.pages.push(childPage);
        result.sourcesUsed.push(childPage.url);
      } catch (childErr) {
        // Spec rule: "Skip and report a source that cannot be retrieved, rather than failing the whole run"
        console.warn(`[Crawler] Skipped unretrievable link ${childUrl}: ${childErr.message}`);
      }
    }
  } catch (err) {
    // Main page fetch failed (404, invalid URL, timeout, offline)
    console.warn(`[Crawler] Failed to crawl ${formattedUrl}: ${err.message}`);
    result.error = err.message;
    // Derive fallback name from URL if possible
    try {
      const parsed = new URL(formattedUrl);
      result.companyName = parsed.hostname.replace('www.', '').split('.')[0];
      result.companyName = result.companyName.charAt(0).toUpperCase() + result.companyName.slice(1);
    } catch (e) {
      result.companyName = 'Target Company';
    }
  }

  return result;
}

module.exports = { crawlCompanySite, fetchPageContent, isSafeUrl };

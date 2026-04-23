// Cloudflare Worker：代理高德地图 API，完全隐藏 Key
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 新版首页
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = INDEX_HTML.replace(
        '{{SECURITY_CONFIG}}',
        `window._AMapSecurityConfig = { securityJsCode: '${env.AMAP_SECURITY_KEY || ''}' };`
      );
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 2. 旧版入口
    if (url.pathname === '/old' || url.pathname === '/old/index.html') {
      let html = atob(OLD_HTML_B64);
      const switchBtn = `<div style="position:fixed;top:10px;right:10px;z-index:9999;background:rgba(102,126,234,0.9);color:#fff;padding:6px 12px;border-radius:4px;font-size:12px;"><span>旧版</span> | <a href="/" style="color:#fff;text-decoration:underline;">切换到新版</a></div>`;
      html = html.replace('</body>', switchBtn + '</body>');
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 3. 代理高德地图 JS API
    if (url.pathname === '/api/amap/maps') {
      const amapUrl = new URL('https://webapi.amap.com/maps');
      amapUrl.searchParams.set('key', env.AMAP_KEY);
      amapUrl.searchParams.set('v', url.searchParams.get('v') || '2.0');
      const plugin = url.searchParams.get('plugin');
      if (plugin) {
        amapUrl.searchParams.set('plugin', plugin);
      }
      const response = await fetch(amapUrl.toString());
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'application/javascript',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 4. 代理高德 REST API
    if (url.pathname.startsWith('/api/amap/')) {
      const endpoint = url.pathname.replace('/api/amap/', '');
      const amapUrl = new URL(`https://restapi.amap.com/${endpoint}`);
      url.searchParams.forEach((value, key) => {
        if (key !== 'key') {
          amapUrl.searchParams.set(key, value);
        }
      });
      amapUrl.searchParams.set('key', env.AMAP_KEY);
      const response = await fetch(amapUrl.toString());
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 5. 其他静态资源
    return fetch(request);
  }
};

// 新版 HTML（完全移除所有 Key）
const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>高德地图顺路规划系统 - 正式版</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100vh; overflow: hidden; }
        .container { display: flex; height: 100vh; }
        .sidebar { width: 400px; background: white; box-shadow: 2px 0 10px rgba(0,0,0,0.1); display: flex; flex-direction: column; z-index: 100; }
        .header { padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .version-switch { margin-top: 10px; font-size: 12px; }
        .version-switch a { color: #fff; text-decoration: underline; opacity: 0.8; }
        .version-switch a:hover { opacity: 1; }
        .content { flex: 1; overflow-y: auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 13px; }
        .form-group input { width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 13px; transition: border-color 0.3s; }
        .form-group input:focus { outline: none; border-color: #667eea; }
        .btn { width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; margin-bottom: 8px; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .btn-danger { background: #ff4757; color: white; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        #map-container { flex: 1; position: relative; }
        #map { width: 100%; height: 100%; }
        .loading { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center; color: white; font-size: 18px; z-index: 1000; }
        .company-list { max-height: 300px; overflow-y: auto; }
        .company-item { padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: all 0.3s; }
        .company-item:hover { border-color: #667eea; background: #f8f9ff; }
        .company-item.selected { border-color: #667eea; background: #667eea; color: white; }
        .log-panel { max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 6px; margin-top: 10px; }
        .log-entry { margin-bottom: 4px; }
        .log-info { color: #4ec9b0; }
        .log-error { color: #f48771; }
        .log-success { color: #b5cea8; }
    </style>
</head>
<body>
    <div class="loading" id="loading">处理中，请稍候...</div>

    <div class="container">
        <div class="sidebar">
            <div class="header">
                <h1>🗺️ 顺路规划系统</h1>
                <p>智能路线规划，高效拜访客户</p>
                <div class="version-switch">新版 | <a href="/old">切回旧版</a></div>
            </div>

            <div class="content">
                <div class="form-group">
                    <label>📥 批量导入（公司名字和地址）</label>
                    <textarea id="batchInput" rows="4" placeholder="公司名,地址&#10;示例公司,北京市朝阳区xxx路xxx号" style="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:6px;font-size:13px;"></textarea>
                    <button class="btn btn-primary" onclick="batchImport()">开始智能导入</button>
                </div>

                <div class="form-group">
                    <label>➕ 单条添加</label>
                    <input type="text" id="companyName" placeholder="公司名称">
                    <input type="text" id="companyAddress" placeholder="公司地址" style="margin-top:8px;">
                    <button class="btn btn-secondary" onclick="addCompany()">添加</button>
                </div>

                <div class="form-group">
                    <label>📋 已添加公司</label>
                    <div class="company-list" id="companyList"></div>
                </div>

                <button class="btn btn-primary" onclick="planRoute()">🚀 规划最优路线</button>
                <button class="btn btn-danger" onclick="clearAll()">🗑️ 清空所有数据</button>

                <div class="log-panel" id="logPanel">
                    <div class="log-entry log-info">系统初始化完成，等待输入...</div>
                </div>
            </div>
        </div>

        <div id="map-container">
            <div id="map"></div>
        </div>
    </div>

    <script>{{SECURITY_CONFIG}}</script>

    <script>
        let map = null;
        let driving = null;
        let placeSearch = null;
        let geocoder = null;
        let companies = [];
        let markers = [];

        function log(message, type = 'info') {
            const panel = document.getElementById('logPanel');
            const entry = document.createElement('div');
            entry.className = 'log-entry log-' + type;
            entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
            panel.appendChild(entry);
            panel.scrollTop = panel.scrollHeight;
        }

        function initMap() {
            try {
                map = new AMap.Map('map', {
                    zoom: 11,
                    center: [116.397428, 39.90923]
                });
                driving = new AMap.Driving({
                    map: map,
                    panel: 'panel'
                });
                placeSearch = new AMap.PlaceSearch({
                    pageSize: 5,
                    pageIndex: 1,
                    city: '全国'
                });
                geocoder = new AMap.Geocoder({
                    radius: 1000
                });
                log('地图初始化成功', 'success');
            } catch (error) {
                log('地图初始化失败: ' + error.message, 'error');
            }
        }

        function batchImport() {
            const input = document.getElementById('batchInput').value.trim();
            if (!input) {
                log('请输入公司信息', 'error');
                return;
            }
            const lines = input.split('\\n');
            log('开始批量导入 ' + lines.length + ' 条数据...', 'info');
            lines.forEach((line, index) => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const name = parts[0].trim();
                    const address = parts[1].trim();
                    if (name && address) {
                        companies.push({ name, address, lng: null, lat: null });
                        log('添加公司: ' + name, 'success');
                    }
                }
            });
            updateCompanyList();
            geocodeCompanies();
        }

        function addCompany() {
            const name = document.getElementById('companyName').value.trim();
            const address = document.getElementById('companyAddress').value.trim();
            if (!name || !address) {
                log('请输入完整的公司信息', 'error');
                return;
            }
            companies.push({ name, address, lng: null, lat: null });
            log('添加公司: ' + name, 'success');
            document.getElementById('companyName').value = '';
            document.getElementById('companyAddress').value = '';
            updateCompanyList();
            geocodeCompany(companies.length - 1);
        }

        function updateCompanyList() {
            const list = document.getElementById('companyList');
            list.innerHTML = '';
            companies.forEach((company, index) => {
                const item = document.createElement('div');
                item.className = 'company-item';
                item.innerHTML = '<strong>' + company.name + '</strong><br><small>' + company.address + '</small>';
                item.onclick = () => selectCompany(index);
                list.appendChild(item);
            });
        }

        function geocodeCompanies() {
            log('开始地理编码...', 'info');
            companies.forEach((company, index) => {
                setTimeout(() => geocodeCompany(index), index * 200);
            });
        }

        function geocodeCompany(index) {
            const company = companies[index];
            if (!company || company.lng) return;
            geocoder.getLocation(company.address, (status, result) => {
                if (status === 'complete' && result.geocodes.length) {
                    const loc = result.geocodes[0];
                    company.lng = loc.location.lng;
                    company.lat = loc.location.lat;
                    const marker = new AMap.Marker({
                        position: [company.lng, company.lat],
                        title: company.name,
                        map: map
                    });
                    markers.push(marker);
                    log(company.name + ' 定位成功', 'success');
                } else {
                    log(company.name + ' 定位失败', 'error');
                }
            });
        }

        function planRoute() {
            if (companies.length < 2) {
                log('请至少添加两个公司', 'error');
                return;
            }
            const validCompanies = companies.filter(c => c.lng && c.lat);
            if (validCompanies.length < 2) {
                log('定位成功的公司不足两个', 'error');
                return;
            }
            log('开始规划路线...', 'info');
            const route = calculateOptimalRoute(validCompanies);
            displayRoute(route);
        }

        function calculateOptimalRoute(points) {
            const route = [points[0]];
            const remaining = points.slice(1);
            while (remaining.length > 0) {
                const current = route[route.length - 1];
                let nearestIndex = 0;
                let minDistance = Infinity;
                remaining.forEach((point, index) => {
                    const dist = calculateDistance(current, point);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestIndex = index;
                    }
                });
                route.push(remaining[nearestIndex]);
                remaining.splice(nearestIndex, 1);
            }
            return route;
        }

        function calculateDistance(p1, p2) {
            const dx = p1.lng - p2.lng;
            const dy = p1.lat - p2.lat;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function displayRoute(route) {
            driving.clear();
            const path = route.map(c => new AMap.LngLat(c.lng, c.lat));
            driving.search(path[0], path[path.length - 1], {
                waypoints: path.slice(1, -1)
            }, (status, result) => {
                if (status === 'complete') {
                    log('路线规划成功！总距离: ' + (result.routes[0].distance / 1000).toFixed(2) + '公里', 'success');
                } else {
                    log('路线规划失败', 'error');
                }
            });
        }

        function clearAll() {
            companies = [];
            markers.forEach(m => m.setMap(null));
            markers = [];
            driving && driving.clear();
            updateCompanyList();
            log('已清空所有数据', 'info');
        }

        function selectCompany(index) {
            const items = document.querySelectorAll('.company-item');
            items.forEach((item, i) => {
                item.classList.toggle('selected', i === index);
            });
        }
    </script>

    <script src="/api/amap/maps?v=2.0&plugin=AMap.Driving,AMap.Marker,AMap.InfoWindow,AMap.PlaceSearch,AMap.Geocoder"></script>
    <script>window.addEventListener('load', initMap);</script>
</body>
</html>`;

const OLD_HTML_B64 =
  "PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9InpoLUNOIj4KPGhlYWQ+CiAgICA8bWV0YSBjaGFy" +
  "c2V0PSJVVEYtOCI+CiAgICA8bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2" +
  "aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMCI+CiAgICA8dGl0bGU+6auY5b635Zyw5Zu+6aG6" +
  "6Lev6KeE5YiS57O757ufIC0g5q2j5byP54mIPC90aXRsZT4KICAgIDxzdHlsZT4KICAgICAgICAq" +
  "IHsKICAgICAgICAgICAgbWFyZ2luOiAwOwogICAgICAgICAgICBwYWRkaW5nOiAwOwogICAgICAg" +
  "ICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94OwogICAgICAgIH0KICAgICAgICAKICAgICAgICBi" +
  "b2R5IHsKICAgICAgICAgICAgZm9udC1mYW1pbHk6IC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lz" +
  "dGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCAnSGVsdmV0aWNhIE5ldWUnLCBBcmlhbCwgc2Fu" +
  "cy1zZXJpZjsKICAgICAgICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywg" +
  "IzY2N2VlYSAwJSwgIzc2NGJhMiAxMDAlKTsKICAgICAgICAgICAgaGVpZ2h0OiAxMDB2aDsKICAg" +
  "ICAgICAgICAgb3ZlcmZsb3c6IGhpZGRlbjsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmNv" +
  "bnRhaW5lciB7CiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7CiAgICAgICAgICAgIGhlaWdodDog" +
  "MTAwdmg7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8qIOW3puS+p+mdouadv+agt+W8jyAq" +
  "LwogICAgICAgIC5zaWRlYmFyIHsKICAgICAgICAgICAgd2lkdGg6IDQwMHB4OwogICAgICAgICAg" +
  "ICBiYWNrZ3JvdW5kOiB3aGl0ZTsKICAgICAgICAgICAgYm94LXNoYWRvdzogMnB4IDAgMTBweCBy" +
  "Z2JhKDAsMCwwLDAuMSk7CiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7CiAgICAgICAgICAgIGZs" +
  "ZXgtZGlyZWN0aW9uOiBjb2x1bW47CiAgICAgICAgICAgIHotaW5kZXg6IDEwMDsKICAgICAgICB9" +
  "CiAgICAgICAgCiAgICAgICAgLmhlYWRlciB7CiAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7CiAg" +
  "ICAgICAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICM2NjdlZWEgMCUs" +
  "ICM3NjRiYTIgMTAwJSk7CiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTsKICAgICAgICB9CiAgICAg" +
  "ICAgCiAgICAgICAgLmhlYWRlciBoMSB7CiAgICAgICAgICAgIGZvbnQtc2l6ZTogMjRweDsKICAg" +
  "ICAgICAgICAgbWFyZ2luLWJvdHRvbTogNXB4OwogICAgICAgIH0KICAgICAgICAKICAgICAgICAu" +
  "aGVhZGVyIHAgewogICAgICAgICAgICBmb250LXNpemU6IDE0cHg7CiAgICAgICAgICAgIG9wYWNp" +
  "dHk6IDAuOTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmNvbnRlbnQgewogICAgICAgICAg" +
  "ICBmbGV4OiAxOwogICAgICAgICAgICBvdmVyZmxvdy15OiBhdXRvOwogICAgICAgICAgICBwYWRk" +
  "aW5nOiAyMHB4OwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvKiDooajljZXmoLflvI8gKi8K" +
  "ICAgICAgICAuZm9ybS1ncm91cCB7CiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDE1cHg7CiAg" +
  "ICAgICAgfQogICAgICAgIAogICAgICAgIC5mb3JtLWdyb3VwIGxhYmVsIHsKICAgICAgICAgICAg" +
  "ZGlzcGxheTogYmxvY2s7CiAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDZweDsKICAgICAgICAg" +
  "ICAgZm9udC13ZWlnaHQ6IDYwMDsKICAgICAgICAgICAgY29sb3I6ICMzMzM7CiAgICAgICAgICAg" +
  "IGZvbnQtc2l6ZTogMTNweDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmZvcm0tZ3JvdXAg" +
  "aW5wdXQgewogICAgICAgICAgICB3aWR0aDogMTAwJTsKICAgICAgICAgICAgcGFkZGluZzogMTBw" +
  "eDsKICAgICAgICAgICAgYm9yZGVyOiAycHggc29saWQgI2UwZTBlMDsKICAgICAgICAgICAgYm9y" +
  "ZGVyLXJhZGl1czogNnB4OwogICAgICAgICAgICBmb250LXNpemU6IDEzcHg7CiAgICAgICAgICAg" +
  "IHRyYW5zaXRpb246IGJvcmRlci1jb2xvciAwLjNzOwogICAgICAgIH0KICAgICAgICAKICAgICAg" +
  "ICAuZm9ybS1ncm91cCBpbnB1dDpmb2N1cyB7CiAgICAgICAgICAgIG91dGxpbmU6IG5vbmU7CiAg" +
  "ICAgICAgICAgIGJvcmRlci1jb2xvcjogIzY2N2VlYTsKICAgICAgICB9CiAgICAgICAgCiAgICAg" +
  "ICAgLmJ0biB7CiAgICAgICAgICAgIHdpZHRoOiAxMDAlOwogICAgICAgICAgICBwYWRkaW5nOiAx" +
  "MHB4OwogICAgICAgICAgICBib3JkZXI6IG5vbmU7CiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6" +
  "IDZweDsKICAgICAgICAgICAgZm9udC1zaXplOiAxNHB4OwogICAgICAgICAgICBmb250LXdlaWdo" +
  "dDogNjAwOwogICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7CiAgICAgICAgICAgIHRyYW5zaXRp" +
  "b246IGFsbCAwLjNzOwogICAgICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7CiAgICAgICAgfQog" +
  "ICAgICAgIAogICAgICAgIC5idG4tcHJpbWFyeSB7CiAgICAgICAgICAgIGJhY2tncm91bmQ6IGxp" +
  "bmVhci1ncmFkaWVudCgxMzVkZWcsICM2NjdlZWEgMCUsICM3NjRiYTIgMTAwJSk7CiAgICAgICAg" +
  "ICAgIGNvbG9yOiB3aGl0ZTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmJ0bi1wcmltYXJ5" +
  "OmhvdmVyIHsKICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xcHgpOwogICAgICAg" +
  "ICAgICBib3gtc2hhZG93OiAwIDRweCAxMnB4IHJnYmEoMTAyLCAxMjYsIDIzNCwgMC40KTsKICAg" +
  "ICAgICB9CiAgICAgICAgCiAgICAgICAgLmJ0bi1zdWNjZXNzIHsKICAgICAgICAgICAgYmFja2dy" +
  "b3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzExOTk4ZSAwJSwgIzM4ZWY3ZCAxMDAlKTsK" +
  "ICAgICAgICAgICAgY29sb3I6IHdoaXRlOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAuYnRu" +
  "LXN1Y2Nlc3M6aG92ZXIgewogICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTFweCk7" +
  "CiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgNHB4IDEycHggcmdiYSgxNywgMTUzLCAxNDIsIDAu" +
  "NCk7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5idG4tZGFuZ2VyIHsKICAgICAgICAgICAg" +
  "YmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgI2ViMzM0OSAwJSwgI2Y0NWM0MyAx" +
  "MDAlKTsKICAgICAgICAgICAgY29sb3I6IHdoaXRlOwogICAgICAgIH0KICAgICAgICAKICAgICAg" +
  "ICAuYnRuLXNlY29uZGFyeSB7CiAgICAgICAgICAgIGJhY2tncm91bmQ6ICM2Yzc1N2Q7CiAgICAg" +
  "ICAgICAgIGNvbG9yOiB3aGl0ZTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmJ0bi1zZWNv" +
  "bmRhcnk6aG92ZXIgewogICAgICAgICAgICBiYWNrZ3JvdW5kOiAjNWE2MjY4OwogICAgICAgIH0K" +
  "ICAgICAgICAKICAgICAgICAvKiDlhazlj7jliJfooajmoLflvI8gKi8KICAgICAgICAuY29tcGFu" +
  "eS1saXN0IHsKICAgICAgICAgICAgbWFyZ2luLXRvcDogMTVweDsKICAgICAgICB9CiAgICAgICAg" +
  "CiAgICAgICAgLmNvbXBhbnktaXRlbSB7CiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmOGY5ZmE7" +
  "CiAgICAgICAgICAgIHBhZGRpbmc6IDEycHg7CiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZw" +
  "eDsKICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogOHB4OwogICAgICAgICAgICBib3JkZXItbGVm" +
  "dDogNHB4IHNvbGlkICM2NjdlZWE7CiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7CiAgICAgICAg" +
  "ICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjsKICAgICAgICAgICAgYWxpZ24taXRl" +
  "bXM6IGNlbnRlcjsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmNvbXBhbnktaW5mbyB7CiAg" +
  "ICAgICAgICAgIGZsZXg6IDE7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5jb21wYW55LW5h" +
  "bWUgewogICAgICAgICAgICBmb250LXdlaWdodDogNjAwOwogICAgICAgICAgICBjb2xvcjogIzMz" +
  "MzsKICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogNHB4OwogICAgICAgICAgICBmb250LXNpemU6" +
  "IDE0cHg7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5jb21wYW55LWFkZHJlc3MgewogICAg" +
  "ICAgICAgICBmb250LXNpemU6IDExcHg7CiAgICAgICAgICAgIGNvbG9yOiAjNjY2OwogICAgICAg" +
  "IH0KICAgICAgICAKICAgICAgICAuY29tcGFueS1hY3Rpb25zIHsKICAgICAgICAgICAgZGlzcGxh" +
  "eTogZmxleDsKICAgICAgICAgICAgZ2FwOiA4cHg7CiAgICAgICAgfQogICAgICAgIAogICAgICAg" +
  "IC5idG4tc21hbGwgewogICAgICAgICAgICBwYWRkaW5nOiA0cHggMTBweDsKICAgICAgICAgICAg" +
  "Ym9yZGVyOiBub25lOwogICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7CiAgICAgICAgICAg" +
  "IGZvbnQtc2l6ZTogMTFweDsKICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyOwogICAgICAgIH0K" +
  "ICAgICAgICAKICAgICAgICAuYnRuLWRlbGV0ZSB7CiAgICAgICAgICAgIGJhY2tncm91bmQ6ICNm" +
  "ZjZiNmI7CiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTsKICAgICAgICB9CiAgICAgICAgCiAgICAg" +
  "ICAgLyog5om56YeP5a+85YWl5Yy65Z+fICovCiAgICAgICAgLmJhdGNoLWltcG9ydCB7CiAgICAg" +
  "ICAgICAgIGJhY2tncm91bmQ6ICNmMGYwZjA7CiAgICAgICAgICAgIHBhZGRpbmc6IDEycHg7CiAg" +
  "ICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDsKICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTog" +
  "MTVweDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmJhdGNoLWltcG9ydCB0ZXh0YXJlYSB7" +
  "CiAgICAgICAgICAgIHdpZHRoOiAxMDAlOwogICAgICAgICAgICBoZWlnaHQ6IDgwcHg7CiAgICAg" +
  "ICAgICAgIHBhZGRpbmc6IDhweDsKICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgI2RkZDsK" +
  "ICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4OwogICAgICAgICAgICBmb250LXNpemU6IDEx" +
  "cHg7CiAgICAgICAgICAgIHJlc2l6ZTogdmVydGljYWw7CiAgICAgICAgICAgIGZvbnQtZmFtaWx5" +
  "OiBtb25vc3BhY2U7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8qIOWcsOWbvuWMuuWfn+ag" +
  "t+W8jyAqLwogICAgICAgIC5tYXAtYXJlYSB7CiAgICAgICAgICAgIGZsZXg6IDE7CiAgICAgICAg" +
  "ICAgIHBvc2l0aW9uOiByZWxhdGl2ZTsKICAgICAgICAgICAgYmFja2dyb3VuZDogI2Y1ZjVmNTsK" +
  "ICAgICAgICB9CiAgICAgICAgCiAgICAgICAgI2NvbnRhaW5lciB7CiAgICAgICAgICAgIHdpZHRo" +
  "OiAxMDAlOwogICAgICAgICAgICBoZWlnaHQ6IDEwMCU7CiAgICAgICAgfQogICAgICAgIAogICAg" +
  "ICAgIC8qIOe7k+aenOWMuuWfn+agt+W8jyAqLwogICAgICAgIC5yZXN1bHQtcGFuZWwgewogICAg" +
  "ICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7CiAgICAgICAgICAgIGJvdHRvbTogMjBweDsKICAg" +
  "ICAgICAgICAgcmlnaHQ6IDIwcHg7CiAgICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlOwogICAg" +
  "ICAgICAgICBwYWRkaW5nOiAxNXB4OwogICAgICAgICAgICBib3JkZXItcmFkaXVzOiAxMHB4Owog" +
  "ICAgICAgICAgICBib3gtc2hhZG93OiAwIDhweCAzMnB4IHJnYmEoMCwwLDAsMC4yKTsKICAgICAg" +
  "ICAgICAgbWF4LXdpZHRoOiAzNTBweDsKICAgICAgICAgICAgbWF4LWhlaWdodDogNDAwcHg7CiAg" +
  "ICAgICAgICAgIG92ZXJmbG93LXk6IGF1dG87CiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7CiAg" +
  "ICAgICAgICAgIHotaW5kZXg6IDIwMDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLnJlc3Vs" +
  "dC1wYW5lbC5zaG93IHsKICAgICAgICAgICAgZGlzcGxheTogYmxvY2s7CiAgICAgICAgICAgIGFu" +
  "aW1hdGlvbjogc2xpZGVVcCAwLjRzIGVhc2Utb3V0OwogICAgICAgIH0KICAgICAgICAKICAgICAg" +
  "ICBAa2V5ZnJhbWVzIHNsaWRlVXAgewogICAgICAgICAgICBmcm9tIHsKICAgICAgICAgICAgICAg" +
  "IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgxNXB4KTsKICAgICAgICAgICAgICAgIG9wYWNpdHk6IDA7" +
  "CiAgICAgICAgICAgIH0KICAgICAgICAgICAgdG8gewogICAgICAgICAgICAgICAgdHJhbnNmb3Jt" +
  "OiB0cmFuc2xhdGVZKDApOwogICAgICAgICAgICAgICAgb3BhY2l0eTogMTsKICAgICAgICAgICAg" +
  "fQogICAgICAgIH0KICAgICAgICAKICAgICAgICAucmVzdWx0LWhlYWRlciB7CiAgICAgICAgICAg" +
  "IGZvbnQtc2l6ZTogMTZweDsKICAgICAgICAgICAgZm9udC13ZWlnaHQ6IDYwMDsKICAgICAgICAg" +
  "ICAgbWFyZ2luLWJvdHRvbTogMTJweDsKICAgICAgICAgICAgY29sb3I6ICMzMzM7CiAgICAgICAg" +
  "fQogICAgICAgIAogICAgICAgIC5yZXN1bHQtc3RhdHMgewogICAgICAgICAgICBkaXNwbGF5OiBn" +
  "cmlkOwogICAgICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IDFmciAxZnI7CiAgICAgICAg" +
  "ICAgIGdhcDogOHB4OwogICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxMnB4OwogICAgICAgIH0K" +
  "ICAgICAgICAKICAgICAgICAuc3RhdC1pdGVtIHsKICAgICAgICAgICAgYmFja2dyb3VuZDogI2Y4" +
  "ZjlmYTsKICAgICAgICAgICAgcGFkZGluZzogOHB4OwogICAgICAgICAgICBib3JkZXItcmFkaXVz" +
  "OiA2cHg7CiAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjsKICAgICAgICB9CiAgICAgICAg" +
  "CiAgICAgICAgLnN0YXQtdmFsdWUgewogICAgICAgICAgICBmb250LXNpemU6IDIwcHg7CiAgICAg" +
  "ICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7CiAgICAgICAgICAgIGNvbG9yOiAjNjY3ZWVhOwogICAg" +
  "ICAgIH0KICAgICAgICAKICAgICAgICAuc3RhdC1sYWJlbCB7CiAgICAgICAgICAgIGZvbnQtc2l6" +
  "ZTogMTFweDsKICAgICAgICAgICAgY29sb3I6ICM2NjY7CiAgICAgICAgICAgIG1hcmdpbi10b3A6" +
  "IDNweDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLnJvdXRlLWxpc3QgewogICAgICAgICAg" +
  "ICBsaXN0LXN0eWxlOiBub25lOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAucm91dGUtaXRl" +
  "bSB7CiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7CiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBj" +
  "ZW50ZXI7CiAgICAgICAgICAgIHBhZGRpbmc6IDhweCAwOwogICAgICAgICAgICBib3JkZXItYm90" +
  "dG9tOiAxcHggc29saWQgI2VlZTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLnJvdXRlLW51" +
  "bWJlciB7CiAgICAgICAgICAgIHdpZHRoOiAyNHB4OwogICAgICAgICAgICBoZWlnaHQ6IDI0cHg7" +
  "CiAgICAgICAgICAgIGJhY2tncm91bmQ6ICM2NjdlZWE7CiAgICAgICAgICAgIGNvbG9yOiB3aGl0" +
  "ZTsKICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlOwogICAgICAgICAgICBkaXNwbGF5OiBm" +
  "bGV4OwogICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyOwogICAgICAgICAgICBqdXN0aWZ5" +
  "LWNvbnRlbnQ6IGNlbnRlcjsKICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7CiAgICAgICAg" +
  "ICAgIG1hcmdpbi1yaWdodDogMTBweDsKICAgICAgICAgICAgZmxleC1zaHJpbms6IDA7CiAgICAg" +
  "ICAgICAgIGZvbnQtc2l6ZTogMTFweDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLnJvdXRl" +
  "LWluZm8gewogICAgICAgICAgICBmbGV4OiAxOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAu" +
  "cm91dGUtbmFtZSB7CiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7CiAgICAgICAgICAgIGNv" +
  "bG9yOiAjMzMzOwogICAgICAgICAgICBmb250LXNpemU6IDEzcHg7CiAgICAgICAgfQogICAgICAg" +
  "IAogICAgICAgIC5yb3V0ZS1hZGRyZXNzIHsKICAgICAgICAgICAgZm9udC1zaXplOiAxMXB4Owog" +
  "ICAgICAgICAgICBjb2xvcjogIzY2NjsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLnRvYXN0" +
  "IHsKICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkOwogICAgICAgICAgICB0b3A6IDIwcHg7CiAg" +
  "ICAgICAgICAgIHJpZ2h0OiAyMHB4OwogICAgICAgICAgICBiYWNrZ3JvdW5kOiAjMzMzOwogICAg" +
  "ICAgICAgICBjb2xvcjogd2hpdGU7CiAgICAgICAgICAgIHBhZGRpbmc6IDEycHggMjBweDsKICAg" +
  "ICAgICAgICAgYm9yZGVyLXJhZGl1czogNnB4OwogICAgICAgICAgICBib3gtc2hhZG93OiAwIDRw" +
  "eCAxMnB4IHJnYmEoMCwwLDAsMC4zKTsKICAgICAgICAgICAgei1pbmRleDogMTAwMDsKICAgICAg" +
  "ICAgICAgYW5pbWF0aW9uOiBzbGlkZUluIDAuM3MgZWFzZS1vdXQ7CiAgICAgICAgICAgIGZvbnQt" +
  "c2l6ZTogMTNweDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLnRvYXN0LmVycm9yIHsKICAg" +
  "ICAgICAgICAgYmFja2dyb3VuZDogI2VmNDQ0NDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAg" +
  "LnRvYXN0LnN1Y2Nlc3MgewogICAgICAgICAgICBiYWNrZ3JvdW5kOiAjMTBiOTgxOwogICAgICAg" +
  "IH0KICAgICAgICAKICAgICAgICBAa2V5ZnJhbWVzIHNsaWRlSW4gewogICAgICAgICAgICBmcm9t" +
  "IHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgxMDAlKTsKICAgICAgICAg" +
  "ICAgICAgIG9wYWNpdHk6IDA7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgdG8gewogICAgICAg" +
  "ICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApOwogICAgICAgICAgICAgICAgb3BhY2l0" +
  "eTogMTsKICAgICAgICAgICAgfQogICAgICAgIH0KICAgICAgICAKICAgICAgICAubG9hZGluZyB7" +
  "CiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDsKICAgICAgICAgICAgdG9wOiA1MCU7CiAgICAg" +
  "ICAgICAgIGxlZnQ6IDUwJTsKICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwg" +
  "LTUwJSk7CiAgICAgICAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsMC44KTsKICAgICAgICAg" +
  "ICAgY29sb3I6IHdoaXRlOwogICAgICAgICAgICBwYWRkaW5nOiAxNXB4IDMwcHg7CiAgICAgICAg" +
  "ICAgIGJvcmRlci1yYWRpdXM6IDhweDsKICAgICAgICAgICAgei1pbmRleDogMTAwMDsKICAgICAg" +
  "ICAgICAgZGlzcGxheTogbm9uZTsKICAgICAgICAgICAgZm9udC1zaXplOiAxNHB4OwogICAgICAg" +
  "IH0KICAgICAgICAKICAgICAgICAubG9hZGluZy5zaG93IHsKICAgICAgICAgICAgZGlzcGxheTog" +
  "YmxvY2s7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5sb2FkaW5nOjphZnRlciB7CiAgICAg" +
  "ICAgICAgIGNvbnRlbnQ6ICcnOwogICAgICAgICAgICBkaXNwbGF5OiBibG9jazsKICAgICAgICAg" +
  "ICAgd2lkdGg6IDIwcHg7CiAgICAgICAgICAgIGhlaWdodDogMjBweDsKICAgICAgICAgICAgYm9y" +
  "ZGVyOiAycHggc29saWQgI2ZmZjsKICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogNTAlOwogICAg" +
  "ICAgICAgICBib3JkZXItdG9wLWNvbG9yOiB0cmFuc3BhcmVudDsKICAgICAgICAgICAgbWFyZ2lu" +
  "OiA4cHggYXV0byAwOwogICAgICAgICAgICBhbmltYXRpb246IHNwaW4gMC44cyBsaW5lYXIgaW5m" +
  "aW5pdGU7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIEBrZXlmcmFtZXMgc3BpbiB7CiAgICAg" +
  "ICAgICAgIHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTsgfQogICAgICAgIH0KICAgICAg" +
  "ICAKICAgICAgICAvKiDosIPor5Xml6Xlv5fmoLflvI8gKi8KICAgICAgICAuZGVidWctbG9nIHsK" +
  "ICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkOwogICAgICAgICAgICBib3R0b206IDIwcHg7CiAg" +
  "ICAgICAgICAgIGxlZnQ6IDIwcHg7CiAgICAgICAgICAgIHdpZHRoOiAzNTBweDsKICAgICAgICAg" +
  "ICAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjg1KTsKICAgICAgICAgICAgY29sb3I6ICMw" +
  "MGZmMDA7CiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAnQ291cmllciBOZXcnLCBtb25vc3BhY2U7" +
  "CiAgICAgICAgICAgIGZvbnQtc2l6ZTogMTFweDsKICAgICAgICAgICAgYm9yZGVyLXJhZGl1czog" +
  "NnB4OwogICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuOwogICAgICAgICAgICB6LWluZGV4OiA5" +
  "OTk5OwogICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjMzMzOwogICAgICAgICAgICB0cmFu" +
  "c2l0aW9uOiBhbGwgMC4zcyBlYXNlOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvKiDmlLbo" +
  "tbfnirbmgIEgKi8KICAgICAgICAuZGVidWctbG9nLmNvbGxhcHNlZCB7CiAgICAgICAgICAgIG1h" +
  "eC1oZWlnaHQ6IDMycHg7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8qIOWxleW8gOeKtuaA" +
  "gSAqLwogICAgICAgIC5kZWJ1Zy1sb2cuZXhwYW5kZWQgewogICAgICAgICAgICBtYXgtaGVpZ2h0" +
  "OiAzMDBweDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmRlYnVnLWxvZy1oZWFkZXIgewog" +
  "ICAgICAgICAgICBiYWNrZ3JvdW5kOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSk7CiAgICAgICAg" +
  "ICAgIHBhZGRpbmc6IDhweCAxMnB4OwogICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7CiAgICAg" +
  "ICAgICAgIGRpc3BsYXk6IGZsZXg7CiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2Ut" +
  "YmV0d2VlbjsKICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjsKICAgICAgICAgICAgYm9y" +
  "ZGVyLWJvdHRvbTogMXB4IHNvbGlkICMzMzM7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5k" +
  "ZWJ1Zy1sb2ctaGVhZGVyOmhvdmVyIHsKICAgICAgICAgICAgYmFja2dyb3VuZDogcmdiYSgyNTUs" +
  "IDI1NSwgMjU1LCAwLjE1KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmRlYnVnLWxvZy10" +
  "aXRsZSB7CiAgICAgICAgICAgIGNvbG9yOiAjZmZmOwogICAgICAgICAgICBmb250LXdlaWdodDog" +
  "Ym9sZDsKICAgICAgICAgICAgZm9udC1zaXplOiAxMnB4OwogICAgICAgIH0KICAgICAgICAKICAg" +
  "ICAgICAuZGVidWctbG9nLXRvZ2dsZSB7CiAgICAgICAgICAgIGNvbG9yOiAjODg4OwogICAgICAg" +
  "ICAgICBmb250LXNpemU6IDE2cHg7CiAgICAgICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybSAw" +
  "LjNzIGVhc2U7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5kZWJ1Zy1sb2cuZXhwYW5kZWQg" +
  "LmRlYnVnLWxvZy10b2dnbGUgewogICAgICAgICAgICB0cmFuc2Zvcm06IHJvdGF0ZSgxODBkZWcp" +
  "OwogICAgICAgIH0KICAgICAgICAKICAgICAgICAuZGVidWctbG9nLWNvbnRlbnQgewogICAgICAg" +
  "ICAgICBwYWRkaW5nOiAxMnB4OwogICAgICAgICAgICBtYXgtaGVpZ2h0OiAyNTBweDsKICAgICAg" +
  "ICAgICAgb3ZlcmZsb3cteTogYXV0bzsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmRlYnVn" +
  "LWxvZy5jb2xsYXBzZWQgLmRlYnVnLWxvZy1jb250ZW50IHsKICAgICAgICAgICAgZGlzcGxheTog" +
  "bm9uZTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmRlYnVnLWxvZyAubG9nLWVudHJ5IHsK" +
  "ICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogNHB4OwogICAgICAgICAgICBsaW5lLWhlaWdodDog" +
  "MS40OwogICAgICAgIH0KICAgICAgICAKICAgICAgICAuZGVidWctbG9nIC5sb2ctdGltZSB7CiAg" +
  "ICAgICAgICAgIGNvbG9yOiAjODg4OwogICAgICAgICAgICBtYXJnaW4tcmlnaHQ6IDVweDsKICAg" +
  "ICAgICB9CiAgICAgICAgCiAgICAgICAgLmRlYnVnLWxvZyAubG9nLXN1Y2Nlc3MgewogICAgICAg" +
  "ICAgICBjb2xvcjogIzAwZmYwMDsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLmRlYnVnLWxv" +
  "ZyAubG9nLWVycm9yIHsKICAgICAgICAgICAgY29sb3I6ICNmZjQ0NDQ7CiAgICAgICAgfQogICAg" +
  "ICAgIAogICAgICAgIC5kZWJ1Zy1sb2cgLmxvZy1pbmZvIHsKICAgICAgICAgICAgY29sb3I6ICMw" +
  "MGJmZmY7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC5kZWJ1Zy1sb2cgLmxvZy13YXJuaW5n" +
  "IHsKICAgICAgICAgICAgY29sb3I6ICNmZmFhMDA7CiAgICAgICAgfQogICAgICAgIAogICAgICAg" +
  "IC8qIOWTjeW6lOW8j+iuvuiuoSAqLwogICAgICAgIEBtZWRpYSAobWF4LXdpZHRoOiA3NjhweCkg" +
  "ewogICAgICAgICAgICAuY29udGFpbmVyIHsKICAgICAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9u" +
  "OiBjb2x1bW47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAgIC5zaWRlYmFy" +
  "IHsKICAgICAgICAgICAgICAgIHdpZHRoOiAxMDAlOwogICAgICAgICAgICAgICAgaGVpZ2h0OiA1" +
  "MHZoOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICAubWFwLWFyZWEgewog" +
  "ICAgICAgICAgICAgICAgaGVpZ2h0OiA1MHZoOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICAucmVzdWx0LXBhbmVsIHsKICAgICAgICAgICAgICAgIG1heC13aWR0aDogY2Fs" +
  "YygxMDAlIC0gNDBweCk7CiAgICAgICAgICAgICAgICBib3R0b206IDEwcHg7CiAgICAgICAgICAg" +
  "ICAgICByaWdodDogMjBweDsKICAgICAgICAgICAgICAgIGxlZnQ6IDIwcHg7CiAgICAgICAgICAg" +
  "IH0KICAgICAgICB9CiAgICA8L3N0eWxlPgo8L2hlYWQ+Cjxib2R5PgogICAgPGRpdiBjbGFzcz0i" +
  "Y29udGFpbmVyIj4KICAgICAgICA8IS0tIOW3puS+p+mdouadvyAtLT4KICAgICAgICA8ZGl2IGNs" +
  "YXNzPSJzaWRlYmFyIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGVhZGVyIj4KICAgICAgICAg" +
  "ICAgICAgIDxoMT7wn5e677iPIOmhuui3r+inhOWIkuezu+e7nyAxLjA8L2gxPgogICAgICAgICAg" +
  "ICA8L2Rpdj4KICAgICAgICAgICAgCiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNvbnRlbnQiPgog" +
  "ICAgICAgICAgICAgICAgPCEtLSDmibnph4/lr7zlhaUgLS0+CiAgICAgICAgICAgICAgICA8ZGl2" +
  "IGNsYXNzPSJiYXRjaC1pbXBvcnQiPgogICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT0i" +
  "Zm9udC13ZWlnaHQ6IDcwMDsgY29sb3I6ICMzMzM7IG1hcmdpbi1ib3R0b206IDhweDsgZGlzcGxh" +
  "eTogYmxvY2s7IGZvbnQtc2l6ZTogMTRweDsiPgogICAgICAgICAgICAgICAgICAgICAgICDwn5Ol" +
  "IOaJuemHj+WvvOWFpe+8iOWFrOWPuOWQjeWtl+WSjOWcsOWdgO+8iQogICAgICAgICAgICAgICAg" +
  "ICAgIDwvbGFiZWw+CiAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhIGlkPSJiYXRjaEltcG9y" +
  "dCIgcGxhY2Vob2xkZXI9IuW+rui9r+enkeaKgCzljJfkuqzluILmtbfmt4DljLrkuK3lhbPmnZEm" +
  "IzEwO+mYv+mHjOW3tOW3tCzljJfkuqzluILmnJ3pmLPljLrmnJvkuqwmIzEwO++8iOaUr+aMgSAs" +
  "IHwgOyBUYWIg5YiG6ZqU77yJIj48L3RleHRhcmVhPgogICAgICAgICAgICAgICAgICAgIDxidXR0" +
  "b24gY2xhc3M9ImJ0biBidG4tc3VjY2VzcyIgb25jbGljaz0ic2hvd0JhdGNoSW1wb3J0TW9kYWwo" +
  "KSIgc3R5bGU9Im1hcmdpbi10b3A6IDhweDsiPuW8gOWni+aZuuiDveWvvOWFpTwvYnV0dG9uPgog" +
  "ICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIDwh" +
  "LS0g5Y2V5p2h5re75YqgIC0tPgogICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iYm9yZGVyLXRv" +
  "cDogMXB4IGRhc2hlZCAjZGRkOyBwYWRkaW5nLXRvcDogMTVweDsgbWFyZ2luLXRvcDogMTVweDsi" +
  "PgogICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT0iZm9udC13ZWlnaHQ6IDYwMDsgY29s" +
  "b3I6ICM2NjY7IG1hcmdpbi1ib3R0b206IDhweDsgZGlzcGxheTogYmxvY2s7IGZvbnQtc2l6ZTog" +
  "MTFweDsiPgogICAgICAgICAgICAgICAgICAgICAgICDinpUg5Y2V5p2h5re75Yqg77yI5ZCM5ZCN" +
  "5bCG6KaG55uW5pu05paw77yJCiAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD4KICAgICAgICAg" +
  "ICAgICAgICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OiBmbGV4OyBnYXA6IDhweDsgbWFyZ2luLWJv" +
  "dHRvbTogOHB4OyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPSJ0ZXh0IiBp" +
  "ZD0icXVpY2tDb21wYW55TmFtZSIgcGxhY2Vob2xkZXI9IuWFrOWPuOWQjSIgc3R5bGU9ImZsZXg6" +
  "IDE7IHBhZGRpbmc6IDhweDsgYm9yZGVyOiAxcHggc29saWQgI2RkZDsgYm9yZGVyLXJhZGl1czog" +
  "NHB4OyBmb250LXNpemU6IDEycHg7Ij4KICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAg" +
  "ICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OiBmbGV4OyBnYXA6IDhweDsiPgogICAg" +
  "ICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT0idGV4dCIgaWQ9InF1aWNrQ29tcGFueUFk" +
  "ZHJlc3MiIHBsYWNlaG9sZGVyPSLlnLDlnYAiIHN0eWxlPSJmbGV4OiAxOyBwYWRkaW5nOiA4cHg7" +
  "IGJvcmRlcjogMXB4IHNvbGlkICNkZGQ7IGJvcmRlci1yYWRpdXM6IDRweDsgZm9udC1zaXplOiAx" +
  "MnB4OyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0icXVpY2tBZGRD" +
  "b21wYW55KCkiIHN0eWxlPSJwYWRkaW5nOiA4cHggMTZweDsgYmFja2dyb3VuZDogIzY2N2VlYTsg" +
  "Y29sb3I6IHdoaXRlOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDRweDsgZm9udC1zaXpl" +
  "OiAxMnB4OyBjdXJzb3I6IHBvaW50ZXI7Ij7mt7vliqA8L2J1dHRvbj4KICAgICAgICAgICAgICAg" +
  "ICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgICAgICA8IS0tIOWFrOWPuOWIl+ihqCAtLT4KICAgICAgICAgICAgICAgIDxkaXYgY2xh" +
  "c3M9ImNvbXBhbnktbGlzdCIgaWQ9ImNvbXBhbnlMaXN0Ij4KICAgICAgICAgICAgICAgICAgICA8" +
  "cCBzdHlsZT0iY29sb3I6ICM5OTk7IHRleHQtYWxpZ246IGNlbnRlcjsgcGFkZGluZzogMTVweDsg" +
  "Zm9udC1zaXplOiAxMnB4OyI+5pqC5peg5YWs5Y+45L+h5oGv77yM6K+35re75Yqg5oiW5a+85YWl" +
  "PC9wPgogICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
  "ICAgIDwhLS0g6KeE5YiS6Lev57q/5oyJ6ZKuIC0tPgogICAgICAgICAgICAgICAgPGJ1dHRvbiBj" +
  "bGFzcz0iYnRuIGJ0bi1zdWNjZXNzIiBvbmNsaWNrPSJwbGFuUm91dGUoKSIgc3R5bGU9Im1hcmdp" +
  "bi10b3A6IDE1cHg7IGZvbnQtc2l6ZTogMTZweDsiPgogICAgICAgICAgICAgICAgICAgIPCfmoAg" +
  "6KeE5YiS5pyA5LyY6Lev57q/CiAgICAgICAgICAgICAgICA8L2J1dHRvbj4KICAgICAgICAgICAg" +
  "ICAgIAogICAgICAgICAgICAgICAgPCEtLSDmuIXnqbrmjInpkq4gLS0+CiAgICAgICAgICAgICAg" +
  "ICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLWRhbmdlciIgb25jbGljaz0iY2xlYXJBbGwoKSIgc3R5" +
  "bGU9Im1hcmdpbi10b3A6IDhweDsiPgogICAgICAgICAgICAgICAgICAgIPCfl5HvuI8g5riF56m6" +
  "5omA5pyJ5pWw5o2uCiAgICAgICAgICAgICAgICA8L2J1dHRvbj4KICAgICAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICAgICAgPCEtLSDosIPor5Xml6Xlv5fvvIjnp7vliLDlupXpg6jvvIkgLS0+CiAg" +
  "ICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOiAyMHB4OyBib3JkZXItdG9wOiAx" +
  "cHggc29saWQgI2VlZTsgcGFkZGluZy10b3A6IDEwcHg7Ij4KICAgICAgICAgICAgICAgICAgICA8" +
  "ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiAjMWExYTJlOyBib3JkZXItcmFkaXVzOiA2cHg7IG92ZXJm" +
  "bG93OiBoaWRkZW47Ij4KICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0icGFkZGlu" +
  "ZzogOHB4IDEycHg7IGJhY2tncm91bmQ6ICMxNjIxM2U7IGNvbG9yOiAjZmZmOyBmb250LXNpemU6" +
  "IDEycHg7IGN1cnNvcjogcG9pbnRlcjsiIG9uY2xpY2s9InRvZ2dsZUJvdHRvbUxvZygpIj4KICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPvCflI0g6LCD6K+V5pel5b+XPC9zcGFuPgog" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gaWQ9ImJvdHRvbUxvZ1RvZ2dsZSIgc3R5" +
  "bGU9ImZsb2F0OiByaWdodDsiPuKWvDwvc3Bhbj4KICAgICAgICAgICAgICAgICAgICAgICAgPC9k" +
  "aXY+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9ImJvdHRvbUxvZ0NvbnRlbnQiIHN0" +
  "eWxlPSJwYWRkaW5nOiAxMHB4OyBtYXgtaGVpZ2h0OiAxNTBweDsgb3ZlcmZsb3cteTogYXV0bzsg" +
  "Zm9udC1mYW1pbHk6IG1vbm9zcGFjZTsgZm9udC1zaXplOiAxMXB4OyBjb2xvcjogIzAwZmYwMDsg" +
  "ZGlzcGxheTogYmxvY2s7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwhLS0g5pel5b+X" +
  "5YaF5a65IC0tPgogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAg" +
  "ICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8L2Rpdj4KICAg" +
  "ICAgICA8L2Rpdj4KICAgICAgICAKICAgICAgICA8IS0tIOWcsOWbvuWMuuWfnyAtLT4KICAgICAg" +
  "ICA8ZGl2IGNsYXNzPSJtYXAtYXJlYSI+CiAgICAgICAgICAgIDxkaXYgaWQ9ImNvbnRhaW5lciI+" +
  "PC9kaXY+CiAgICAgICAgICAgIAogICAgICAgICAgICA8IS0tIOe7k+aenOmdouadvyAtLT4KICAg" +
  "ICAgICAgICAgPGRpdiBjbGFzcz0icmVzdWx0LXBhbmVsIiBpZD0icmVzdWx0UGFuZWwiPgogICAg" +
  "ICAgICAgICAgICAgPGRpdiBjbGFzcz0icmVzdWx0LWhlYWRlciI+8J+TiiDot6/nur/op4TliJLn" +
  "u5Pmnpw8L2Rpdj4KICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9InJlc3VsdC1zdGF0cyI+CiAg" +
  "ICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdC1pdGVtIj4KICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdC12YWx1ZSIgaWQ9InRvdGFsRGlzdGFuY2UiPjA8L2Rp" +
  "dj4KICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdC1sYWJlbCI+5oC76YeM" +
  "56iLKGttKTwvZGl2PgogICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAg" +
  "ICAgIDxkaXYgY2xhc3M9InN0YXQtaXRlbSI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYg" +
  "Y2xhc3M9InN0YXQtdmFsdWUiIGlkPSJ0b3RhbFRpbWUiPjA8L2Rpdj4KICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdC1sYWJlbCI+6aKE6K6h5pe26Ze0KOWIhumSnyk8L2Rp" +
  "dj4KICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgIDwvZGl2PgogICAg" +
  "ICAgICAgICAgICAgPGRpdiBjbGFzcz0icmVzdWx0LWhlYWRlciIgc3R5bGU9ImZvbnQtc2l6ZTog" +
  "MTJweDsgbWFyZ2luLWJvdHRvbTogOHB4OyI+5ouc6K6/6aG65bqPPC9kaXY+CiAgICAgICAgICAg" +
  "ICAgICA8dWwgY2xhc3M9InJvdXRlLWxpc3QiIGlkPSJyb3V0ZUxpc3QiPgogICAgICAgICAgICAg" +
  "ICAgICAgIDwhLS0g6Lev57q/5YiX6KGo5bCG6YCa6L+HSlPliqjmgIHnlJ/miJAgLS0+CiAgICAg" +
  "ICAgICAgICAgICA8L3VsPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgIDwv" +
  "ZGl2PgogICAgCiAgICA8IS0tIOaJuemHj+WvvOWFpeaooeaAgeahhiAtLT4KICAgIDxkaXYgY2xh" +
  "c3M9Im1vZGFsIiBpZD0iYmF0Y2hNb2RhbCIgc3R5bGU9InBvc2l0aW9uOiBmaXhlZDsgdG9wOiAw" +
  "OyBsZWZ0OiAwOyByaWdodDogMDsgYm90dG9tOiAwOyBiYWNrZ3JvdW5kOiByZ2JhKDAsMCwwLDAu" +
  "NSk7IGRpc3BsYXk6IG5vbmU7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDog" +
  "Y2VudGVyOyB6LWluZGV4OiAxMDAwOyI+CiAgICAgICAgPGRpdiBjbGFzcz0ibW9kYWwtY29udGVu" +
  "dCIgc3R5bGU9ImJhY2tncm91bmQ6IHdoaXRlOyBib3JkZXItcmFkaXVzOiAxMHB4OyB3aWR0aDog" +
  "OTAlOyBtYXgtd2lkdGg6IDYwMHB4OyBtYXgtaGVpZ2h0OiA4MHZoOyBvdmVyZmxvdzogaGlkZGVu" +
  "OyBkaXNwbGF5OiBmbGV4OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyI+CiAgICAgICAgICAgIDxk" +
  "aXYgY2xhc3M9Im1vZGFsLWhlYWRlciIgc3R5bGU9InBhZGRpbmc6IDE1cHggMjBweDsgYmFja2dy" +
  "b3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzY2N2VlYSAwJSwgIzc2NGJhMiAxMDAlKTsg" +
  "Y29sb3I6IHdoaXRlOyBkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdl" +
  "ZW47IGFsaWduLWl0ZW1zOiBjZW50ZXI7Ij4KICAgICAgICAgICAgICAgIDxoMyBzdHlsZT0ibWFy" +
  "Z2luOiAwOyBmb250LXNpemU6IDE4cHg7Ij7wn5OlIOaJuemHj+aZuuiDveWvvOWFpTwvaDM+CiAg" +
  "ICAgICAgICAgICAgICA8YnV0dG9uIG9uY2xpY2s9ImNsb3NlQmF0Y2hNb2RhbCgpIiBzdHlsZT0i" +
  "YmFja2dyb3VuZDogcmdiYSgyNTUsMjU1LDI1NSwwLjIpOyBib3JkZXI6IG5vbmU7IGNvbG9yOiB3" +
  "aGl0ZTsgd2lkdGg6IDMwcHg7IGhlaWdodDogMzBweDsgYm9yZGVyLXJhZGl1czogNTAlOyBjdXJz" +
  "b3I6IHBvaW50ZXI7IGZvbnQtc2l6ZTogMThweDsiPsOXPC9idXR0b24+CiAgICAgICAgICAgIDwv" +
  "ZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJtb2RhbC1ib2R5IiBzdHlsZT0icGFkZGluZzog" +
  "MjBweDsgZmxleDogMTsgb3ZlcmZsb3cteTogYXV0bzsiPgogICAgICAgICAgICAgICAgPGRpdiBz" +
  "dHlsZT0iYmFja2dyb3VuZDogI2Y4ZjlmYTsgbWFyZ2luLWJvdHRvbTogMTVweDsiPgogICAgICAg" +
  "ICAgICAgICAgICAgIDx0ZXh0YXJlYSBpZD0iYmF0Y2hJbXBvcnRNb2RhbCIgc3R5bGU9IndpZHRo" +
  "OiAxMDAlOyBoZWlnaHQ6IDEyMHB4OyBwYWRkaW5nOiAxMHB4OyBib3JkZXI6IDFweCBzb2xpZCAj" +
  "ZGRkOyBib3JkZXItcmFkaXVzOiA0cHg7IGZvbnQtc2l6ZTogMTNweDsgZm9udC1mYW1pbHk6IG1v" +
  "bm9zcGFjZTsgcmVzaXplOiB2ZXJ0aWNhbDsiIHBsYWNlaG9sZGVyPSLnpLrkvos6JiMxMDvohb7o" +
  "rq/np5HmioAs5YyX5Lqs5biC5rW35reA5Yy65Lit5YWz5p2RJiMxMDvpmL/ph4zlt7Tlt7Qs5YyX" +
  "5Lqs5biC5pyd6Ziz5Yy65pyb5LqsJiMxMDvnmb7luqbnp5HmioAs5YyX5Lqs5biC5rW35reA5Yy6" +
  "5LiK5ZywIj48L3RleHRhcmVhPgogICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAg" +
  "ICAKICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6ICNmZmYzY2Q7IGJvcmRl" +
  "cjogMXB4IHNvbGlkICNmZmMxMDc7IGJvcmRlci1yYWRpdXM6IDZweDsgcGFkZGluZzogMTBweDsg" +
  "bWFyZ2luLXRvcDogMTBweDsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzg1NjQwNDsiPgogICAg" +
  "ICAgICAgICAgICAgICAgIPCfkqEg5o+Q56S677ya57O757uf5bCG6Ieq5Yqo5pCc57Si5q+P5Liq" +
  "5Zyw5Z2A5bm26I635Y+W57K+56Gu5Z2Q5qCH77yM6K+36ICQ5b+D562J5b6F5aSE55CG5a6M5oiQ" +
  "CiAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAg" +
  "PGRpdiBzdHlsZT0ibWFyZ2luLXRvcDogMTVweDsgZGlzcGxheTogZmxleDsgZ2FwOiAxMHB4OyI+" +
  "CiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1zdWNjZXNzIiBvbmNs" +
  "aWNrPSJwcm9jZXNzQmF0Y2hJbXBvcnQoKSI+5byA5aeL5aSE55CGPC9idXR0b24+CiAgICAgICAg" +
  "ICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1zZWNvbmRhcnkiIG9uY2xpY2s9ImNs" +
  "b3NlQmF0Y2hNb2RhbCgpIj7lj5bmtog8L2J1dHRvbj4KICAgICAgICAgICAgICAgIDwvZGl2Pgog" +
  "ICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICA8ZGl2IGlkPSJiYXRjaFByb2dyZXNzIiBz" +
  "dHlsZT0ibWFyZ2luLXRvcDogMTVweDsgZGlzcGxheTogbm9uZTsiPgogICAgICAgICAgICAgICAg" +
  "ICAgIDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6ICNlOWVjZWY7IGJvcmRlci1yYWRpdXM6IDRweDsg" +
  "aGVpZ2h0OiA4cHg7IG92ZXJmbG93OiBoaWRkZW47Ij4KICAgICAgICAgICAgICAgICAgICAgICAg" +
  "PGRpdiBpZD0icHJvZ3Jlc3NCYXIiIHN0eWxlPSJiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQo" +
  "OTBkZWcsICM2NjdlZWEsICM3NjRiYTIpOyBoZWlnaHQ6IDEwMCU7IHdpZHRoOiAwJTsgdHJhbnNp" +
  "dGlvbjogd2lkdGggMC4zczsiPjwvZGl2PgogICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAg" +
  "ICAgICAgICAgICAgICAgIDxwIHN0eWxlPSJ0ZXh0LWFsaWduOiBjZW50ZXI7IG1hcmdpbi10b3A6" +
  "IDhweDsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzY2NjsiIGlkPSJwcm9ncmVzc1RleHQiPuWk" +
  "hOeQhuS4rS4uLjwvcD4KICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8L2Rpdj4K" +
  "ICAgICAgICA8L2Rpdj4KICAgIDwvZGl2PgogICAgCiAgICA8IS0tIOWKoOi9veaPkOekuiAtLT4K" +
  "ICAgIDxkaXYgY2xhc3M9ImxvYWRpbmciIGlkPSJsb2FkaW5nIj7lpITnkIbkuK3vvIzor7fnqI3l" +
  "gJkuLi48L2Rpdj4KCiAgICA8IS0tIOmFjee9ruWuieWFqOWvhumSpSAtLT4KICAgIDxzY3JpcHQ+" +
  "CiAgICAgICAgd2luZG93Ll9BTWFwU2VjdXJpdHlDb25maWcgPSB7CiAgICAgICAgICAgIHNlY3Vy" +
  "aXR5SnNDb2RlOiAnYThhYzVkZjMyNWI5MjE0YjhhYmM3YzJkMjhhZjNjYTYnLAogICAgICAgIH0K" +
  "ICAgIDwvc2NyaXB0PgoKICAgIDwhLS0g5Yqg6L296auY5b635Zyw5Zu+QVBJIC0tPgogICAgPHNj" +
  "cmlwdCBzcmM9Imh0dHBzOi8vd2ViYXBpLmFtYXAuY29tL21hcHM/dj0yLjAma2V5PWJjZTJlNzUx" +
  "Yjg5MmE0YWUxZjIxYWQ0NzA2ZTQ4MTgxJnBsdWdpbj1BTWFwLkRyaXZpbmcsQU1hcC5NYXJrZXIs" +
  "QU1hcC5JbmZvV2luZG93LEFNYXAuUGxhY2VTZWFyY2gsQU1hcC5HZW9jb2RlciI+PC9zY3JpcHQ+" +
  "CgogICAgPHNjcmlwdD4KICAgICAgICAvLyDlhajlsYDlj5jph48KICAgICAgICBsZXQgbWFwID0g" +
  "bnVsbDsKICAgICAgICBsZXQgZHJpdmluZyA9IG51bGw7CiAgICAgICAgbGV0IHBsYWNlU2VhcmNo" +
  "ID0gbnVsbDsKICAgICAgICBsZXQgZ2VvY29kZXIgPSBudWxsOwogICAgICAgIGxldCBjb21wYW5p" +
  "ZXMgPSBbXTsKICAgICAgICBsZXQgb3B0aW1pemVkUm91dGUgPSBbXTsKICAgICAgICBsZXQgbWFy" +
  "a2VycyA9IFtdOwogICAgICAgIGxldCBwZW5kaW5nQ29tcGFuaWVzID0gW107IC8vIOW+heehruiu" +
  "pOeahOWFrOWPuOWIl+ihqAogICAgICAgIAogICAgICAgIC8vIOW+heS/neWtmOeahOS/ruaUue+8" +
  "iOWIoOmZpOWSjOe8lui+ke+8iQogICAgICAgIGxldCBwZW5kaW5nQ2hhbmdlcyA9IHsKICAgICAg" +
  "ICAgICAgZGVsZXRlOiBbXSwgLy8g5b6F5Yig6Zmk55qE5YWs5Y+4SUTliJfooagKICAgICAgICAg" +
  "ICAgZWRpdDogW10gICAgLy8g5b6F57yW6L6R55qE5YWs5Y+45YiX6KGoIHtpZCwgbmV3QWRkcmVz" +
  "cywgbmV3TG5nLCBuZXdMYXR9CiAgICAgICAgfTsKICAgICAgICAKICAgICAgICAvLyDkuLTml7bn" +
  "vJbovpHmoIforrDvvIjnlKjkuo7lnLDlm77miYvliqjpgInngrnvvIkKICAgICAgICBsZXQgdGVt" +
  "cEVkaXRNYXJrZXIgPSBudWxsOwogICAgICAgIAogICAgICAgIC8vIOiwg+ivleaXpeW/l+WKn+iD" +
  "vQogICAgICAgIGZ1bmN0aW9uIGxvZyhtZXNzYWdlLCB0eXBlID0gJ2luZm8nKSB7CiAgICAgICAg" +
  "ICAgIGNvbnN0IGJvdHRvbUxvZ0NvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm90" +
  "dG9tTG9nQ29udGVudCcpOwogICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpOwogICAg" +
  "ICAgICAgICBjb25zdCB0aW1lU3RyID0gbm93LnRvTG9jYWxlVGltZVN0cmluZygnemgtQ04nLCB7" +
  "IGhvdXIxMjogZmFsc2UgfSk7CiAgICAgICAgICAgIAogICAgICAgICAgICBsZXQgY29sb3IgPSAn" +
  "IzAwZmYwMCc7CiAgICAgICAgICAgIGxldCBzeW1ib2wgPSAn4oS577iPJzsKICAgICAgICAgICAg" +
  "c3dpdGNoKHR5cGUpIHsKICAgICAgICAgICAgICAgIGNhc2UgJ3N1Y2Nlc3MnOgogICAgICAgICAg" +
  "ICAgICAgICAgIGNvbG9yID0gJyMwMGZmMDAnOwogICAgICAgICAgICAgICAgICAgIHN5bWJvbCA9" +
  "ICfinIUnOwogICAgICAgICAgICAgICAgICAgIGJyZWFrOwogICAgICAgICAgICAgICAgY2FzZSAn" +
  "ZXJyb3InOgogICAgICAgICAgICAgICAgICAgIGNvbG9yID0gJyNmZjQ0NDQnOwogICAgICAgICAg" +
  "ICAgICAgICAgIHN5bWJvbCA9ICfinYwnOwogICAgICAgICAgICAgICAgICAgIGJyZWFrOwogICAg" +
  "ICAgICAgICAgICAgY2FzZSAnd2FybmluZyc6CiAgICAgICAgICAgICAgICAgICAgY29sb3IgPSAn" +
  "I2ZmYWEwMCc7CiAgICAgICAgICAgICAgICAgICAgc3ltYm9sID0gJ+KaoO+4jyc7CiAgICAgICAg" +
  "ICAgICAgICAgICAgYnJlYWs7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IGlmIChib3R0b21Mb2dDb250ZW50KSB7CiAgICAgICAgICAgICAgICBjb25zdCBlbnRyeSA9IGRv" +
  "Y3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogICAgICAgICAgICAgICAgZW50cnkuc3R5bGUu" +
  "bWFyZ2luQm90dG9tID0gJzRweCc7CiAgICAgICAgICAgICAgICBlbnRyeS5zdHlsZS5saW5lSGVp" +
  "Z2h0ID0gJzEuNCc7CiAgICAgICAgICAgICAgICBlbnRyeS5pbm5lckhUTUwgPSBgPHNwYW4gc3R5" +
  "bGU9ImNvbG9yOiAjODg4OyI+WyR7dGltZVN0cn1dPC9zcGFuPiA8c3BhbiBzdHlsZT0iY29sb3I6" +
  "ICR7Y29sb3J9OyI+JHtzeW1ib2x9ICR7bWVzc2FnZX08L3NwYW4+YDsKICAgICAgICAgICAgICAg" +
  "IGJvdHRvbUxvZ0NvbnRlbnQuYXBwZW5kQ2hpbGQoZW50cnkpOwogICAgICAgICAgICAgICAgYm90" +
  "dG9tTG9nQ29udGVudC5zY3JvbGxUb3AgPSBib3R0b21Mb2dDb250ZW50LnNjcm9sbEhlaWdodDsK" +
  "ICAgICAgICAgICAgfQogICAgICAgICAgICAKICAgICAgICAgICAgLy8g5ZCM5pe26L6T5Ye65Yiw" +
  "5o6n5Yi25Y+wCiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbJHt0aW1lU3RyfV0gJHtzeW1ib2x9" +
  "ICR7bWVzc2FnZX1gKTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5YiH5o2i5bqV6YOo" +
  "5pel5b+X5pi+56S6L+makOiXjwogICAgICAgIGZ1bmN0aW9uIHRvZ2dsZUJvdHRvbUxvZygpIHsK" +
  "ICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdib3R0" +
  "b21Mb2dDb250ZW50Jyk7CiAgICAgICAgICAgIGNvbnN0IHRvZ2dsZSA9IGRvY3VtZW50LmdldEVs" +
  "ZW1lbnRCeUlkKCdib3R0b21Mb2dUb2dnbGUnKTsKICAgICAgICAgICAgaWYgKGNvbnRlbnQuc3R5" +
  "bGUuZGlzcGxheSA9PT0gJ25vbmUnKSB7CiAgICAgICAgICAgICAgICBjb250ZW50LnN0eWxlLmRp" +
  "c3BsYXkgPSAnYmxvY2snOwogICAgICAgICAgICAgICAgdG9nZ2xlLnRleHRDb250ZW50ID0gJ+KW" +
  "vCc7CiAgICAgICAgICAgIH0gZWxzZSB7CiAgICAgICAgICAgICAgICBjb250ZW50LnN0eWxlLmRp" +
  "c3BsYXkgPSAnbm9uZSc7CiAgICAgICAgICAgICAgICB0b2dnbGUudGV4dENvbnRlbnQgPSAn4pa2" +
  "JzsKICAgICAgICAgICAgfQogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDmuIXnqbrml6Xl" +
  "v5cKICAgICAgICBmdW5jdGlvbiBjbGVhckxvZygpIHsKICAgICAgICAgICAgY29uc3QgYm90dG9t" +
  "TG9nQ29udGVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdib3R0b21Mb2dDb250ZW50Jyk7" +
  "CiAgICAgICAgICAgIGlmIChib3R0b21Mb2dDb250ZW50KSB7CiAgICAgICAgICAgICAgICBib3R0" +
  "b21Mb2dDb250ZW50LmlubmVySFRNTCA9ICcnOwogICAgICAgICAgICB9CiAgICAgICAgfQogICAg" +
  "ICAgIAogICAgICAgIC8vIOWIh+aNouiwg+ivleaXpeW/l+eahOWxleW8gC/mlLbotbfnirbmgIEK" +
  "ICAgICAgICBmdW5jdGlvbiB0b2dnbGVEZWJ1Z0xvZygpIHsKICAgICAgICAgICAgY29uc3QgZGVi" +
  "dWdMb2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGVidWdMb2cnKTsKICAgICAgICAgICAg" +
  "aWYgKGRlYnVnTG9nLmNsYXNzTGlzdC5jb250YWlucygnY29sbGFwc2VkJykpIHsKICAgICAgICAg" +
  "ICAgICAgIGRlYnVnTG9nLmNsYXNzTGlzdC5yZW1vdmUoJ2NvbGxhcHNlZCcpOwogICAgICAgICAg" +
  "ICAgICAgZGVidWdMb2cuY2xhc3NMaXN0LmFkZCgnZXhwYW5kZWQnKTsKICAgICAgICAgICAgfSBl" +
  "bHNlIHsKICAgICAgICAgICAgICAgIGRlYnVnTG9nLmNsYXNzTGlzdC5yZW1vdmUoJ2V4cGFuZGVk" +
  "Jyk7CiAgICAgICAgICAgICAgICBkZWJ1Z0xvZy5jbGFzc0xpc3QuYWRkKCdjb2xsYXBzZWQnKTsK" +
  "ICAgICAgICAgICAgfQogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDliJ3lp4vljJblnLDl" +
  "m74KICAgICAgICBmdW5jdGlvbiBpbml0TWFwKCkgewogICAgICAgICAgICBsb2coJ/CfmoAg5byA" +
  "5aeL5Yid5aeL5YyW5Zyw5Zu+Li4uJywgJ2luZm8nKTsKICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IHRyeSB7CiAgICAgICAgICAgICAgICBtYXAgPSBuZXcgQU1hcC5NYXAoJ2NvbnRhaW5lcicsIHsK" +
  "ICAgICAgICAgICAgICAgICAgICB6b29tOiAxMSwKICAgICAgICAgICAgICAgICAgICBjZW50ZXI6" +
  "IFsxMTYuMzk3NDI4LCAzOS45MDkyM10sIC8vIOWMl+S6rOS4reW/gwogICAgICAgICAgICAgICAg" +
  "ICAgIHZpZXdNb2RlOiAnMkQnLAogICAgICAgICAgICAgICAgICAgIHJlc2l6ZUVuYWJsZTogdHJ1" +
  "ZQogICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAgICBsb2coJ+KchSDlnLDlm77liJ3l" +
  "p4vljJbmiJDlip8nLCAnc3VjY2VzcycpOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAg" +
  "ICAvLyDliJ3lp4vljJbpqb7ovabot6/nur/op4TliJLmnI3liqEKICAgICAgICAgICAgICAgIGRy" +
  "aXZpbmcgPSBuZXcgQU1hcC5Ecml2aW5nKHsKICAgICAgICAgICAgICAgICAgICBtYXA6IG1hcCwK" +
  "ICAgICAgICAgICAgICAgICAgICBwYW5lbDogbnVsbCwKICAgICAgICAgICAgICAgICAgICBoaWRl" +
  "TWFya2VyczogdHJ1ZSwKICAgICAgICAgICAgICAgICAgICBzaG93VHJhZmZpYzogZmFsc2UKICAg" +
  "ICAgICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgbG9nKCfinIUg6am+6L2m6KeE5YiS5pyN" +
  "5Yqh5Yid5aeL5YyW5oiQ5YqfJywgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgICAgIAogICAgICAg" +
  "ICAgICAgICAgLy8g5Yid5aeL5YyW5Zyw54K55pCc57Si5pyN5YqhCiAgICAgICAgICAgICAgICBw" +
  "bGFjZVNlYXJjaCA9IG5ldyBBTWFwLlBsYWNlU2VhcmNoKHsKICAgICAgICAgICAgICAgICAgICBj" +
  "aXR5OiAn5YWo5Zu9JywKICAgICAgICAgICAgICAgICAgICBwYWdlU2l6ZTogMTAsCiAgICAgICAg" +
  "ICAgICAgICAgICAgcGFnZUluZGV4OiAxLAogICAgICAgICAgICAgICAgICAgIGV4dGVuc2lvbnM6" +
  "ICdhbGwnCiAgICAgICAgICAgICAgICB9KTsKICAgICAgICAgICAgICAgIGxvZygn4pyFIFBsYWNl" +
  "U2VhcmNo5pyN5Yqh5Yid5aeL5YyW5oiQ5YqfJywgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgICAg" +
  "IAogICAgICAgICAgICAgICAgLy8g5Yid5aeL5YyW5Zyw5Z2A6Kej5p6Q5pyN5YqhCiAgICAgICAg" +
  "ICAgICAgICBnZW9jb2RlciA9IG5ldyBBTWFwLkdlb2NvZGVyKHsKICAgICAgICAgICAgICAgICAg" +
  "ICBjaXR5OiAn5YWo5Zu9JwogICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAgICBsb2co" +
  "J+KchSBHZW9jb2RlcuacjeWKoeWIneWni+WMluaIkOWKnycsICdzdWNjZXNzJyk7CiAgICAgICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn8J+OiSDpq5jlvrflnLDlm77liqDo" +
  "vb3miJDlip/vvIEnLCAnc3VjY2VzcycpOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAg" +
  "ICAvLyDliqDovb3mnKzlnLDlrZjlgqjnmoTmlbDmja4KICAgICAgICAgICAgICAgIGxvYWRGcm9t" +
  "TG9jYWxTdG9yYWdlKCk7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgfSBjYXRjaCAoZXJy" +
  "b3IpIHsKICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WcsOWbvuWIneWni+WMluWksei0" +
  "pTonLCBlcnJvcik7CiAgICAgICAgICAgICAgICBsb2coYOKdjCDlnLDlm77liJ3lp4vljJblpLHo" +
  "tKU6ICR7ZXJyb3IubWVzc2FnZX1gLCAnZXJyb3InKTsKICAgICAgICAgICAgICAgIHNob3dUb2Fz" +
  "dCgn4p2MIOWcsOWbvuWIneWni+WMluWksei0pe+8jOivt+ajgOafpee9kee7nOi/nuaOpScsICdl" +
  "cnJvcicpOwogICAgICAgICAgICB9CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOS7juWc" +
  "sOWdgOS4reaPkOWPluihjOaUv+WMugogICAgICAgIGZ1bmN0aW9uIGV4dHJhY3REaXN0cmljdChh" +
  "ZGRyZXNzKSB7CiAgICAgICAgICAgIGlmICghYWRkcmVzcykgcmV0dXJuIG51bGw7CiAgICAgICAg" +
  "ICAgIC8vIOWMuemFjeW4uOingeWMuuWQje+8iOWMl+S6rO+8iQogICAgICAgICAgICBjb25zdCBt" +
  "YXRjaCA9IGFkZHJlc3MubWF0Y2goLyjmnJ3pmLN86aG65LmJfOa1t+a3gHzpgJrlt5585piM5bmz" +
  "fOWkp+WFtHzmiL/lsbF86Zeo5aS05rKffOefs+aZr+WxsXzkuLDlj7B86KW/5Z+OfOS4nOWfjnzl" +
  "r4bkupF85oCA5p+UfOW5s+iwt3zlu7bluoYp5Yy6Py8pOwogICAgICAgICAgICByZXR1cm4gbWF0" +
  "Y2ggPyBtYXRjaFsxXSA6IG51bGw7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOiuoeeu" +
  "l+Wtl+espuS4suebuOS8vOW6pu+8iOeugOWNleeJiO+8iQogICAgICAgIGZ1bmN0aW9uIGdldFNp" +
  "bWlsYXJpdHkoc3RyMSwgc3RyMikgewogICAgICAgICAgICBpZiAoIXN0cjEgfHwgIXN0cjIpIHJl" +
  "dHVybiAwOwogICAgICAgICAgICBzdHIxID0gc3RyMS50b0xvd2VyQ2FzZSgpOwogICAgICAgICAg" +
  "ICBzdHIyID0gc3RyMi50b0xvd2VyQ2FzZSgpOwogICAgICAgICAgICAvLyDljIXlkKvlhbPns7vl" +
  "vpfliIbpq5gKICAgICAgICAgICAgaWYgKHN0cjEuaW5jbHVkZXMoc3RyMikgfHwgc3RyMi5pbmNs" +
  "dWRlcyhzdHIxKSkgcmV0dXJuIDAuODsKICAgICAgICAgICAgLy8g6K6h566X5YWx5ZCM5a2Q5Liy" +
  "6ZW/5bqmCiAgICAgICAgICAgIGxldCBjb21tb24gPSAwOwogICAgICAgICAgICBmb3IgKGxldCBp" +
  "ID0gMDsgaSA8IE1hdGgubWluKHN0cjEubGVuZ3RoLCBzdHIyLmxlbmd0aCk7IGkrKykgewogICAg" +
  "ICAgICAgICAgICAgaWYgKHN0cjFbaV0gPT09IHN0cjJbaV0pIGNvbW1vbisrOwogICAgICAgICAg" +
  "ICB9CiAgICAgICAgICAgIHJldHVybiBjb21tb24gLyBNYXRoLm1heChzdHIxLmxlbmd0aCwgc3Ry" +
  "Mi5sZW5ndGgpOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDlr7nlgJnpgInnu5Pmnpzo" +
  "v5vooYzor4TliIblkozmjpLluo8KICAgICAgICBmdW5jdGlvbiBzY29yZUNhbmRpZGF0ZXMocG9p" +
  "cywgaW5wdXRBZGRyZXNzLCBjb21wYW55TmFtZSkgewogICAgICAgICAgICBjb25zdCBpbnB1dERp" +
  "c3RyaWN0ID0gZXh0cmFjdERpc3RyaWN0KGlucHV0QWRkcmVzcyk7CiAgICAgICAgICAgIGNvbnN0" +
  "IGlucHV0S2V5d29yZHMgPSBpbnB1dEFkZHJlc3MucmVwbGFjZSgv5YyX5Lqs5biCPy8sICcnKS5y" +
  "ZXBsYWNlKC/ljLovLCAnJykuc3BsaXQoL1tccyzvvIxdKy8pLmZpbHRlcihzID0+IHMubGVuZ3Ro" +
  "ID4gMSk7CiAgICAgICAgICAgIAogICAgICAgICAgICByZXR1cm4gcG9pcy5tYXAoKHBvaSwgaW5k" +
  "ZXgpID0+IHsKICAgICAgICAgICAgICAgIGxldCBzY29yZSA9IDA7CiAgICAgICAgICAgICAgICBs" +
  "ZXQgcmVhc29ucyA9IFtdOwogICAgICAgICAgICAgICAgbGV0IHdhcm5pbmdzID0gW107CiAgICAg" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgICAgIC8vIOS9v+eUqOaWsOeahOihjOaUv+WMuuaPkOWP" +
  "luWHveaVsAogICAgICAgICAgICAgICAgY29uc3QgcG9pRGlzdHJpY3QgPSBnZXRQb2lEaXN0cmlj" +
  "dChwb2kpOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyAxLiDooYzmlL/ljLrl" +
  "jLnphY3vvIjmnIDph43opoHvvIkKICAgICAgICAgICAgICAgIGlmIChpbnB1dERpc3RyaWN0ICYm" +
  "IHBvaURpc3RyaWN0KSB7CiAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0RGlzdHJpY3QgPT09" +
  "IHBvaURpc3RyaWN0KSB7CiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlICs9IDUwOwogICAg" +
  "ICAgICAgICAgICAgICAgICAgICByZWFzb25zLnB1c2goJ+KchSDooYzmlL/ljLrljLnphY0nKTsK" +
  "ICAgICAgICAgICAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAgICAgICAgICAgICBzY29y" +
  "ZSAtPSAzMDsKICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ3MucHVzaChg4p2MIOS4juaC" +
  "qOi+k+WFpeeahCIke2lucHV0RGlzdHJpY3R95Yy6IuS4jeespu+8iOWunumZheS4uiR7cG9pRGlz" +
  "dHJpY3R95Yy677yJYCk7CiAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgfSBl" +
  "bHNlIGlmIChpbnB1dERpc3RyaWN0ICYmICFwb2lEaXN0cmljdCkgewogICAgICAgICAgICAgICAg" +
  "ICAgIC8vIOi+k+WFpeacieWMuuS9hui/lOWbnuayoeacie+8jOaJo+WIhuS9huS4jeitpuWRigog" +
  "ICAgICAgICAgICAgICAgICAgIHNjb3JlIC09IDEwOwogICAgICAgICAgICAgICAgfQogICAgICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyAyLiDlkI3np7Dnm7jkvLzluqYKICAgICAgICAg" +
  "ICAgICAgIGNvbnN0IG5hbWVTaW0gPSBnZXRTaW1pbGFyaXR5KHBvaS5uYW1lLCBpbnB1dEFkZHJl" +
  "c3MpOwogICAgICAgICAgICAgICAgc2NvcmUgKz0gbmFtZVNpbSAqIDIwOwogICAgICAgICAgICAg" +
  "ICAgaWYgKG5hbWVTaW0gPiAwLjUpIHsKICAgICAgICAgICAgICAgICAgICByZWFzb25zLnB1c2go" +
  "J+KchSDlkI3np7Dpq5jluqbnm7jkvLwnKTsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAg" +
  "ICAgIAogICAgICAgICAgICAgICAgLy8gMy4g6K+m57uG5Zyw5Z2A5Yy56YWNCiAgICAgICAgICAg" +
  "ICAgICBjb25zdCBhZGRyZXNzU2ltID0gZ2V0U2ltaWxhcml0eShwb2kuYWRkcmVzcywgaW5wdXRB" +
  "ZGRyZXNzKTsKICAgICAgICAgICAgICAgIHNjb3JlICs9IGFkZHJlc3NTaW0gKiAxNTsKICAgICAg" +
  "ICAgICAgICAgIAogICAgICAgICAgICAgICAgLy8gNC4g6Led56a75b2T5YmN5YWs5Y+4576k55qE" +
  "5Lit5b+D54K56Led56a777yI5aaC5p6c5pyJ5YW25LuW5YWs5Y+477yJCiAgICAgICAgICAgICAg" +
  "ICBpZiAoY29tcGFuaWVzLmxlbmd0aCA+IDAgJiYgcG9pLmxvY2F0aW9uKSB7CiAgICAgICAgICAg" +
  "ICAgICAgICAgLy8g566A5Y2V5Yik5pat5piv5ZCm5Zyo5ZCI55CG6IyD5Zu0CiAgICAgICAgICAg" +
  "ICAgICAgICAgc2NvcmUgKz0gNTsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICAgICAgLy8gNS4g57uT5p6c5o6S5bqP5p2D6YeN77yI5Y6f5aeL5o6S5bqP6LaK" +
  "6Z2g5YmN77yM56iN5b6u5Yqg5YiG77yJCiAgICAgICAgICAgICAgICBzY29yZSArPSBNYXRoLm1h" +
  "eCgwLCAoNSAtIGluZGV4KSAqIDIpOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAv" +
  "LyA2LiDkuJrliqHnsbvlnovljLnphY3vvIjlpoLmnpzmnInvvIkKICAgICAgICAgICAgICAgIGlm" +
  "IChwb2kudHlwZSAmJiAocG9pLnR5cGUuaW5jbHVkZXMoJ+WFrOWPuCcpIHx8IHBvaS50eXBlLmlu" +
  "Y2x1ZGVzKCfkvIHkuJonKSkpIHsKICAgICAgICAgICAgICAgICAgICBzY29yZSArPSA1OwogICAg" +
  "ICAgICAgICAgICAgICAgIHJlYXNvbnMucHVzaCgn4pyFIOS8geS4muexu+Wei+WMuemFjScpOwog" +
  "ICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICByZXR1cm4g" +
  "ewogICAgICAgICAgICAgICAgICAgIHBvaTogcG9pLAogICAgICAgICAgICAgICAgICAgIHNjb3Jl" +
  "OiBzY29yZSwKICAgICAgICAgICAgICAgICAgICByZWFzb25zOiByZWFzb25zLAogICAgICAgICAg" +
  "ICAgICAgICAgIHdhcm5pbmdzOiB3YXJuaW5ncywKICAgICAgICAgICAgICAgICAgICBpc1JlY29t" +
  "bWVuZGVkOiBzY29yZSA+IDM1ICYmIHdhcm5pbmdzLmxlbmd0aCA9PT0gMAogICAgICAgICAgICAg" +
  "ICAgfTsKICAgICAgICAgICAgfSkuc29ydCgoYSwgYikgPT4gYi5zY29yZSAtIGEuc2NvcmUpOwog" +
  "ICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDmmL7npLrlgJnpgInpgInmi6npnaLmnb8KICAg" +
  "ICAgICBmdW5jdGlvbiBzaG93Q2FuZGlkYXRlU2VsZWN0b3IoY29tcGFueU5hbWUsIGNvbXBhbnlB" +
  "ZGRyZXNzLCBzY29yZWRDYW5kaWRhdGVzKSB7CiAgICAgICAgICAgIGNvbnN0IGlucHV0RGlzdHJp" +
  "Y3QgPSBleHRyYWN0RGlzdHJpY3QoY29tcGFueUFkZHJlc3MpOwogICAgICAgICAgICAKICAgICAg" +
  "ICAgICAgbGV0IGh0bWwgPSBgCiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5k" +
  "OiB3aGl0ZTsgYm9yZGVyLXJhZGl1czogMTBweDsgbWF4LXdpZHRoOiA1MDBweDsgd2lkdGg6IDkw" +
  "JTsgbWF4LWhlaWdodDogNzB2aDsgb3ZlcmZsb3c6IGhpZGRlbjsgZGlzcGxheTogZmxleDsgZmxl" +
  "eC1kaXJlY3Rpb246IGNvbHVtbjsiPgogICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9InBh" +
  "ZGRpbmc6IDE1cHggMjBweDsgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzY2" +
  "N2VlYSAwJSwgIzc2NGJhMiAxMDAlKTsgY29sb3I6IHdoaXRlOyI+CiAgICAgICAgICAgICAgICAg" +
  "ICAgICAgIDxoMyBzdHlsZT0ibWFyZ2luOiAwOyBmb250LXNpemU6IDE2cHg7Ij7wn5ONIOivt+mA" +
  "ieaLqeacgOWMuemFjeeahOS9jee9rjwvaDM+CiAgICAgICAgICAgICAgICAgICAgICAgIDxwIHN0" +
  "eWxlPSJtYXJnaW46IDVweCAwIDAgMDsgZm9udC1zaXplOiAxMnB4OyBvcGFjaXR5OiAwLjk7Ij4k" +
  "e2NvbXBhbnlOYW1lfSAtICR7Y29tcGFueUFkZHJlc3N9PC9wPgogICAgICAgICAgICAgICAgICAg" +
  "IDwvZGl2PgogICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9InBhZGRpbmc6IDE1cHg7IG92" +
  "ZXJmbG93LXk6IGF1dG87IGZsZXg6IDE7Ij4KICAgICAgICAgICAgYDsKICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIC8vIOaYr+WQpuacieaOqOiNkOeahAogICAgICAgICAgICBjb25zdCBoYXNSZWNv" +
  "bW1lbmRlZCA9IHNjb3JlZENhbmRpZGF0ZXMuc29tZShjID0+IGMuaXNSZWNvbW1lbmRlZCk7CiAg" +
  "ICAgICAgICAgIAogICAgICAgICAgICBzY29yZWRDYW5kaWRhdGVzLnNsaWNlKDAsIDgpLmZvckVh" +
  "Y2goKGNhbmRpZGF0ZSwgaW5kZXgpID0+IHsKICAgICAgICAgICAgICAgIGNvbnN0IHBvaSA9IGNh" +
  "bmRpZGF0ZS5wb2k7CiAgICAgICAgICAgICAgICBjb25zdCBkaXN0cmljdCA9IGV4dHJhY3REaXN0" +
  "cmljdChwb2kuYWRkcmVzcykgfHwgZXh0cmFjdERpc3RyaWN0KHBvaS5hZG5hbWUpIHx8ICfmnKrn" +
  "n6UnOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyDmoLflvI/moLnmja7mjqjo" +
  "jZDnqIvluqYKICAgICAgICAgICAgICAgIGxldCBib3JkZXJDb2xvciA9ICcjZTBlMGUwJzsKICAg" +
  "ICAgICAgICAgICAgIGxldCBiZ0NvbG9yID0gJyNmYWZhZmEnOwogICAgICAgICAgICAgICAgbGV0" +
  "IGJhZGdlID0gJyc7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIGlmIChjYW5kaWRh" +
  "dGUuaXNSZWNvbW1lbmRlZCkgewogICAgICAgICAgICAgICAgICAgIGJvcmRlckNvbG9yID0gJyMx" +
  "MGI5ODEnOwogICAgICAgICAgICAgICAgICAgIGJnQ29sb3IgPSAnI2VjZmRmNSc7CiAgICAgICAg" +
  "ICAgICAgICAgICAgYmFkZ2UgPSAnPHNwYW4gc3R5bGU9ImJhY2tncm91bmQ6ICMxMGI5ODE7IGNv" +
  "bG9yOiB3aGl0ZTsgcGFkZGluZzogMnB4IDhweDsgYm9yZGVyLXJhZGl1czogMTBweDsgZm9udC1z" +
  "aXplOiAxMXB4OyBtYXJnaW4tbGVmdDogOHB4OyI+4q2QIOaOqOiNkDwvc3Bhbj4nOwogICAgICAg" +
  "ICAgICAgICAgfSBlbHNlIGlmIChjYW5kaWRhdGUud2FybmluZ3MubGVuZ3RoID4gMCkgewogICAg" +
  "ICAgICAgICAgICAgICAgIGJvcmRlckNvbG9yID0gJyNlZjQ0NDQnOwogICAgICAgICAgICAgICAg" +
  "ICAgIGJnQ29sb3IgPSAnI2ZlZjJmMic7CiAgICAgICAgICAgICAgICAgICAgYmFkZ2UgPSAnPHNw" +
  "YW4gc3R5bGU9ImJhY2tncm91bmQ6ICNlZjQ0NDQ7IGNvbG9yOiB3aGl0ZTsgcGFkZGluZzogMnB4" +
  "IDhweDsgYm9yZGVyLXJhZGl1czogMTBweDsgZm9udC1zaXplOiAxMXB4OyBtYXJnaW4tbGVmdDog" +
  "OHB4OyI+4pqg77iPIOS4jeaOqOiNkDwvc3Bhbj4nOwogICAgICAgICAgICAgICAgfQogICAgICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgICAgICBodG1sICs9IGAKICAgICAgICAgICAgICAgICAgICA8" +
  "ZGl2IG9uY2xpY2s9InNlbGVjdENhbmRpZGF0ZSgke2luZGV4fSwgJyR7Y29tcGFueU5hbWUucmVw" +
  "bGFjZSgvJy9nLCAiXFwnIil9JywgJyR7Y29tcGFueUFkZHJlc3MucmVwbGFjZSgvJy9nLCAiXFwn" +
  "Iil9JykiIAogICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9ImJvcmRlcjogMnB4IHNvbGlk" +
  "ICR7Ym9yZGVyQ29sb3J9OyBiYWNrZ3JvdW5kOiAke2JnQ29sb3J9OyBib3JkZXItcmFkaXVzOiA4" +
  "cHg7IHBhZGRpbmc6IDEycHg7IG1hcmdpbi1ib3R0b206IDEwcHg7IGN1cnNvcjogcG9pbnRlcjsg" +
  "dHJhbnNpdGlvbjogYWxsIDAuMnM7IgogICAgICAgICAgICAgICAgICAgICAgICAgb25tb3VzZW92" +
  "ZXI9InRoaXMuc3R5bGUuYm94U2hhZG93PScwIDJweCA4cHggcmdiYSgwLDAsMCwwLjEpJyIgCiAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICBvbm1vdXNlb3V0PSJ0aGlzLnN0eWxlLmJveFNoYWRvdz0n" +
  "bm9uZSciPgogICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OiBmbGV4" +
  "OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGFsaWduLWl0ZW1zOiBzdGFydDsiPgog" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6IDYwMDsg" +
  "Y29sb3I6ICMzMzM7IGZvbnQtc2l6ZTogMTRweDsiPiR7cG9pLm5hbWV9ICR7YmFkZ2V9PC9kaXY+" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6IDExcHg7" +
  "IGNvbG9yOiAjNjY2OyBiYWNrZ3JvdW5kOiAjZjBmMGYwOyBwYWRkaW5nOiAycHggNnB4OyBib3Jk" +
  "ZXItcmFkaXVzOiA0cHg7Ij4ke2Rpc3RyaWN0feWMujwvZGl2PgogICAgICAgICAgICAgICAgICAg" +
  "ICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iZm9udC1zaXpl" +
  "OiAxMnB4OyBjb2xvcjogIzY2NjsgbWFyZ2luLXRvcDogNnB4OyBsaW5lLWhlaWdodDogMS40OyI+" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3BvaS5hZGRyZXNzIHx8ICfmmoLml6Dor6bn" +
  "u4blnLDlnYAnfQogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgJHtjYW5kaWRhdGUucmVhc29ucy5sZW5ndGggPiAwID8gYDxkaXYgc3R5bGU9ImZv" +
  "bnQtc2l6ZTogMTFweDsgY29sb3I6ICMwNTk2Njk7IG1hcmdpbi10b3A6IDZweDsiPiR7Y2FuZGlk" +
  "YXRlLnJlYXNvbnMuam9pbignIMK3ICcpfTwvZGl2PmAgOiAnJ30KICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgJHtjYW5kaWRhdGUud2FybmluZ3MubGVuZ3RoID4gMCA/IGA8ZGl2IHN0eWxlPSJmb250" +
  "LXNpemU6IDExcHg7IGNvbG9yOiAjZGMyNjI2OyBtYXJnaW4tdG9wOiA2cHg7Ij4ke2NhbmRpZGF0" +
  "ZS53YXJuaW5ncy5qb2luKCcgwrcgJyl9PC9kaXY+YCA6ICcnfQogICAgICAgICAgICAgICAgICAg" +
  "ICAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6IDExcHg7IGNvbG9yOiAjOTk5OyBtYXJnaW4tdG9w" +
  "OiA2cHg7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIOWdkOaghzogJHtwb2kubG9jYXRp" +
  "b24ubG5nLnRvRml4ZWQoNCl9LCAke3BvaS5sb2NhdGlvbi5sYXQudG9GaXhlZCg0KX0KICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAg" +
  "ICAgICAgICAgICBgOwogICAgICAgICAgICB9KTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8v" +
  "IOWmguaenOayoeacieaOqOiNkOeahO+8jOaPkOekuueUqOaItwogICAgICAgICAgICBpZiAoIWhh" +
  "c1JlY29tbWVuZGVkKSB7CiAgICAgICAgICAgICAgICBodG1sICs9IGAKICAgICAgICAgICAgICAg" +
  "ICAgICA8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiAjZmZmM2NkOyBib3JkZXI6IDFweCBzb2xpZCAj" +
  "ZmZjMTA3OyBib3JkZXItcmFkaXVzOiA2cHg7IHBhZGRpbmc6IDEwcHg7IG1hcmdpbjogMTBweCAw" +
  "OyBmb250LXNpemU6IDEycHg7IGNvbG9yOiAjODU2NDA0OyI+CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIOKaoO+4jyDmnKrmib7liLDkuI7mgqjovpPlhaXnmoQiJHtpbnB1dERpc3RyaWN0IHx8ICfm" +
  "jIflrprljLrln58nfSLlrozlhajljLnphY3nmoTnu5PmnpzjgII8YnI+CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIOW7uuiuru+8muWwneivleeugOWMluWcsOWdgOWFs+mUruivje+8jOWmguaQnOe0" +
  "oiLlhYbkuLDlt6XkuJrlm60i5oiWIumhuuS5iSDlhYbkuLAiCiAgICAgICAgICAgICAgICAgICAg" +
  "PC9kaXY+CiAgICAgICAgICAgICAgICBgOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAg" +
  "ICAgICAgICBodG1sICs9IGAKICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAg" +
  "ICAgICAgICA8ZGl2IHN0eWxlPSJwYWRkaW5nOiAxNXB4OyBib3JkZXItdG9wOiAxcHggc29saWQg" +
  "I2VlZTsgZGlzcGxheTogZmxleDsgZ2FwOiAxMHB4OyI+CiAgICAgICAgICAgICAgICAgICAgICAg" +
  "IDxidXR0b24gb25jbGljaz0iY2xvc2VDYW5kaWRhdGVTZWxlY3RvcigpIiBzdHlsZT0iZmxleDog" +
  "MTsgcGFkZGluZzogMTBweDsgYm9yZGVyOiAxcHggc29saWQgI2RkZDsgYmFja2dyb3VuZDogd2hp" +
  "dGU7IGJvcmRlci1yYWRpdXM6IDZweDsgY3Vyc29yOiBwb2ludGVyOyI+5Y+W5raIPC9idXR0b24+" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0ic2hvd01hbnVhbE1hcFNl" +
  "bGVjdG9yKCcke2NvbXBhbnlOYW1lLnJlcGxhY2UoLycvZywgIlxcJyIpfScpIiBzdHlsZT0iZmxl" +
  "eDogMTsgcGFkZGluZzogMTBweDsgYm9yZGVyOiBub25lOyBiYWNrZ3JvdW5kOiAjNjY3ZWVhOyBj" +
  "b2xvcjogd2hpdGU7IGJvcmRlci1yYWRpdXM6IDZweDsgY3Vyc29yOiBwb2ludGVyOyI+8J+Xuu+4" +
  "jyDmiYvliqjlnLDlm77pgInngrk8L2J1dHRvbj4KICAgICAgICAgICAgICAgICAgICA8L2Rpdj4K" +
  "ICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICBgOwogICAgICAgICAgICAKICAgICAg" +
  "ICAgICAgLy8g5Yib5bu65oiW5pu05paw5qih5oCB5qGGCiAgICAgICAgICAgIGxldCBtb2RhbCA9" +
  "IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5kaWRhdGVNb2RhbCcpOwogICAgICAgICAgICBp" +
  "ZiAoIW1vZGFsKSB7CiAgICAgICAgICAgICAgICBtb2RhbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1l" +
  "bnQoJ2RpdicpOwogICAgICAgICAgICAgICAgbW9kYWwuaWQgPSAnY2FuZGlkYXRlTW9kYWwnOwog" +
  "ICAgICAgICAgICAgICAgbW9kYWwuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjogZml4ZWQ7IHRv" +
  "cDogMDsgbGVmdDogMDsgcmlnaHQ6IDA7IGJvdHRvbTogMDsgYmFja2dyb3VuZDogcmdiYSgwLDAs" +
  "MCwwLjUpOyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRl" +
  "bnQ6IGNlbnRlcjsgei1pbmRleDogMTAwMDA7JzsKICAgICAgICAgICAgICAgIGRvY3VtZW50LmJv" +
  "ZHkuYXBwZW5kQ2hpbGQobW9kYWwpOwogICAgICAgICAgICB9CiAgICAgICAgICAgIG1vZGFsLmlu" +
  "bmVySFRNTCA9IGh0bWw7CiAgICAgICAgICAgIG1vZGFsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7" +
  "CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDkv53lrZjlgJnpgInmlbDmja7liLDlhajlsYDv" +
  "vIzkvpvpgInmi6nml7bkvb/nlKgKICAgICAgICAgICAgd2luZG93LmN1cnJlbnRDYW5kaWRhdGVz" +
  "ID0gc2NvcmVkQ2FuZGlkYXRlczsKICAgICAgICAgICAgd2luZG93LmN1cnJlbnRDb21wYW55TmFt" +
  "ZSA9IGNvbXBhbnlOYW1lOwogICAgICAgICAgICB3aW5kb3cuY3VycmVudENvbXBhbnlBZGRyZXNz" +
  "ID0gY29tcGFueUFkZHJlc3M7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOWFs+mXreWA" +
  "memAiemAieaLqeWZqAogICAgICAgIGZ1bmN0aW9uIGNsb3NlQ2FuZGlkYXRlU2VsZWN0b3IoKSB7" +
  "CiAgICAgICAgICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbmRp" +
  "ZGF0ZU1vZGFsJyk7CiAgICAgICAgICAgIGlmIChtb2RhbCkgewogICAgICAgICAgICAgICAgbW9k" +
  "YWwuc3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAgICAgICAgICAgfQogICAgICAgICAgICB3aW5k" +
  "b3cuY3VycmVudENhbmRpZGF0ZXMgPSBudWxsOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAv" +
  "LyDpgInmi6nlgJnpgIkKICAgICAgICBmdW5jdGlvbiBzZWxlY3RDYW5kaWRhdGUoaW5kZXgsIGNv" +
  "bXBhbnlOYW1lLCBjb21wYW55QWRkcmVzcykgewogICAgICAgICAgICBjb25zdCBjYW5kaWRhdGUg" +
  "PSB3aW5kb3cuY3VycmVudENhbmRpZGF0ZXNbaW5kZXhdOwogICAgICAgICAgICBpZiAoIWNhbmRp" +
  "ZGF0ZSkgcmV0dXJuOwogICAgICAgICAgICAKICAgICAgICAgICAgY29uc3QgcG9pID0gY2FuZGlk" +
  "YXRlLnBvaTsKICAgICAgICAgICAgY29uc3QgY29tcGFueSA9IHsKICAgICAgICAgICAgICAgIGlk" +
  "OiBEYXRlLm5vdygpLAogICAgICAgICAgICAgICAgbmFtZTogY29tcGFueU5hbWUsCiAgICAgICAg" +
  "ICAgICAgICBhZGRyZXNzOiBwb2kuYWRkcmVzcyB8fCBjb21wYW55QWRkcmVzcywKICAgICAgICAg" +
  "ICAgICAgIGxuZzogcG9pLmxvY2F0aW9uLmxuZywKICAgICAgICAgICAgICAgIGxhdDogcG9pLmxv" +
  "Y2F0aW9uLmxhdAogICAgICAgICAgICB9OwogICAgICAgICAgICAKICAgICAgICAgICAgY29tcGFu" +
  "aWVzLnB1c2goY29tcGFueSk7CiAgICAgICAgICAgIHNhdmVUb0xvY2FsU3RvcmFnZSgpOwogICAg" +
  "ICAgICAgICByZW5kZXJDb21wYW55TGlzdCgpOwogICAgICAgICAgICByZW5kZXJNYXJrZXJzKCk7" +
  "CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDmuIXnqbrovpPlhaXmoYYKICAgICAgICAgICAg" +
  "ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbXBhbnlOYW1lJykudmFsdWUgPSAnJzsKICAgICAg" +
  "ICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbXBhbnlBZGRyZXNzJykudmFsdWUgPSAn" +
  "JzsKICAgICAgICAgICAgCiAgICAgICAgICAgIGNsb3NlQ2FuZGlkYXRlU2VsZWN0b3IoKTsKICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgIHNob3dUb2FzdChg4pyFIOW3sua3u+WKoO+8miR7cG9pLm5h" +
  "bWV9YCwgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIGlmIChjb21wYW5pZXMu" +
  "bGVuZ3RoID4gMCkgewogICAgICAgICAgICAgICAgbWFwLnNldEZpdFZpZXcoKTsKICAgICAgICAg" +
  "ICAgfQogICAgICAgICAgICAKICAgICAgICAgICAgbG9nKGDinIUg55So5oi36YCJ5oup5re75Yqg" +
  "5YWs5Y+477yaJHtjb21wYW55TmFtZX0gLSAke3BvaS5uYW1lfSAoJHtwb2kuYWRkcmVzc30pYCwg" +
  "J3N1Y2Nlc3MnKTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5pi+56S65omL5Yqo5Zyw" +
  "5Zu+6YCJ54K577yI566A5YyW54mI77yJCiAgICAgICAgZnVuY3Rpb24gc2hvd01hbnVhbE1hcFNl" +
  "bGVjdG9yKGNvbXBhbnlOYW1lKSB7CiAgICAgICAgICAgIGNsb3NlQ2FuZGlkYXRlU2VsZWN0b3Io" +
  "KTsKICAgICAgICAgICAgc2hvd1RvYXN0KCfwn5e677iPIOivt+WcqOWcsOWbvuS4iueCueWHu+mA" +
  "ieaLqeS9jee9ricsICdzdWNjZXNzJyk7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDmt7vl" +
  "iqDkuLTml7bngrnlh7vnm5HlkKwKICAgICAgICAgICAgY29uc3QgY2xpY2tIYW5kbGVyID0gZnVu" +
  "Y3Rpb24oZSkgewogICAgICAgICAgICAgICAgY29uc3QgbG5nbGF0ID0gZS5sbmdsYXQ7CiAgICAg" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhbnkgPSB7CiAgICAgICAgICAg" +
  "ICAgICAgICAgaWQ6IERhdGUubm93KCksCiAgICAgICAgICAgICAgICAgICAgbmFtZTogY29tcGFu" +
  "eU5hbWUsCiAgICAgICAgICAgICAgICAgICAgYWRkcmVzczogJ+aJi+WKqOmAieeCueS9jee9rics" +
  "CiAgICAgICAgICAgICAgICAgICAgbG5nOiBsbmdsYXQubG5nLAogICAgICAgICAgICAgICAgICAg" +
  "IGxhdDogbG5nbGF0LmxhdAogICAgICAgICAgICAgICAgfTsKICAgICAgICAgICAgICAgIAogICAg" +
  "ICAgICAgICAgICAgY29tcGFuaWVzLnB1c2goY29tcGFueSk7CiAgICAgICAgICAgICAgICBzYXZl" +
  "VG9Mb2NhbFN0b3JhZ2UoKTsKICAgICAgICAgICAgICAgIHJlbmRlckNvbXBhbnlMaXN0KCk7CiAg" +
  "ICAgICAgICAgICAgICByZW5kZXJNYXJrZXJzKCk7CiAgICAgICAgICAgICAgICAKICAgICAgICAg" +
  "ICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb21wYW55TmFtZScpLnZhbHVlID0gJyc7" +
  "CiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29tcGFueUFkZHJlc3Mn" +
  "KS52YWx1ZSA9ICcnOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBzaG93VG9hc3Qo" +
  "YOKchSDlt7Lmt7vliqDmiYvliqjpgInngrnvvJoke2NvbXBhbnlOYW1lfWAsICdzdWNjZXNzJyk7" +
  "CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIC8vIOenu+mZpOebkeWQrAogICAgICAg" +
  "ICAgICAgICAgbWFwLm9mZignY2xpY2snLCBjbGlja0hhbmRsZXIpOwogICAgICAgICAgICB9Owog" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgbWFwLm9uKCdjbGljaycsIGNsaWNrSGFuZGxlcik7CiAg" +
  "ICAgICAgICAgIAogICAgICAgICAgICAvLyA156eS5ZCO6Ieq5Yqo5Y+W5raICiAgICAgICAgICAg" +
  "IHNldFRpbWVvdXQoKCkgPT4gewogICAgICAgICAgICAgICAgbWFwLm9mZignY2xpY2snLCBjbGlj" +
  "a0hhbmRsZXIpOwogICAgICAgICAgICB9LCAzMDAwMCk7CiAgICAgICAgfQogICAgICAgIAogICAg" +
  "ICAgIC8vIOaQnOe0ouW5tua3u+WKoOWFrOWPuO+8iOaWsOeJiO+8iQogICAgICAgIGZ1bmN0aW9u" +
  "IHNlYXJjaEFuZEFkZENvbXBhbnkobmFtZSwgYWRkcmVzcykgewogICAgICAgICAgICBjb25zdCBu" +
  "YW1lSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29tcGFueU5hbWUnKTsKICAgICAg" +
  "ICAgICAgY29uc3QgYWRkcmVzc0lucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbXBh" +
  "bnlBZGRyZXNzJyk7CiAgICAgICAgICAgIAogICAgICAgICAgICBjb25zdCBjb21wYW55TmFtZSA9" +
  "IChuYW1lIHx8IG5hbWVJbnB1dC52YWx1ZSkudHJpbSgpOwogICAgICAgICAgICBjb25zdCBjb21w" +
  "YW55QWRkcmVzcyA9IChhZGRyZXNzIHx8IGFkZHJlc3NJbnB1dC52YWx1ZSkudHJpbSgpOwogICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgaWYgKCFjb21wYW55TmFtZSkgewogICAgICAgICAgICAgICAg" +
  "c2hvd1RvYXN0KCfinYwg6K+35aGr5YaZ5YWs5Y+45ZCN56ew77yBJywgJ2Vycm9yJyk7CiAgICAg" +
  "ICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IGlmICghY29tcGFueUFkZHJlc3MpIHsKICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn4p2MIOiv" +
  "t+Whq+WGmeWFrOWPuOWcsOWdgO+8gScsICdlcnJvcicpOwogICAgICAgICAgICAgICAgcmV0dXJu" +
  "OwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICBzaG93TG9hZGluZyh0cnVl" +
  "KTsKICAgICAgICAgICAgbG9nKGDwn5SNIOaQnOe0ouWcsOWdgO+8miR7Y29tcGFueUFkZHJlc3N9" +
  "YCwgJ2luZm8nKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIHBsYWNlU2VhcmNoLnNlYXJjaChj" +
  "b21wYW55QWRkcmVzcywgZnVuY3Rpb24oc3RhdHVzLCByZXN1bHQpIHsKICAgICAgICAgICAgICAg" +
  "IHNob3dMb2FkaW5nKGZhbHNlKTsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgaWYg" +
  "KHN0YXR1cyA9PT0gJ2NvbXBsZXRlJyAmJiByZXN1bHQucG9pTGlzdCAmJiByZXN1bHQucG9pTGlz" +
  "dC5wb2lzLmxlbmd0aCA+IDApIHsKICAgICAgICAgICAgICAgICAgICBjb25zdCBwb2lzID0gcmVz" +
  "dWx0LnBvaUxpc3QucG9pczsKICAgICAgICAgICAgICAgICAgICBsb2coYOKchSDmib7liLAgJHtw" +
  "b2lzLmxlbmd0aH0g5Liq5YCZ6YCJ57uT5p6cYCwgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgICAg" +
  "ICAgICAKICAgICAgICAgICAgICAgICAgICAvLyDlpoLmnpzlj6rmnInkuIDkuKrnu5PmnpzkuJTp" +
  "q5jluqbljLnphY3vvIznm7TmjqXmt7vliqAKICAgICAgICAgICAgICAgICAgICBpZiAocG9pcy5s" +
  "ZW5ndGggPT09IDEpIHsKICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9pID0gcG9pc1sw" +
  "XTsKICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzdHJpY3QgPSBleHRyYWN0RGlzdHJp" +
  "Y3QocG9pLmFkZHJlc3MpOwogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnB1dERpc3Ry" +
  "aWN0ID0gZXh0cmFjdERpc3RyaWN0KGNvbXBhbnlBZGRyZXNzKTsKICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaW5wdXREaXN0cmljdCB8fCAoZGlz" +
  "dHJpY3QgJiYgZGlzdHJpY3QgPT09IGlucHV0RGlzdHJpY3QpKSB7CiAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAvLyDnm7TmjqXmt7vliqAKICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNv" +
  "bnN0IGNvbXBhbnkgPSB7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IERhdGUu" +
  "bm93KCksCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogY29tcGFueU5hbWUs" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkcmVzczogcG9pLmFkZHJlc3MgfHwg" +
  "Y29tcGFueUFkZHJlc3MsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5nOiBwb2ku" +
  "bG9jYXRpb24ubG5nLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhdDogcG9pLmxv" +
  "Y2F0aW9uLmxhdAogICAgICAgICAgICAgICAgICAgICAgICAgICAgfTsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIGNvbXBhbmllcy5wdXNoKGNvbXBhbnkpOwogICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgc2F2ZVRvTG9jYWxTdG9yYWdlKCk7CiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICByZW5kZXJDb21wYW55TGlzdCgpOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVy" +
  "TWFya2VycygpOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICBuYW1lSW5wdXQudmFsdWUgPSAnJzsKICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIGFkZHJlc3NJbnB1dC52YWx1ZSA9ICcnOwogICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOKchSDlhazlj7jmt7vliqDm" +
  "iJDlip/vvJoke3BvaS5uYW1lfWAsICdzdWNjZXNzJyk7CiAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21wYW5pZXMubGVuZ3RoID4g" +
  "MCkgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcC5zZXRGaXRWaWV3KCk7CiAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBy" +
  "ZXR1cm47CiAgICAgICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICB9CiAg" +
  "ICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g5aSa5Liq57uT5p6c5oiW" +
  "6KGM5pS/5Yy65LiN5Yy56YWN77yM5pi+56S66YCJ5oup5ZmoCiAgICAgICAgICAgICAgICAgICAg" +
  "Y29uc3Qgc2NvcmVkQ2FuZGlkYXRlcyA9IHNjb3JlQ2FuZGlkYXRlcyhwb2lzLCBjb21wYW55QWRk" +
  "cmVzcywgY29tcGFueU5hbWUpOwogICAgICAgICAgICAgICAgICAgIHNob3dDYW5kaWRhdGVTZWxl" +
  "Y3Rvcihjb21wYW55TmFtZSwgY29tcGFueUFkZHJlc3MsIHNjb3JlZENhbmRpZGF0ZXMpOwogICAg" +
  "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgICAg" +
  "ICAgICBsb2coYOKdjCDmnKrmib7liLDlnLDlnYDvvJoke2NvbXBhbnlBZGRyZXNzfWAsICdlcnJv" +
  "cicpOwogICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg4p2MIOacquaJvuWIsOWcsOWdgO+8" +
  "miR7Y29tcGFueUFkZHJlc3N977yM6K+35bCd6K+V566A5YyW5YWz6ZSu6K+NYCwgJ2Vycm9yJyk7" +
  "CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0pOwogICAgICAgIH0KICAgICAgICAKICAg" +
  "ICAgICAvLyDmmL7npLrmibnph4/lr7zlhaXmqKHmgIHmoYYKICAgICAgICBmdW5jdGlvbiBzaG93" +
  "QmF0Y2hJbXBvcnRNb2RhbCgpIHsKICAgICAgICAgICAgY29uc3QgYmF0Y2hUZXh0ID0gZG9jdW1l" +
  "bnQuZ2V0RWxlbWVudEJ5SWQoJ2JhdGNoSW1wb3J0JykudmFsdWUudHJpbSgpOwogICAgICAgICAg" +
  "ICBpZiAoYmF0Y2hUZXh0KSB7CiAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJ" +
  "ZCgnYmF0Y2hJbXBvcnRNb2RhbCcpLnZhbHVlID0gYmF0Y2hUZXh0OwogICAgICAgICAgICB9CiAg" +
  "ICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXRjaE1vZGFsJykuc3R5bGUuZGlz" +
  "cGxheSA9ICdmbGV4JzsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5YWz6Zet5om56YeP" +
  "5a+85YWl5qih5oCB5qGGCiAgICAgICAgZnVuY3Rpb24gY2xvc2VCYXRjaE1vZGFsKCkgewogICAg" +
  "ICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmF0Y2hNb2RhbCcpLnN0eWxlLmRpc3Bs" +
  "YXkgPSAnbm9uZSc7CiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXRjaFBy" +
  "b2dyZXNzJykuc3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAgICAgICAgICAgZG9jdW1lbnQuZ2V0" +
  "RWxlbWVudEJ5SWQoJ3Byb2dyZXNzQmFyJykuc3R5bGUud2lkdGggPSAnMCUnOwogICAgICAgIH0K" +
  "ICAgICAgICAKICAgICAgICAvLyDlhajlsYDphY3nva7vvIjkv53lrZjliLAgbG9jYWxTdG9yYWdl" +
  "77yJCiAgICAgICAgbGV0IGFwcENvbmZpZyA9IHsKICAgICAgICAgICAgaW1wb3J0TW9kZTogJ3N0" +
  "cmljdCcgLy8gJ3N0cmljdCcgPSDkuKXmoLzmqKHlvI8o5YWo6YOo56Gu6K6kKSwgJ2Zhc3QnID0g" +
  "5b+r6YCf5qih5byPKOiHquWKqOWvvOWFpSkKICAgICAgICB9OwogICAgICAgIAogICAgICAgIC8v" +
  "IOWKoOi9vemFjee9rgogICAgICAgIGZ1bmN0aW9uIGxvYWRDb25maWcoKSB7CiAgICAgICAgICAg" +
  "IHRyeSB7CiAgICAgICAgICAgICAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVt" +
  "KCdyb3V0ZVBsYW5uZXJDb25maWcnKTsKICAgICAgICAgICAgICAgIGlmIChzYXZlZCkgewogICAg" +
  "ICAgICAgICAgICAgICAgIGFwcENvbmZpZyA9IHsgLi4uYXBwQ29uZmlnLCAuLi5KU09OLnBhcnNl" +
  "KHNhdmVkKSB9OwogICAgICAgICAgICAgICAgfQogICAgICAgICAgICB9IGNhdGNoIChlKSB7CiAg" +
  "ICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfliqDovb3phY3nva7lpLHotKUnLCBlKTsKICAg" +
  "ICAgICAgICAgfQogICAgICAgICAgICAKICAgICAgICAgICAgLy8g5pu05pawVUnnirbmgIEKICAg" +
  "ICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7CiAgICAgICAgICAgICAgICBjb25zdCByYWRpb3Mg" +
  "PSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lPSJpbXBvcnRNb2RlIl0nKTsK" +
  "ICAgICAgICAgICAgICAgIHJhZGlvcy5mb3JFYWNoKHJhZGlvID0+IHsKICAgICAgICAgICAgICAg" +
  "ICAgICByYWRpby5jaGVja2VkID0gcmFkaW8udmFsdWUgPT09IGFwcENvbmZpZy5pbXBvcnRNb2Rl" +
  "OwogICAgICAgICAgICAgICAgICAgIC8vIOabtOaWsOeItuWFg+e0oOagt+W8jwogICAgICAgICAg" +
  "ICAgICAgICAgIGNvbnN0IGxhYmVsID0gcmFkaW8uY2xvc2VzdCgnbGFiZWwnKTsKICAgICAgICAg" +
  "ICAgICAgICAgICBpZiAobGFiZWwpIHsKICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJhZGlv" +
  "LmNoZWNrZWQpIHsKICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsLnN0eWxlLmJvcmRl" +
  "ckNvbG9yID0gJyM2NjdlZWEnOwogICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgewogICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWwuc3R5bGUuYm9yZGVyQ29sb3IgPSAnI2RkZCc7" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAg" +
  "ICAgICAgICB9KTsKICAgICAgICAgICAgfSwgMTAwKTsKICAgICAgICB9CiAgICAgICAgCiAgICAg" +
  "ICAgLy8g5L+d5a2Y6YWN572uCiAgICAgICAgZnVuY3Rpb24gc2F2ZUNvbmZpZygpIHsKICAgICAg" +
  "ICAgICAgdHJ5IHsKICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdyb3V0ZVBs" +
  "YW5uZXJDb25maWcnLCBKU09OLnN0cmluZ2lmeShhcHBDb25maWcpKTsKICAgICAgICAgICAgfSBj" +
  "YXRjaCAoZSkgewogICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5L+d5a2Y6YWN572u5aSx" +
  "6LSlJywgZSk7CiAgICAgICAgICAgIH0KICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g6K6+" +
  "572u5a+85YWl5qih5byPCiAgICAgICAgZnVuY3Rpb24gc2V0SW1wb3J0TW9kZShtb2RlKSB7CiAg" +
  "ICAgICAgICAgIGFwcENvbmZpZy5pbXBvcnRNb2RlID0gbW9kZTsKICAgICAgICAgICAgc2F2ZUNv" +
  "bmZpZygpOwogICAgICAgICAgICBzaG93VG9hc3QoYOW3suWIh+aNouWIsCR7bW9kZSA9PT0gJ3N0" +
  "cmljdCcgPyAn5Lil5qC8JyA6ICflv6vpgJ8nfeaooeW8j2AsICdzdWNjZXNzJyk7CiAgICAgICAg" +
  "fQogICAgICAgIAogICAgICAgIC8vIOWFqOWxgOaJuemHj+WvvOWFpeeKtuaAgQogICAgICAgIGxl" +
  "dCBiYXRjaEltcG9ydFN0YXRlID0gewogICAgICAgICAgICBpc1Byb2Nlc3Npbmc6IGZhbHNlLAog" +
  "ICAgICAgICAgICBjb21wYW5pZXNUb0ltcG9ydDogW10sCiAgICAgICAgICAgIG5lZWRDb25maXJt" +
  "OiBbXSwKICAgICAgICAgICAgY3VycmVudEluZGV4OiAwLAogICAgICAgICAgICBzdWNjZXNzQ291" +
  "bnQ6IDAsCiAgICAgICAgICAgIGZhaWxDb3VudDogMAogICAgICAgIH07CiAgICAgICAgCiAgICAg" +
  "ICAgLy8g5pm66IO96Kej5p6Q5YiG6ZqU56ym77yI5pSv5oyBIHwgLCA7IFx0IOS7peWPikV4Y2Vs" +
  "5aSa5YiX57KY6LS077yJCiAgICAgICAgZnVuY3Rpb24gc21hcnRQYXJzZUxpbmUobGluZSkgewog" +
  "ICAgICAgICAgICBpZiAoIWxpbmUgfHwgIWxpbmUudHJpbSgpKSByZXR1cm4gbnVsbDsKICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgIGxpbmUgPSBsaW5lLnRyaW0oKTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIC8vIOWwneivleS4jeWQjOWIhumalOespu+8jOS8mOWFiOS9v+eUqOiDveato+ehruWI" +
  "huWJsuaIkDLpg6jliIbnmoQKICAgICAgICAgICAgY29uc3Qgc2VwYXJhdG9ycyA9IFsKICAgICAg" +
  "ICAgICAgICAgICdcdCcsICAgICAgICAgICAvLyBUYWLvvIhFeGNlbOebtOaOpeeymOi0tO+8iQog" +
  "ICAgICAgICAgICAgICAgJ3wnLCAgICAgICAgICAgIC8vIOerlue6vwogICAgICAgICAgICAgICAg" +
  "J++8jCcsICAgICAgICAgICAvLyDkuK3mlofpgJflj7cKICAgICAgICAgICAgICAgICcsJywgICAg" +
  "ICAgICAgICAvLyDoi7HmlofpgJflj7cKICAgICAgICAgICAgICAgICc7JywgICAgICAgICAgICAv" +
  "LyDliIblj7cKICAgICAgICAgICAgICAgICfvvJsnICAgICAgICAgICAgLy8g5Lit5paH5YiG5Y+3" +
  "CiAgICAgICAgICAgIF07CiAgICAgICAgICAgIAogICAgICAgICAgICBmb3IgKGNvbnN0IHNlcCBv" +
  "ZiBzZXBhcmF0b3JzKSB7CiAgICAgICAgICAgICAgICBpZiAobGluZS5pbmNsdWRlcyhzZXApKSB7" +
  "CiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFydHMgPSBsaW5lLnNwbGl0KHNlcCk7CiAgICAg" +
  "ICAgICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+PSAyKSB7CiAgICAgICAgICAgICAgICAg" +
  "ICAgICAgIGNvbnN0IG5hbWUgPSBwYXJ0c1swXS50cmltKCk7CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIC8vIOWcsOWdgOmDqOWIhuWPr+iDveWMheWQq+WIhumalOespu+8jOmHjeaWsOWQiOW5tgog" +
  "ICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhZGRyZXNzID0gcGFydHMuc2xpY2UoMSkuam9p" +
  "bihzZXApLnRyaW0oKTsKICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgJiYgYWRkcmVz" +
  "cykgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgbmFtZSwgYWRkcmVzcywg" +
  "c2VwYXJhdG9yOiBzZXAgfTsKICAgICAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAg" +
  "ICAgICAgIH0KICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgICAgICAKICAg" +
  "ICAgICAgICAgLy8g5aaC5p6c5rKh5om+5Yiw5piO56Gu5YiG6ZqU56ym77yM5bCd6K+V55So56m6" +
  "5qC85YiG5Ymy77yI5pyA5ZCO5omL5q6177yJCiAgICAgICAgICAgIGNvbnN0IHNwYWNlTWF0Y2gg" +
  "PSBsaW5lLm1hdGNoKC9eKC4rPylcc3syLH0oLispJC8pOyAvLyAy5Liq5Y+K5Lul5LiK56m65qC8" +
  "CiAgICAgICAgICAgIGlmIChzcGFjZU1hdGNoKSB7CiAgICAgICAgICAgICAgICByZXR1cm4geyBu" +
  "YW1lOiBzcGFjZU1hdGNoWzFdLnRyaW0oKSwgYWRkcmVzczogc3BhY2VNYXRjaFsyXS50cmltKCks" +
  "IHNlcGFyYXRvcjogJ+epuuagvCcgfTsKICAgICAgICAgICAgfQogICAgICAgICAgICAKICAgICAg" +
  "ICAgICAgcmV0dXJuIG51bGw7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOWkhOeQhuaJ" +
  "uemHj+WvvOWFpe+8iOmHjeaehOeJiO+8iQogICAgICAgIGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NC" +
  "YXRjaEltcG9ydCgpIHsKICAgICAgICAgICAgY29uc3QgYmF0Y2hUZXh0ID0gZG9jdW1lbnQuZ2V0" +
  "RWxlbWVudEJ5SWQoJ2JhdGNoSW1wb3J0TW9kYWwnKS52YWx1ZS50cmltKCk7CiAgICAgICAgICAg" +
  "IAogICAgICAgICAgICBsb2coJy0tLSDlvIDlp4vmibnph4/lr7zlhaUgLS0tJywgJ2luZm8nKTsK" +
  "ICAgICAgICAgICAgCiAgICAgICAgICAgIGlmICghYmF0Y2hUZXh0KSB7CiAgICAgICAgICAgICAg" +
  "ICBsb2coJ+mUmeivr++8mui+k+WFpeahhuS4uuepuicsICdlcnJvcicpOwogICAgICAgICAgICAg" +
  "ICAgc2hvd1RvYXN0KCfinYwg6K+36L6T5YWl5om56YeP5a+85YWl5pWw5o2u77yBJywgJ2Vycm9y" +
  "Jyk7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIGNvbnN0IGxpbmVzID0gYmF0Y2hUZXh0LnNwbGl0KCdcbicpOwogICAgICAgICAg" +
  "ICBsb2coYPCfk4Qg6Kej5p6Q5YiwICR7bGluZXMubGVuZ3RofSDooYzmlbDmja5gLCAnaW5mbycp" +
  "OwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g6YeN572u54q25oCBCiAgICAgICAgICAgIGJh" +
  "dGNoSW1wb3J0U3RhdGUgPSB7CiAgICAgICAgICAgICAgICBpc1Byb2Nlc3Npbmc6IHRydWUsCiAg" +
  "ICAgICAgICAgICAgICBjb21wYW5pZXNUb0ltcG9ydDogW10sCiAgICAgICAgICAgICAgICBuZWVk" +
  "Q29uZmlybTogW10sCiAgICAgICAgICAgICAgICBjdXJyZW50SW5kZXg6IDAsCiAgICAgICAgICAg" +
  "ICAgICBzdWNjZXNzQ291bnQ6IDAsCiAgICAgICAgICAgICAgICBmYWlsQ291bnQ6IDAKICAgICAg" +
  "ICAgICAgfTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOino+aekOaVsOaNru+8iOS9v+eU" +
  "qOaZuuiDveWIhumalOespuino+aekO+8iQogICAgICAgICAgICBsZXQgdXNlZFNlcGFyYXRvciA9" +
  "IG51bGw7CiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKysp" +
  "IHsKICAgICAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTsKICAgICAgICAgICAgICAg" +
  "IGlmICghbGluZS50cmltKCkpIGNvbnRpbnVlOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "ICAgICBjb25zdCBwYXJzZWQgPSBzbWFydFBhcnNlTGluZShsaW5lKTsKICAgICAgICAgICAgICAg" +
  "IGlmIChwYXJzZWQpIHsKICAgICAgICAgICAgICAgICAgICBpZiAoIXVzZWRTZXBhcmF0b3IpIHsK" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgdXNlZFNlcGFyYXRvciA9IHBhcnNlZC5zZXBhcmF0b3I7" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIGxvZyhg5qOA5rWL5Yiw5YiG6ZqU56ym77yaIiR7dXNl" +
  "ZFNlcGFyYXRvcn0iYCwgJ2luZm8nKTsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAg" +
  "ICAgICAgICAgYmF0Y2hJbXBvcnRTdGF0ZS5jb21wYW5pZXNUb0ltcG9ydC5wdXNoKHsgCiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIG5hbWU6IHBhcnNlZC5uYW1lLCAKICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgYWRkcmVzczogcGFyc2VkLmFkZHJlc3MsIAogICAgICAgICAgICAgICAgICAgICAgICBv" +
  "cmlnaW5hbExpbmU6IGxpbmUgCiAgICAgICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAg" +
  "ICB9IGVsc2UgewogICAgICAgICAgICAgICAgICAgIGxvZyhg4p2MIOesrCAke2kgKyAxfSDooYzm" +
  "oLzlvI/ml6Dms5Xor4bliKvvvJoke2xpbmUuc3Vic3RyaW5nKDAsIDUwKX1gLCAnZXJyb3InKTsK" +
  "ICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgICAgICAKICAgICAgICAgICAg" +
  "aWYgKGJhdGNoSW1wb3J0U3RhdGUuY29tcGFuaWVzVG9JbXBvcnQubGVuZ3RoID09PSAwKSB7CiAg" +
  "ICAgICAgICAgICAgICBzaG93VG9hc3QoJ+KdjCDlr7zlhaXmlbDmja7moLzlvI/kuI3mraPnoa7v" +
  "vIEnLCAnZXJyb3InKTsKICAgICAgICAgICAgICAgIHJldHVybjsKICAgICAgICAgICAgfQogICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgbG9nKGDwn5OKIOWHhuWkh+WvvOWFpSAke2JhdGNoSW1wb3J0" +
  "U3RhdGUuY29tcGFuaWVzVG9JbXBvcnQubGVuZ3RofSDlrrblhazlj7hgLCAnaW5mbycpOwogICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgLy8g5pi+56S66L+b5bqm5p2hCiAgICAgICAgICAgIGRvY3Vt" +
  "ZW50LmdldEVsZW1lbnRCeUlkKCdiYXRjaFByb2dyZXNzJykuc3R5bGUuZGlzcGxheSA9ICdibG9j" +
  "ayc7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlvIDlp4vmibnph4/lpITnkIYKICAgICAg" +
  "ICAgICAgYXdhaXQgcHJvY2Vzc0JhdGNoU3RlcCgpOwogICAgICAgIH0KICAgICAgICAKICAgICAg" +
  "ICAvLyDojrflj5ZQT0nnmoTooYzmlL/ljLrvvIjkvJjlhYjku45hZG5hbWXmj5Dlj5bvvIkKICAg" +
  "ICAgICBmdW5jdGlvbiBnZXRQb2lEaXN0cmljdChwb2kpIHsKICAgICAgICAgICAgLy8gYWRuYW1l" +
  "IOaYr+mrmOW+t+eahOWMuuWfn+WQjeensOWtl+aute+8iOWmgiLmnJ3pmLPljLoi77yJCiAgICAg" +
  "ICAgICAgIHJldHVybiBleHRyYWN0RGlzdHJpY3QocG9pLmFkbmFtZSkgfHwgCiAgICAgICAgICAg" +
  "ICAgICAgICBleHRyYWN0RGlzdHJpY3QocG9pLmFkZHJlc3MpIHx8IAogICAgICAgICAgICAgICAg" +
  "ICAgZXh0cmFjdERpc3RyaWN0KHBvaS5wbmFtZSkgfHwKICAgICAgICAgICAgICAgICAgIGV4dHJh" +
  "Y3REaXN0cmljdChwb2kuY2l0eW5hbWUpOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDm" +
  "ibnph4/lpITnkIbmraXpqqQKICAgICAgICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzQmF0Y2hTdGVw" +
  "KCkgewogICAgICAgICAgICBjb25zdCBzdGF0ZSA9IGJhdGNoSW1wb3J0U3RhdGU7CiAgICAgICAg" +
  "ICAgIAogICAgICAgICAgICB3aGlsZSAoc3RhdGUuY3VycmVudEluZGV4IDwgc3RhdGUuY29tcGFu" +
  "aWVzVG9JbXBvcnQubGVuZ3RoKSB7CiAgICAgICAgICAgICAgICBjb25zdCBjb21wYW55ID0gc3Rh" +
  "dGUuY29tcGFuaWVzVG9JbXBvcnRbc3RhdGUuY3VycmVudEluZGV4XTsKICAgICAgICAgICAgICAg" +
  "IAogICAgICAgICAgICAgICAgLy8g5pu05paw6L+b5bqmCiAgICAgICAgICAgICAgICBjb25zdCBw" +
  "cm9ncmVzcyA9ICgoc3RhdGUuY3VycmVudEluZGV4ICsgMSkgLyBzdGF0ZS5jb21wYW5pZXNUb0lt" +
  "cG9ydC5sZW5ndGgpICogMTAwOwogICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5" +
  "SWQoJ3Byb2dyZXNzQmFyJykuc3R5bGUud2lkdGggPSBwcm9ncmVzcyArICclJzsKICAgICAgICAg" +
  "ICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9ncmVzc1RleHQnKS50ZXh0Q29udGVu" +
  "dCA9IGDlpITnkIbkuK0gJHtzdGF0ZS5jdXJyZW50SW5kZXggKyAxfS8ke3N0YXRlLmNvbXBhbmll" +
  "c1RvSW1wb3J0Lmxlbmd0aH0uLi5gOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBs" +
  "b2coYPCflI0gWyR7c3RhdGUuY3VycmVudEluZGV4ICsgMX0vJHtzdGF0ZS5jb21wYW5pZXNUb0lt" +
  "cG9ydC5sZW5ndGh9XSAke2NvbXBhbnkubmFtZX1gLCAnaW5mbycpOwogICAgICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgICAgICB0cnkgewogICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9" +
  "IGF3YWl0IHNlYXJjaEFkZHJlc3NXaXRoRmFsbGJhY2soY29tcGFueS5hZGRyZXNzKTsKICAgICAg" +
  "ICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5w" +
  "b2lzICYmIHJlc3VsdC5wb2lzLmxlbmd0aCA+IDApIHsKICAgICAgICAgICAgICAgICAgICAgICAg" +
  "Ly8g6K+E5YiG5bm25qOA5p+l5piv5ZCm6ZyA6KaB56Gu6K6kCiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIGNvbnN0IHNjb3JlZENhbmRpZGF0ZXMgPSBzY29yZUNhbmRpZGF0ZXMocmVzdWx0LnBvaXMs" +
  "IGNvbXBhbnkuYWRkcmVzcywgY29tcGFueS5uYW1lKTsKICAgICAgICAgICAgICAgICAgICAgICAg" +
  "Y29uc3QgYmVzdENhbmRpZGF0ZSA9IHNjb3JlZENhbmRpZGF0ZXNbMF07CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIGNvbnN0IGlucHV0RGlzdHJpY3QgPSBleHRyYWN0RGlzdHJpY3QoY29tcGFueS5h" +
  "ZGRyZXNzKTsKICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0RGlzdHJpY3QgPSBn" +
  "ZXRQb2lEaXN0cmljdChiZXN0Q2FuZGlkYXRlLnBvaSk7CiAgICAgICAgICAgICAgICAgICAgICAg" +
  "IAogICAgICAgICAgICAgICAgICAgICAgICBsb2coYCAg6L6T5YWl6KGM5pS/5Yy677yaJHtpbnB1" +
  "dERpc3RyaWN0IHx8ICfmnKrmj5Dlj5Ynfe+8jOi/lOWbnuihjOaUv+WMuu+8miR7cmVzdWx0RGlz" +
  "dHJpY3QgfHwgJ+acquaPkOWPlid9YCwgJ2luZm8nKTsKICAgICAgICAgICAgICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWIpOaWreaYr+WQpumcgOimgeS6uuW3peehruiu" +
  "pAogICAgICAgICAgICAgICAgICAgICAgICAvLyDop6blj5HmnaHku7bvvJoKICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgLy8gMS4g6L+U5Zue55qE5piv6YGT6Lev57G75Z6L77yI5aSq56y857uf77yJ" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDIuIFBPSeWQjeensCA8PSAz5Liq5a2X77yI5Y+v" +
  "6IO95aSq566A55Wl77yJCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDMuIOi/lOWbnuWcsOWd" +
  "gOS4reS4jeWQq+aVsOWtl++8iOayoeaciemXqOeJjOWPt++8iQogICAgICAgICAgICAgICAgICAg" +
  "ICAgICAvLyA0LiDliIbmlbDovoPkvY7vvIg8IDYw77yJCiAgICAgICAgICAgICAgICAgICAgICAg" +
  "IGNvbnN0IHBvaSA9IGJlc3RDYW5kaWRhdGUucG9pOwogICAgICAgICAgICAgICAgICAgICAgICBj" +
  "b25zdCBpc1JvYWRUeXBlID0gcG9pLnR5cGUgJiYgKHBvaS50eXBlLmluY2x1ZGVzKCfpgZPot68n" +
  "KSB8fCBwb2kudHlwZS5pbmNsdWRlcygn6KGX6LevJykpOwogICAgICAgICAgICAgICAgICAgICAg" +
  "ICBjb25zdCBpc1Nob3J0TmFtZSA9IHBvaS5uYW1lICYmIHBvaS5uYW1lLmxlbmd0aCA8PSAzOwog" +
  "ICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNOb051bWJlciA9ICFwb2kuYWRkcmVzcyB8" +
  "fCAhcG9pLmFkZHJlc3MubWF0Y2goL1swLTldKy8pOwogICAgICAgICAgICAgICAgICAgICAgICBj" +
  "b25zdCBpc0xvd1Njb3JlID0gYmVzdENhbmRpZGF0ZS5zY29yZSA8IDYwOwogICAgICAgICAgICAg" +
  "ICAgICAgICAgICBjb25zdCBuZWVkQ29uZmlybSA9IGlzUm9hZFR5cGUgfHwgaXNTaG9ydE5hbWUg" +
  "fHwgaGFzTm9OdW1iZXIgfHwgaXNMb3dTY29yZTsKICAgICAgICAgICAgICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgICAgICAgICAgICAgIGlmICghbmVlZENvbmZpcm0pIHsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIC8vIOmrmOe9ruS/oeW6pu+8jOebtOaOpea3u+WKoAogICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgYWRkQ29tcGFueUZyb21Qb2koY29tcGFueS5uYW1lLCBiZXN0Q2FuZGlk" +
  "YXRlLnBvaSwgY29tcGFueS5hZGRyZXNzKTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0" +
  "YXRlLnN1Y2Nlc3NDb3VudCsrOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKGAgIOKc" +
  "hSDoh6rliqjlr7zlhaXvvJoke2Jlc3RDYW5kaWRhdGUucG9pLm5hbWV9IFske3Jlc3VsdERpc3Ry" +
  "aWN0fV1gLCAnc3VjY2VzcycpOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUuY3Vy" +
  "cmVudEluZGV4Kys7CiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7CiAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAvLyDpnIDopoHnoa7orqQgLSDmmoLlgZzlvqrnjq/nrYnlvoXnlKjm" +
  "iLfpgInmi6kKICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlYXNvbnMgPSBbXTsK" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1JvYWRUeXBlKSByZWFzb25zLnB1c2go" +
  "J+mBk+i3r+exu+WeiycpOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzU2hvcnRO" +
  "YW1lKSByZWFzb25zLnB1c2goJ+WQjeensOeugOeVpScpOwogICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgaWYgKGhhc05vTnVtYmVyKSByZWFzb25zLnB1c2goJ+aXoOmXqOeJjOWPtycpOwogICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzTG93U2NvcmUpIHJlYXNvbnMucHVzaCgn572u" +
  "5L+h5bqm5L2OJyk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIGxvZyhgICDimqDvuI8g6ZyA6KaB56Gu6K6k77yIJHtyZWFzb25zLmpvaW4o" +
  "J+OAgScpfe+8ie+8miR7cG9pLm5hbWV9IFske3Jlc3VsdERpc3RyaWN0fV1gLCAnd2FybmluZycp" +
  "OwogICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvd0JhdGNoQ29uZmlybUFuZFdhaXQoY29t" +
  "cGFueSwgc2NvcmVkQ2FuZGlkYXRlcywgKHNlbGVjdGVkKSA9PiB7CiAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgaWYgKHNlbGVjdGVkKSB7CiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIGNvbXBhbmllcy5wdXNoKHNlbGVjdGVkKTsKICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgc3RhdGUuc3VjY2Vzc0NvdW50Kys7CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgIGxvZyhgICDinIUg5omL5Yqo6YCJ5oup5re75YqgYCwgJ3N1Y2Nlc3Mn" +
  "KTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICAvLyDnlKjmiLfot7Pov4fvvIzliqDlhaXlvoXnoa7orqTl" +
  "iJfooagKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkVG9QZW5kaW5nTGlz" +
  "dChjb21wYW55KTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nKGAgIOKP" +
  "re+4jyDnlKjmiLfot7Pov4fvvIzliqDlhaXlvoXnoa7orqTliJfooahgLCAnd2FybmluZycpOwog" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICBzdGF0ZS5jdXJyZW50SW5kZXgrKzsKICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAvLyDnu6fnu63lpITnkIbkuIvkuIDkuKoKICAgICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICBzZXRUaW1lb3V0KCgpID0+IHByb2Nlc3NCYXRjaFN0ZXAoKSwgMTAwKTsKICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJu" +
  "OyAvLyDmmoLlgZzlvqrnjq/vvIznrYnlvoXlm57osIMKICAgICAgICAgICAgICAgICAgICAgICAg" +
  "fQogICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7CiAgICAgICAgICAgICAgICAgICAgICAgIGxv" +
  "ZyhgICDinYwg5pyq5om+5Yiw5Zyw5Z2AYCwgJ2Vycm9yJyk7CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIHN0YXRlLmZhaWxDb3VudCsrOwogICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZS5jdXJy" +
  "ZW50SW5kZXgrKzsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICB9IGNhdGNo" +
  "IChlcnJvcikgewogICAgICAgICAgICAgICAgICAgIGxvZyhgICDinYwg5pCc57Si5aSx6LSl77ya" +
  "JHtlcnJvci5tZXNzYWdlfWAsICdlcnJvcicpOwogICAgICAgICAgICAgICAgICAgIHN0YXRlLmZh" +
  "aWxDb3VudCsrOwogICAgICAgICAgICAgICAgICAgIHN0YXRlLmN1cnJlbnRJbmRleCsrOwogICAg" +
  "ICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyDlu7bov5/p" +
  "gb/lhY1BUEnpmZDliLYKICAgICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUg" +
  "PT4gc2V0VGltZW91dChyZXNvbHZlLCAzMDApKTsKICAgICAgICAgICAgfQogICAgICAgICAgICAK" +
  "ICAgICAgICAgICAgLy8g5YWo6YOo5aSE55CG5a6M5oiQCiAgICAgICAgICAgIGJhdGNoSW1wb3J0" +
  "Q29tcGxldGUoKTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5pCc57Si5Zyw5Z2A77yI" +
  "5bim5aSH6YCJ5YWz6ZSu6K+N77yJCiAgICAgICAgZnVuY3Rpb24gc2VhcmNoQWRkcmVzc1dpdGhG" +
  "YWxsYmFjayhhZGRyZXNzKSB7CiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2" +
  "ZSkgPT4gewogICAgICAgICAgICAgICAgLy8g56ys5LiA5qyh5pCc57Si77ya5a6M5pW05Zyw5Z2A" +
  "CiAgICAgICAgICAgICAgICBwbGFjZVNlYXJjaC5zZWFyY2goYWRkcmVzcywgZnVuY3Rpb24oc3Rh" +
  "dHVzLCByZXN1bHQpIHsKICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHVzID09PSAnY29tcGxl" +
  "dGUnICYmIHJlc3VsdC5wb2lMaXN0ICYmIHJlc3VsdC5wb2lMaXN0LnBvaXMubGVuZ3RoID4gMCkg" +
  "ewogICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgcG9pczogcmVzdWx0LnBvaUxpc3Qu" +
  "cG9pcywgc291cmNlOiAnb3JpZ2luYWwnIH0pOwogICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOesrOS6jOasoeaQnOe0ou+8mueugOWMluWFs+mU" +
  "ruivje+8iOaPkOWPluaguOW/g+WcsOeCueivje+8iQogICAgICAgICAgICAgICAgICAgICAgICBj" +
  "b25zdCBzaW1wbGlmaWVkID0gc2ltcGxpZnlBZGRyZXNzKGFkZHJlc3MpOwogICAgICAgICAgICAg" +
  "ICAgICAgICAgICBsb2coYCAg8J+UhCDlsJ3or5XnroDljJbmkJzntKLvvJoke3NpbXBsaWZpZWR9" +
  "YCwgJ2luZm8nKTsKICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIHBsYWNlU2VhcmNoLnNlYXJjaChzaW1wbGlmaWVkLCBmdW5jdGlvbihzdGF0dXMyLCByZXN1" +
  "bHQyKSB7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHVzMiA9PT0gJ2NvbXBs" +
  "ZXRlJyAmJiByZXN1bHQyLnBvaUxpc3QgJiYgcmVzdWx0Mi5wb2lMaXN0LnBvaXMubGVuZ3RoID4g" +
  "MCkgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBwb2lzOiByZXN1" +
  "bHQyLnBvaUxpc3QucG9pcywgc291cmNlOiAnc2ltcGxpZmllZCcgfSk7CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJl" +
  "c29sdmUobnVsbCk7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0pOwog" +
  "ICAgICAgICAgICB9KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g566A5YyW5Zyw5Z2A" +
  "5YWz6ZSu6K+NCiAgICAgICAgZnVuY3Rpb24gc2ltcGxpZnlBZGRyZXNzKGFkZHJlc3MpIHsKICAg" +
  "ICAgICAgICAgLy8g56e76Zmk5qW85bGC44CB5oi/6Ze05Y+3562J57uG6IqCCiAgICAgICAgICAg" +
  "IGxldCBzaW1wbGlmaWVkID0gYWRkcmVzcwogICAgICAgICAgICAgICAgLnJlcGxhY2UoL1swLTld" +
  "K+Wxgi9nLCAnJykKICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9bMC05XSvlrqQvZywgJycpCiAg" +
  "ICAgICAgICAgICAgICAucmVwbGFjZSgvWzAtOV0r5Y+3L2csICcnKQogICAgICAgICAgICAgICAg" +
  "LnJlcGxhY2UoL1swLTldK+agiy9nLCAnJykKICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9bMC05" +
  "XSvljZXlhYMvZywgJycpCiAgICAgICAgICAgICAgICAucmVwbGFjZSgvWzAtOV0r5Y+35qW8L2cs" +
  "ICcnKQogICAgICAgICAgICAgICAgLnJlcGxhY2UoL0FbMC05XSrluqcvZywgJycpCiAgICAgICAg" +
  "ICAgICAgICAucmVwbGFjZSgvQlswLTldKuW6py9nLCAnJykKICAgICAgICAgICAgICAgIC5yZXBs" +
  "YWNlKC9ccysvZywgJyAnKQogICAgICAgICAgICAgICAgLnRyaW0oKTsKICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIC8vIOWmguaenOi/mOW+iOmVv++8jOWPquS/neeVmeWIsCLot68v6KGXL+Wkp+mB" +
  "kyLkuLrmraIKICAgICAgICAgICAgY29uc3Qgcm9hZE1hdGNoID0gc2ltcGxpZmllZC5tYXRjaCgv" +
  "KC4rP1vot6/ooZfpgZPlpKfpgZNdKS8pOwogICAgICAgICAgICBpZiAocm9hZE1hdGNoICYmIHJv" +
  "YWRNYXRjaFsxXS5sZW5ndGggPiA1KSB7CiAgICAgICAgICAgICAgICBzaW1wbGlmaWVkID0gcm9h" +
  "ZE1hdGNoWzFdOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICByZXR1cm4g" +
  "c2ltcGxpZmllZCB8fCBhZGRyZXNzOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDku45Q" +
  "T0nmt7vliqDlhazlj7gKICAgICAgICBmdW5jdGlvbiBhZGRDb21wYW55RnJvbVBvaShuYW1lLCBw" +
  "b2ksIGZhbGxiYWNrQWRkcmVzcykgewogICAgICAgICAgICBjb25zdCBjb21wYW55ID0gewogICAg" +
  "ICAgICAgICAgICAgaWQ6IERhdGUubm93KCkgKyBNYXRoLnJhbmRvbSgpLAogICAgICAgICAgICAg" +
  "ICAgbmFtZTogbmFtZSwKICAgICAgICAgICAgICAgIGFkZHJlc3M6IHBvaS5hZGRyZXNzIHx8IGZh" +
  "bGxiYWNrQWRkcmVzcywKICAgICAgICAgICAgICAgIGxuZzogcG9pLmxvY2F0aW9uLmxuZywKICAg" +
  "ICAgICAgICAgICAgIGxhdDogcG9pLmxvY2F0aW9uLmxhdAogICAgICAgICAgICB9OwogICAgICAg" +
  "ICAgICBjb21wYW5pZXMucHVzaChjb21wYW55KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAg" +
  "Ly8g5pi+56S65om56YeP56Gu6K6k5bm2562J5b6F55So5oi36YCJ5oup77yI566A5YyW54mI77yM" +
  "5peg5Zyw5Zu+6aKE6KeI77yJCiAgICAgICAgZnVuY3Rpb24gc2hvd0JhdGNoQ29uZmlybUFuZFdh" +
  "aXQoY29tcGFueSwgc2NvcmVkQ2FuZGlkYXRlcywgY2FsbGJhY2spIHsKICAgICAgICAgICAgY29u" +
  "c3QgaW5wdXREaXN0cmljdCA9IGV4dHJhY3REaXN0cmljdChjb21wYW55LmFkZHJlc3MpOwogICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgLy8g5p6E5bu65by556qX5YaF5a65CiAgICAgICAgICAgIGxl" +
  "dCBodG1sID0gYAogICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDogd2hpdGU7" +
  "IGJvcmRlci1yYWRpdXM6IDEwcHg7IG1heC13aWR0aDogNTAwcHg7IHdpZHRoOiA5NSU7IG1heC1o" +
  "ZWlnaHQ6IDgwdmg7IG92ZXJmbG93OiBoaWRkZW47IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0" +
  "aW9uOiBjb2x1bW47IiBvbmNsaWNrPSJldmVudC5zdG9wUHJvcGFnYXRpb24oKSI+CiAgICAgICAg" +
  "ICAgICAgICAgICAgPGRpdiBzdHlsZT0icGFkZGluZzogMTVweCAyMHB4OyBiYWNrZ3JvdW5kOiBs" +
  "aW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjZjU5ZTBiIDAlLCAjZDk3NzA2IDEwMCUpOyBjb2xvcjog" +
  "d2hpdGU7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgPGgzIHN0eWxlPSJtYXJnaW46IDA7IGZv" +
  "bnQtc2l6ZTogMTZweDsiPuKaoO+4jyDor7fpgInmi6nmraPnoa7kvY3nva4gKCR7YmF0Y2hJbXBv" +
  "cnRTdGF0ZS5jdXJyZW50SW5kZXggKyAxfS8ke2JhdGNoSW1wb3J0U3RhdGUuY29tcGFuaWVzVG9J" +
  "bXBvcnQubGVuZ3RofSk8L2gzPgogICAgICAgICAgICAgICAgICAgICAgICA8cCBzdHlsZT0ibWFy" +
  "Z2luOiA1cHggMCAwIDA7IGZvbnQtc2l6ZTogMTNweDsgZm9udC13ZWlnaHQ6IDYwMDsiPiR7Y29t" +
  "cGFueS5uYW1lfTwvcD4KICAgICAgICAgICAgICAgICAgICAgICAgPHAgc3R5bGU9Im1hcmdpbjog" +
  "M3B4IDAgMCAwOyBmb250LXNpemU6IDExcHg7IG9wYWNpdHk6IDAuOTsiPui+k+WFpe+8miR7Y29t" +
  "cGFueS5hZGRyZXNzfTwvcD4KICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAg" +
  "ICAgICAgICA8ZGl2IHN0eWxlPSJwYWRkaW5nOiAxNXB4OyBvdmVyZmxvdy15OiBhdXRvOyBmbGV4" +
  "OiAxOyBtYXgtaGVpZ2h0OiA0MDBweDsiPgogICAgICAgICAgICBgOwogICAgICAgICAgICAKICAg" +
  "ICAgICAgICAgLy8g5pi+56S65YCZ6YCJ77yI5pyA5aSaNuS4qu+8iQogICAgICAgICAgICBzY29y" +
  "ZWRDYW5kaWRhdGVzLnNsaWNlKDAsIDgpLmZvckVhY2goKGNhbmRpZGF0ZSwgaW5kZXgpID0+IHsK" +
  "ICAgICAgICAgICAgICAgIGNvbnN0IHBvaSA9IGNhbmRpZGF0ZS5wb2k7CiAgICAgICAgICAgICAg" +
  "ICBjb25zdCBkaXN0cmljdCA9IGdldFBvaURpc3RyaWN0KHBvaSkgfHwgJ+acquefpSc7CiAgICAg" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgICAgIGxldCBib3JkZXJDb2xvciA9ICcjZTBlMGUwJzsK" +
  "ICAgICAgICAgICAgICAgIGxldCBiZ0NvbG9yID0gJyNmYWZhZmEnOwogICAgICAgICAgICAgICAg" +
  "bGV0IGJhZGdlID0gJyc7CiAgICAgICAgICAgICAgICBsZXQgaWNvbiA9ICfwn5ONJzsKICAgICAg" +
  "ICAgICAgICAgIAogICAgICAgICAgICAgICAgaWYgKGNhbmRpZGF0ZS5pc1JlY29tbWVuZGVkKSB7" +
  "CiAgICAgICAgICAgICAgICAgICAgYm9yZGVyQ29sb3IgPSAnIzEwYjk4MSc7CiAgICAgICAgICAg" +
  "ICAgICAgICAgYmdDb2xvciA9ICcjZWNmZGY1JzsKICAgICAgICAgICAgICAgICAgICBiYWRnZSA9" +
  "ICc8c3BhbiBzdHlsZT0iYmFja2dyb3VuZDogIzEwYjk4MTsgY29sb3I6IHdoaXRlOyBwYWRkaW5n" +
  "OiAycHggOHB4OyBib3JkZXItcmFkaXVzOiAxMHB4OyBmb250LXNpemU6IDExcHg7IG1hcmdpbi1s" +
  "ZWZ0OiA4cHg7Ij7irZAg5o6o6I2QPC9zcGFuPic7CiAgICAgICAgICAgICAgICAgICAgaWNvbiA9" +
  "ICfinIUnOwogICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjYW5kaWRhdGUud2FybmluZ3MubGVu" +
  "Z3RoID4gMCkgewogICAgICAgICAgICAgICAgICAgIGJvcmRlckNvbG9yID0gJyNlZjQ0NDQnOwog" +
  "ICAgICAgICAgICAgICAgICAgIGJnQ29sb3IgPSAnI2ZlZjJmMic7CiAgICAgICAgICAgICAgICAg" +
  "ICAgYmFkZ2UgPSAnPHNwYW4gc3R5bGU9ImJhY2tncm91bmQ6ICNlZjQ0NDQ7IGNvbG9yOiB3aGl0" +
  "ZTsgcGFkZGluZzogMnB4IDhweDsgYm9yZGVyLXJhZGl1czogMTBweDsgZm9udC1zaXplOiAxMXB4" +
  "OyBtYXJnaW4tbGVmdDogOHB4OyI+4pqg77iPIOS4jeWMuemFjTwvc3Bhbj4nOwogICAgICAgICAg" +
  "ICAgICAgICAgIGljb24gPSAn4p2MJzsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAg" +
  "IAogICAgICAgICAgICAgICAgaHRtbCArPSBgCiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD0i" +
  "Y2FuZGlkYXRlLSR7aW5kZXh9IiAKICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPSJib3Jk" +
  "ZXI6IDJweCBzb2xpZCAke2JvcmRlckNvbG9yfTsgYmFja2dyb3VuZDogJHtiZ0NvbG9yfTsgYm9y" +
  "ZGVyLXJhZGl1czogOHB4OyBwYWRkaW5nOiAxMnB4OyBtYXJnaW4tYm90dG9tOiAxMHB4OyBjdXJz" +
  "b3I6IHBvaW50ZXI7IHRyYW5zaXRpb246IGFsbCAwLjJzOyIKICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIG9ubW91c2VvdmVyPSJ0aGlzLnN0eWxlLmJveFNoYWRvdz0nMCAycHggOHB4IHJnYmEoMCww" +
  "LDAsMC4xKSc7IHRoaXMuc3R5bGUuYm9yZGVyQ29sb3I9JyM2NjdlZWEnIiAKICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIG9ubW91c2VvdXQ9InRoaXMuc3R5bGUuYm94U2hhZG93PSdub25lJzsgdGhp" +
  "cy5zdHlsZS5ib3JkZXJDb2xvcj0nJHtib3JkZXJDb2xvcn0nIgogICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgb25jbGljaz0ic2VsZWN0QmF0Y2hDYW5kaWRhdGUoJHtpbmRleH0pIj4KICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50" +
  "OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogc3RhcnQ7Ij4KICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIDxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OiA2MDA7IGNvbG9yOiAjMzMzOyBmb250" +
  "LXNpemU6IDE0cHg7Ij4ke2ljb259ICR7cG9pLm5hbWV9ICR7YmFkZ2V9PC9kaXY+CiAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6IDExcHg7IGNvbG9yOiAj" +
  "NjY2OyBiYWNrZ3JvdW5kOiAjZjBmMGYwOyBwYWRkaW5nOiAycHggOHB4OyBib3JkZXItcmFkaXVz" +
  "OiA0cHg7Ij4ke2Rpc3RyaWN0feWMujwvZGl2PgogICAgICAgICAgICAgICAgICAgICAgICA8L2Rp" +
  "dj4KICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOiAxMnB4OyBj" +
  "b2xvcjogIzY2NjsgbWFyZ2luLXRvcDogNnB4OyBsaW5lLWhlaWdodDogMS40OyI+CiAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAke3BvaS5hZGRyZXNzIHx8ICfmmoLml6Dor6bnu4blnLDlnYAn" +
  "fQogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAgICAg" +
  "JHtjYW5kaWRhdGUucmVhc29ucy5sZW5ndGggPiAwID8gYDxkaXYgc3R5bGU9ImZvbnQtc2l6ZTog" +
  "MTFweDsgY29sb3I6ICMwNTk2Njk7IG1hcmdpbi10b3A6IDZweDsiPiR7Y2FuZGlkYXRlLnJlYXNv" +
  "bnMuam9pbignIMK3ICcpfTwvZGl2PmAgOiAnJ30KICAgICAgICAgICAgICAgICAgICAgICAgJHtj" +
  "YW5kaWRhdGUud2FybmluZ3MubGVuZ3RoID4gMCA/IGA8ZGl2IHN0eWxlPSJmb250LXNpemU6IDEx" +
  "cHg7IGNvbG9yOiAjZGMyNjI2OyBtYXJnaW4tdG9wOiA2cHg7Ij4ke2NhbmRpZGF0ZS53YXJuaW5n" +
  "cy5qb2luKCcgwrcgJyl9PC9kaXY+YCA6ICcnfQogICAgICAgICAgICAgICAgICAgIDwvZGl2Pgog" +
  "ICAgICAgICAgICAgICAgYDsKICAgICAgICAgICAgfSk7CiAgICAgICAgICAgIAogICAgICAgICAg" +
  "ICAvLyDlpoLmnpzmsqHmnInmjqjojZDnu5PmnpzvvIzmj5DnpLrnlKjmiLcKICAgICAgICAgICAg" +
  "Y29uc3QgaGFzUmVjb21tZW5kZWQgPSBzY29yZWRDYW5kaWRhdGVzLnNvbWUoYyA9PiBjLmlzUmVj" +
  "b21tZW5kZWQpOwogICAgICAgICAgICBpZiAoIWhhc1JlY29tbWVuZGVkKSB7CiAgICAgICAgICAg" +
  "ICAgICBodG1sICs9IGAKICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5k" +
  "OiAjZmZmM2NkOyBib3JkZXI6IDFweCBzb2xpZCAjZmZjMTA3OyBib3JkZXItcmFkaXVzOiA2cHg7" +
  "IHBhZGRpbmc6IDEycHg7IG1hcmdpbjogMTBweCAwOyBmb250LXNpemU6IDEycHg7IGNvbG9yOiAj" +
  "ODU2NDA0OyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+4pqg77iPIOacquaJvuWI" +
  "sOS4juaCqOi+k+WFpeeahCIke2lucHV0RGlzdHJpY3QgfHwgJ+aMh+WumuWMuuWfnyd9IuWujOWF" +
  "qOWMuemFjeeahOe7k+aenDwvc3Ryb25nPjxicj4KICAgICAgICAgICAgICAgICAgICAgICAg5bu6" +
  "6K6u77ya5bCd6K+V5L2/55So5LiL5pa55pCc57Si5qGG6YeN5paw5pCc57SiCiAgICAgICAgICAg" +
  "ICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICBgOwogICAgICAgICAgICB9CiAgICAgICAg" +
  "ICAgIAogICAgICAgICAgICBodG1sICs9IGAKICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAg" +
  "ICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJwYWRkaW5nOiAxNXB4OyBib3JkZXItdG9wOiAx" +
  "cHggc29saWQgI2VlZTsgYmFja2dyb3VuZDogI2Y4ZjlmYTsiPgogICAgICAgICAgICAgICAgICAg" +
  "ICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OiBmbGV4OyBnYXA6IDEwcHg7IG1hcmdpbi1ib3R0b206" +
  "IDEwcHg7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPSJ0ZXh0IiBp" +
  "ZD0ibWFudWFsU2VhcmNoSW5wdXQiIHBsYWNlaG9sZGVyPSLph43mlrDmkJzntKLlhbPplK7or40u" +
  "Li4iIHN0eWxlPSJmbGV4OiAxOyBwYWRkaW5nOiA4cHggMTJweDsgYm9yZGVyOiAxcHggc29saWQg" +
  "I2RkZDsgYm9yZGVyLXJhZGl1czogNHB4OyBmb250LXNpemU6IDEzcHg7Ij4KICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0ibWFudWFsU2VhcmNoSW5CYXRjaCgpIiBz" +
  "dHlsZT0icGFkZGluZzogOHB4IDE2cHg7IGJvcmRlcjogbm9uZTsgYmFja2dyb3VuZDogIzY2N2Vl" +
  "YTsgY29sb3I6IHdoaXRlOyBib3JkZXItcmFkaXVzOiA0cHg7IGZvbnQtc2l6ZTogMTNweDsgY3Vy" +
  "c29yOiBwb2ludGVyOyI+8J+UjSDmkJzntKI8L2J1dHRvbj4KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6IGZs" +
  "ZXg7IGdhcDogMTBweDsiPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBvbmNs" +
  "aWNrPSJza2lwQmF0Y2hDYW5kaWRhdGUoKSIgc3R5bGU9ImZsZXg6IDE7IHBhZGRpbmc6IDEwcHg7" +
  "IGJvcmRlcjogMXB4IHNvbGlkICNkZGQ7IGJhY2tncm91bmQ6IHdoaXRlOyBib3JkZXItcmFkaXVz" +
  "OiA2cHg7IGN1cnNvcjogcG9pbnRlcjsgZm9udC1zaXplOiAxM3B4OyI+4o+t77iPIOi3s+i/h+at" +
  "pOmhuTwvYnV0dG9uPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBvbmNsaWNr" +
  "PSJzdG9wQmF0Y2hJbXBvcnQoKSIgc3R5bGU9ImZsZXg6IDE7IHBhZGRpbmc6IDEwcHg7IGJvcmRl" +
  "cjogMXB4IHNvbGlkICNlZjQ0NDQ7IGJhY2tncm91bmQ6ICNmZWYyZjI7IGNvbG9yOiAjZWY0NDQ0" +
  "OyBib3JkZXItcmFkaXVzOiA2cHg7IGN1cnNvcjogcG9pbnRlcjsgZm9udC1zaXplOiAxM3B4OyI+" +
  "8J+bkSDnu5PmnZ/lr7zlhaU8L2J1dHRvbj4KICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+" +
  "CiAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAg" +
  "ICAgICAgYDsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOWIm+W7uuaooeaAgeahhu+8iOmY" +
  "suatouS6i+S7tuWGkuazoe+8iQogICAgICAgICAgICBsZXQgbW9kYWwgPSBkb2N1bWVudC5nZXRF" +
  "bGVtZW50QnlJZCgnYmF0Y2hDb25maXJtTW9kYWwnKTsKICAgICAgICAgICAgaWYgKCFtb2RhbCkg" +
  "ewogICAgICAgICAgICAgICAgbW9kYWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsK" +
  "ICAgICAgICAgICAgICAgIG1vZGFsLmlkID0gJ2JhdGNoQ29uZmlybU1vZGFsJzsKICAgICAgICAg" +
  "ICAgICAgIG1vZGFsLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGZpeGVkOyB0b3A6IDA7IGxl" +
  "ZnQ6IDA7IHJpZ2h0OiAwOyBib3R0b206IDA7IGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsMC42KTsg" +
  "ZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50" +
  "ZXI7IHotaW5kZXg6IDEwMDAxOyc7CiAgICAgICAgICAgICAgICBtb2RhbC5vbmNsaWNrID0gZnVu" +
  "Y3Rpb24oZSkgewogICAgICAgICAgICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gbW9kYWwpIHsK" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfor7fngrnlh7si6Lez6L+H5q2k6aG5" +
  "IuaIliLnu5PmnZ/lr7zlhaUiJywgJ3dhcm5pbmcnKTsKICAgICAgICAgICAgICAgICAgICB9CiAg" +
  "ICAgICAgICAgICAgICB9OwogICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGls" +
  "ZChtb2RhbCk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgbW9kYWwuaW5uZXJIVE1MID0gaHRt" +
  "bDsKICAgICAgICAgICAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4JzsKICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgIC8vIOS/neWtmOaVsOaNruWIsOWFqOWxgAogICAgICAgICAgICB3aW5kb3cu" +
  "YmF0Y2hDb25maXJtQ2FsbGJhY2sgPSBjYWxsYmFjazsKICAgICAgICAgICAgd2luZG93LmJhdGNo" +
  "Q29uZmlybUNhbmRpZGF0ZXMgPSBzY29yZWRDYW5kaWRhdGVzOwogICAgICAgICAgICB3aW5kb3cu" +
  "YmF0Y2hDb25maXJtQ29tcGFueSA9IGNvbXBhbnk7CiAgICAgICAgfQogICAgICAgIAogICAgICAg" +
  "IC8vIOmAieaLqeaJuemHj+WvvOWFpeeahOWAmemAiQogICAgICAgIGZ1bmN0aW9uIHNlbGVjdEJh" +
  "dGNoQ2FuZGlkYXRlKGluZGV4KSB7CiAgICAgICAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHdpbmRv" +
  "dy5iYXRjaENvbmZpcm1DYW5kaWRhdGVzW2luZGV4XTsKICAgICAgICAgICAgY29uc3QgY29tcGFu" +
  "eSA9IHdpbmRvdy5iYXRjaENvbmZpcm1Db21wYW55OwogICAgICAgICAgICAKICAgICAgICAgICAg" +
  "aWYgKCFjYW5kaWRhdGUgfHwgIWNhbmRpZGF0ZS5wb2kpIHJldHVybjsKICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIC8vIOa4hemZpOmihOiniOagh+iusAogICAgICAgICAgICBpZiAod2luZG93LnBy" +
  "ZXZpZXdNYXJrZXIpIHsKICAgICAgICAgICAgICAgIG1hcC5yZW1vdmUod2luZG93LnByZXZpZXdN" +
  "YXJrZXIpOwogICAgICAgICAgICAgICAgd2luZG93LnByZXZpZXdNYXJrZXIgPSBudWxsOwogICAg" +
  "ICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICBjb25zdCBzZWxlY3RlZCA9IHsKICAg" +
  "ICAgICAgICAgICAgIGlkOiBEYXRlLm5vdygpICsgTWF0aC5yYW5kb20oKSwKICAgICAgICAgICAg" +
  "ICAgIG5hbWU6IGNvbXBhbnkubmFtZSwKICAgICAgICAgICAgICAgIGFkZHJlc3M6IGNhbmRpZGF0" +
  "ZS5wb2kuYWRkcmVzcyB8fCBjb21wYW55LmFkZHJlc3MsCiAgICAgICAgICAgICAgICBsbmc6IGNh" +
  "bmRpZGF0ZS5wb2kubG9jYXRpb24ubG5nLAogICAgICAgICAgICAgICAgbGF0OiBjYW5kaWRhdGUu" +
  "cG9pLmxvY2F0aW9uLmxhdAogICAgICAgICAgICB9OwogICAgICAgICAgICAKICAgICAgICAgICAg" +
  "Y2xvc2VCYXRjaENvbmZpcm1Nb2RhbCgpOwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g5pu0" +
  "5paw55WM6Z2iCiAgICAgICAgICAgIHNhdmVUb0xvY2FsU3RvcmFnZSgpOwogICAgICAgICAgICBy" +
  "ZW5kZXJDb21wYW55TGlzdCgpOwogICAgICAgICAgICByZW5kZXJNYXJrZXJzKCk7CiAgICAgICAg" +
  "ICAgIAogICAgICAgICAgICBpZiAod2luZG93LmJhdGNoQ29uZmlybUNhbGxiYWNrKSB7CiAgICAg" +
  "ICAgICAgICAgICB3aW5kb3cuYmF0Y2hDb25maXJtQ2FsbGJhY2soc2VsZWN0ZWQpOwogICAgICAg" +
  "ICAgICB9CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOWcqOaJuemHj+WvvOWFpeS4reaJ" +
  "i+WKqOaQnOe0ogogICAgICAgIGZ1bmN0aW9uIG1hbnVhbFNlYXJjaEluQmF0Y2goKSB7CiAgICAg" +
  "ICAgICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21hbnVhbFNlYXJj" +
  "aElucHV0Jyk7CiAgICAgICAgICAgIGNvbnN0IGtleXdvcmQgPSBpbnB1dC52YWx1ZS50cmltKCk7" +
  "CiAgICAgICAgICAgIAogICAgICAgICAgICBpZiAoIWtleXdvcmQpIHsKICAgICAgICAgICAgICAg" +
  "IHNob3dUb2FzdCgn6K+36L6T5YWl5pCc57Si5YWz6ZSu6K+NJywgJ3dhcm5pbmcnKTsKICAgICAg" +
  "ICAgICAgICAgIHJldHVybjsKICAgICAgICAgICAgfQogICAgICAgICAgICAKICAgICAgICAgICAg" +
  "bG9nKGDwn5SNIOaJi+WKqOaQnOe0ou+8miR7a2V5d29yZH1gLCAnaW5mbycpOwogICAgICAgICAg" +
  "ICAKICAgICAgICAgICAgcGxhY2VTZWFyY2guc2VhcmNoKGtleXdvcmQsIGZ1bmN0aW9uKHN0YXR1" +
  "cywgcmVzdWx0KSB7CiAgICAgICAgICAgICAgICBpZiAoc3RhdHVzID09PSAnY29tcGxldGUnICYm" +
  "IHJlc3VsdC5wb2lMaXN0ICYmIHJlc3VsdC5wb2lMaXN0LnBvaXMubGVuZ3RoID4gMCkgewogICAg" +
  "ICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhbnkgPSB3aW5kb3cuYmF0Y2hDb25maXJtQ29tcGFu" +
  "eTsKICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdDYW5kaWRhdGVzID0gc2NvcmVDYW5kaWRh" +
  "dGVzKHJlc3VsdC5wb2lMaXN0LnBvaXMsIGtleXdvcmQsIGNvbXBhbnkubmFtZSk7CiAgICAgICAg" +
  "ICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgbG9nKGDinIUg5om+5YiwICR7bmV3Q2Fu" +
  "ZGlkYXRlcy5sZW5ndGh9IOS4quaWsOe7k+aenGAsICdzdWNjZXNzJyk7CiAgICAgICAgICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g5YWz6Zet5pen5by556qX77yM5pi+56S65paw" +
  "57uT5p6cCiAgICAgICAgICAgICAgICAgICAgY2xvc2VCYXRjaENvbmZpcm1Nb2RhbCgpOwogICAg" +
  "ICAgICAgICAgICAgICAgIHNob3dCYXRjaENvbmZpcm1BbmRXYWl0KGNvbXBhbnksIG5ld0NhbmRp" +
  "ZGF0ZXMsIHdpbmRvdy5iYXRjaENvbmZpcm1DYWxsYmFjayk7CiAgICAgICAgICAgICAgICB9IGVs" +
  "c2UgewogICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5pyq5om+5Yiw57uT5p6c77yM6K+3" +
  "5bCd6K+V5YW25LuW5YWz6ZSu6K+NJywgJ2Vycm9yJyk7CiAgICAgICAgICAgICAgICB9CiAgICAg" +
  "ICAgICAgIH0pOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDot7Pov4fmibnph4/lr7zl" +
  "haXnmoTpobkKICAgICAgICBmdW5jdGlvbiBza2lwQmF0Y2hDYW5kaWRhdGUoKSB7CiAgICAgICAg" +
  "ICAgIC8vIOa4hemZpOmihOiniOagh+iusAogICAgICAgICAgICBpZiAod2luZG93LnByZXZpZXdN" +
  "YXJrZXIpIHsKICAgICAgICAgICAgICAgIG1hcC5yZW1vdmUod2luZG93LnByZXZpZXdNYXJrZXIp" +
  "OwogICAgICAgICAgICAgICAgd2luZG93LnByZXZpZXdNYXJrZXIgPSBudWxsOwogICAgICAgICAg" +
  "ICB9CiAgICAgICAgICAgIAogICAgICAgICAgICBjbG9zZUJhdGNoQ29uZmlybU1vZGFsKCk7CiAg" +
  "ICAgICAgICAgIGlmICh3aW5kb3cuYmF0Y2hDb25maXJtQ2FsbGJhY2spIHsKICAgICAgICAgICAg" +
  "ICAgIHdpbmRvdy5iYXRjaENvbmZpcm1DYWxsYmFjayhudWxsKTsKICAgICAgICAgICAgfQogICAg" +
  "ICAgIH0KICAgICAgICAKICAgICAgICAvLyDlgZzmraLmibnph4/lr7zlhaUKICAgICAgICBmdW5j" +
  "dGlvbiBzdG9wQmF0Y2hJbXBvcnQoKSB7CiAgICAgICAgICAgIC8vIOa4hemZpOmihOiniOagh+iu" +
  "sAogICAgICAgICAgICBpZiAod2luZG93LnByZXZpZXdNYXJrZXIpIHsKICAgICAgICAgICAgICAg" +
  "IG1hcC5yZW1vdmUod2luZG93LnByZXZpZXdNYXJrZXIpOwogICAgICAgICAgICAgICAgd2luZG93" +
  "LnByZXZpZXdNYXJrZXIgPSBudWxsOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAg" +
  "ICAgICBjbG9zZUJhdGNoQ29uZmlybU1vZGFsKCk7CiAgICAgICAgICAgIGJhdGNoSW1wb3J0U3Rh" +
  "dGUuaXNQcm9jZXNzaW5nID0gZmFsc2U7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlrozm" +
  "iJDlvZPliY3lt7LlpITnkIbnmoQKICAgICAgICAgICAgYmF0Y2hJbXBvcnRDb21wbGV0ZSgpOwog" +
  "ICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDlhbPpl63mibnph4/noa7orqTmqKHmgIHmoYYK" +
  "ICAgICAgICBmdW5jdGlvbiBjbG9zZUJhdGNoQ29uZmlybU1vZGFsKCkgewogICAgICAgICAgICBj" +
  "b25zdCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXRjaENvbmZpcm1Nb2RhbCcp" +
  "OwogICAgICAgICAgICBpZiAobW9kYWwpIHsKICAgICAgICAgICAgICAgIG1vZGFsLnN0eWxlLmRp" +
  "c3BsYXkgPSAnbm9uZSc7CiAgICAgICAgICAgIH0KICAgICAgICB9CiAgICAgICAgCiAgICAgICAg" +
  "Ly8g5om56YeP5a+85YWl5a6M5oiQCiAgICAgICAgZnVuY3Rpb24gYmF0Y2hJbXBvcnRDb21wbGV0" +
  "ZSgpIHsKICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSBiYXRjaEltcG9ydFN0YXRlOwogICAgICAg" +
  "ICAgICBjb25zdCBwZW5kaW5nQ291bnQgPSBwZW5kaW5nQ29tcGFuaWVzLmxlbmd0aDsKICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgIGxvZygnLS0tIOaJuemHj+WvvOWFpee7k+adnyAtLS0nLCAnaW5m" +
  "bycpOwogICAgICAgICAgICBsb2coYOKchSDlt7Lnoa7orqTvvJoke3N0YXRlLnN1Y2Nlc3NDb3Vu" +
  "dH0g5p2hYCwgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgaWYgKHBlbmRpbmdDb3VudCA+IDApIHsK" +
  "ICAgICAgICAgICAgICAgIGxvZyhg4o+477iPIOW+heehruiupO+8miR7cGVuZGluZ0NvdW50fSDm" +
  "naHvvIjor7flnKjlhazlj7jliJfooajkuK3kv67mlLnlnLDlnYDvvIlgLCAnd2FybmluZycpOwog" +
  "ICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDmm7TmlrDnlYzpnaIKICAg" +
  "ICAgICAgICAgc2F2ZVRvTG9jYWxTdG9yYWdlKCk7CiAgICAgICAgICAgIHJlbmRlckNvbXBhbnlM" +
  "aXN0KCk7CiAgICAgICAgICAgIHJlbmRlck1hcmtlcnMoKTsKICAgICAgICAgICAgCiAgICAgICAg" +
  "ICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXRjaEltcG9ydCcpLnZhbHVlID0gJyc7CiAg" +
  "ICAgICAgICAgIAogICAgICAgICAgICBsZXQgbWVzc2FnZSA9IGDlt7Lmt7vliqAgJHtzdGF0ZS5z" +
  "dWNjZXNzQ291bnR9IOWutuWFrOWPuGA7CiAgICAgICAgICAgIGlmIChwZW5kaW5nQ291bnQgPiAw" +
  "KSB7CiAgICAgICAgICAgICAgICBtZXNzYWdlICs9IGDvvIwke3BlbmRpbmdDb3VudH0g5a625b6F" +
  "56Gu6K6k5Zyw5Z2AYDsKICAgICAgICAgICAgfQogICAgICAgICAgICBzaG93VG9hc3QobWVzc2Fn" +
  "ZSwgcGVuZGluZ0NvdW50ID4gMCA/ICd3YXJuaW5nJyA6ICdzdWNjZXNzJyk7CiAgICAgICAgICAg" +
  "IAogICAgICAgICAgICBpZiAoY29tcGFuaWVzLmxlbmd0aCA+IDApIHsKICAgICAgICAgICAgICAg" +
  "IG1hcC5zZXRGaXRWaWV3KCk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IGNsb3NlQmF0Y2hNb2RhbCgpOwogICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgn" +
  "YmF0Y2hQcm9ncmVzcycpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgICAgICAgIAogICAg" +
  "ICAgICAgICAvLyDph43nva7nirbmgIEKICAgICAgICAgICAgYmF0Y2hJbXBvcnRTdGF0ZSA9IHsK" +
  "ICAgICAgICAgICAgICAgIGlzUHJvY2Vzc2luZzogZmFsc2UsCiAgICAgICAgICAgICAgICBjb21w" +
  "YW5pZXNUb0ltcG9ydDogW10sCiAgICAgICAgICAgICAgICBuZWVkQ29uZmlybTogW10sCiAgICAg" +
  "ICAgICAgICAgICBjdXJyZW50SW5kZXg6IDAsCiAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQ6" +
  "IDAsCiAgICAgICAgICAgICAgICBmYWlsQ291bnQ6IDAKICAgICAgICAgICAgfTsKICAgICAgICB9" +
  "CiAgICAgICAgCiAgICAgICAgLy8g5riy5p+T5YWs5Y+45YiX6KGoCiAgICAgICAgZnVuY3Rpb24g" +
  "cmVuZGVyQ29tcGFueUxpc3QoKSB7CiAgICAgICAgICAgIGNvbnN0IGxpc3RDb250YWluZXIgPSBk" +
  "b2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29tcGFueUxpc3QnKTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIGlmIChjb21wYW5pZXMubGVuZ3RoID09PSAwICYmIHBlbmRpbmdDb21wYW5pZXMubGVu" +
  "Z3RoID09PSAwKSB7CiAgICAgICAgICAgICAgICBsaXN0Q29udGFpbmVyLmlubmVySFRNTCA9ICc8" +
  "cCBzdHlsZT0iY29sb3I6ICM5OTk7IHRleHQtYWxpZ246IGNlbnRlcjsgcGFkZGluZzogMTVweDsg" +
  "Zm9udC1zaXplOiAxMnB4OyI+5pqC5peg5YWs5Y+45L+h5oGv77yM6K+35re75Yqg5oiW5a+85YWl" +
  "PC9wPic7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgIGxldCBodG1sID0gJyc7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDl" +
  "voXnoa7orqTnmoTlhazlj7jvvIjmlL7lnKjpobbpg6jvvIkKICAgICAgICAgICAgaWYgKHBlbmRp" +
  "bmdDb21wYW5pZXMubGVuZ3RoID4gMCkgewogICAgICAgICAgICAgICAgaHRtbCArPSAnPGRpdiBz" +
  "dHlsZT0ibWFyZ2luLWJvdHRvbTogMTBweDsgZm9udC1zaXplOiAxMXB4OyBjb2xvcjogI2Y1OWUw" +
  "YjsgZm9udC13ZWlnaHQ6IDYwMDsiPuKaoO+4jyDlnLDlnYDlvoXnoa7orqQgKCcgKyBwZW5kaW5n" +
  "Q29tcGFuaWVzLmxlbmd0aCArICcpPC9kaXY+JzsKICAgICAgICAgICAgICAgIGh0bWwgKz0gcGVu" +
  "ZGluZ0NvbXBhbmllcy5tYXAoKGNvbXBhbnksIGluZGV4KSA9PiBgCiAgICAgICAgICAgICAgICAg" +
  "ICAgPGRpdiBjbGFzcz0iY29tcGFueS1pdGVtIiBzdHlsZT0iYm9yZGVyLWxlZnQtY29sb3I6ICNm" +
  "NTllMGI7IGJhY2tncm91bmQ6ICNmZmZiZWI7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgPGRp" +
  "diBjbGFzcz0iY29tcGFueS1pbmZvIj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYg" +
  "Y2xhc3M9ImNvbXBhbnktbmFtZSI+JHtjb21wYW55Lm5hbWV9PC9kaXY+CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb21wYW55LWFkZHJlc3MiIHN0eWxlPSJjb2xvcjog" +
  "I2Q5NzcwNjsiPiR7Y29tcGFueS5hZGRyZXNzfTwvZGl2PgogICAgICAgICAgICAgICAgICAgICAg" +
  "ICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1hY3Rp" +
  "b25zIj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zbWFs" +
  "bCIgb25jbGljaz0iZWRpdFBlbmRpbmdDb21wYW55KCR7aW5kZXh9KSIgc3R5bGU9ImJhY2tncm91" +
  "bmQ6ICNmNTllMGI7IGNvbG9yOiB3aGl0ZTsiPuS/ruaUuTwvYnV0dG9uPgogICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLXNtYWxsIGJ0bi1kZWxldGUiIG9uY2xp" +
  "Y2s9ImRlbGV0ZVBlbmRpbmdDb21wYW55KCR7aW5kZXh9KSI+5Yig6ZmkPC9idXR0b24+CiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAg" +
  "ICAgICAgICAgICAgYCkuam9pbignJyk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIC8vIOW3suehruiupOeahOWFrOWPuAogICAgICAgICAgICBpZiAoY29tcGFuaWVzLmxl" +
  "bmd0aCA+IDApIHsKICAgICAgICAgICAgICAgIGh0bWwgKz0gJzxkaXYgc3R5bGU9Im1hcmdpbjog" +
  "MTVweCAwIDEwcHggMDsgZm9udC1zaXplOiAxMXB4OyBjb2xvcjogIzY2N2VlYTsgZm9udC13ZWln" +
  "aHQ6IDYwMDsiPuW3suehruiupCAoJyArIGNvbXBhbmllcy5sZW5ndGggKyAnKTwvZGl2Pic7CiAg" +
  "ICAgICAgICAgICAgICBodG1sICs9IGNvbXBhbmllcy5tYXAoY29tcGFueSA9PiBgCiAgICAgICAg" +
  "ICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1pdGVtIj4KICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1pbmZvIj4KICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIDxkaXYgY2xhc3M9ImNvbXBhbnktbmFtZSI+JHtjb21wYW55Lm5hbWV9PC9kaXY+CiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb21wYW55LWFkZHJlc3MiPiR7Y29t" +
  "cGFueS5hZGRyZXNzfTwvZGl2PgogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1hY3Rpb25zIj4KICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zbWFsbCBidG4tZGVsZXRlIiBv" +
  "bmNsaWNrPSJkZWxldGVDb21wYW55KCR7Y29tcGFueS5pZH0pIj7liKDpmaQ8L2J1dHRvbj4KICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAg" +
  "ICAgICAgICAgICAgICBgKS5qb2luKCcnKTsKICAgICAgICAgICAgfQogICAgICAgICAgICAKICAg" +
  "ICAgICAgICAgbGlzdENvbnRhaW5lci5pbm5lckhUTUwgPSBodG1sOwogICAgICAgIH0KICAgICAg" +
  "ICAKICAgICAgICAvLyDmt7vliqDliLDlvoXnoa7orqTliJfooagKICAgICAgICBmdW5jdGlvbiBh" +
  "ZGRUb1BlbmRpbmdMaXN0KGNvbXBhbnkpIHsKICAgICAgICAgICAgY29uc3QgZXhpc3RzID0gcGVu" +
  "ZGluZ0NvbXBhbmllcy5maW5kKGMgPT4gYy5uYW1lID09PSBjb21wYW55Lm5hbWUpOwogICAgICAg" +
  "ICAgICBpZiAoIWV4aXN0cykgewogICAgICAgICAgICAgICAgcGVuZGluZ0NvbXBhbmllcy5wdXNo" +
  "KHsKICAgICAgICAgICAgICAgICAgICBpZDogRGF0ZS5ub3coKSArIE1hdGgucmFuZG9tKCksCiAg" +
  "ICAgICAgICAgICAgICAgICAgbmFtZTogY29tcGFueS5uYW1lLAogICAgICAgICAgICAgICAgICAg" +
  "IGFkZHJlc3M6IGNvbXBhbnkuYWRkcmVzcwogICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAg" +
  "ICAgICBzYXZlVG9Mb2NhbFN0b3JhZ2UoKTsKICAgICAgICAgICAgICAgIHJlbmRlckNvbXBhbnlM" +
  "aXN0KCk7CiAgICAgICAgICAgIH0KICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5Yig6Zmk" +
  "5b6F56Gu6K6k5YWs5Y+4CiAgICAgICAgZnVuY3Rpb24gZGVsZXRlUGVuZGluZ0NvbXBhbnkoaW5k" +
  "ZXgpIHsKICAgICAgICAgICAgaWYgKGNvbmZpcm0oJ+ehruWumuWIoOmZpOi/meS4quW+heehruiu" +
  "pOeahOWFrOWPuOWQl++8nycpKSB7CiAgICAgICAgICAgICAgICBwZW5kaW5nQ29tcGFuaWVzLnNw" +
  "bGljZShpbmRleCwgMSk7CiAgICAgICAgICAgICAgICBzYXZlVG9Mb2NhbFN0b3JhZ2UoKTsKICAg" +
  "ICAgICAgICAgICAgIHJlbmRlckNvbXBhbnlMaXN0KCk7CiAgICAgICAgICAgIH0KICAgICAgICB9" +
  "CiAgICAgICAgCiAgICAgICAgLy8g57yW6L6R5b6F56Gu6K6k5YWs5Y+477yI5pCc57Si5paw5Zyw" +
  "5Z2A5bm25a+85YWl77yJCiAgICAgICAgZnVuY3Rpb24gZWRpdFBlbmRpbmdDb21wYW55KGluZGV4" +
  "KSB7CiAgICAgICAgICAgIGNvbnN0IGNvbXBhbnkgPSBwZW5kaW5nQ29tcGFuaWVzW2luZGV4XTsK" +
  "ICAgICAgICAgICAgY29uc3QgbmV3QWRkcmVzcyA9IHByb21wdChg6K+35L+u5pS5ICIke2NvbXBh" +
  "bnkubmFtZX0iIOeahOWcsOWdgO+8mmAsIGNvbXBhbnkuYWRkcmVzcyk7CiAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICBpZiAoIW5ld0FkZHJlc3MgfHwgbmV3QWRkcmVzcy50cmltKCkgPT09ICcnKSB7" +
  "CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIHNob3dMb2FkaW5nKHRydWUpOwogICAgICAgICAgICBwbGFjZVNlYXJjaC5zZWFyY2go" +
  "bmV3QWRkcmVzcy50cmltKCksIGZ1bmN0aW9uKHN0YXR1cywgcmVzdWx0KSB7CiAgICAgICAgICAg" +
  "ICAgICBzaG93TG9hZGluZyhmYWxzZSk7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAg" +
  "IGlmIChzdGF0dXMgPT09ICdjb21wbGV0ZScgJiYgcmVzdWx0LnBvaUxpc3QgJiYgcmVzdWx0LnBv" +
  "aUxpc3QucG9pcy5sZW5ndGggPiAwKSB7CiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9pcyA9" +
  "IHJlc3VsdC5wb2lMaXN0LnBvaXM7CiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NvcmVkQ2Fu" +
  "ZGlkYXRlcyA9IHNjb3JlQ2FuZGlkYXRlcyhwb2lzLCBuZXdBZGRyZXNzLCBjb21wYW55Lm5hbWUp" +
  "OwogICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgIHNob3dCYXRjaENvbmZp" +
  "cm1BbmRXYWl0KAogICAgICAgICAgICAgICAgICAgICAgICB7IG5hbWU6IGNvbXBhbnkubmFtZSwg" +
  "YWRkcmVzczogbmV3QWRkcmVzcyB9LAogICAgICAgICAgICAgICAgICAgICAgICBzY29yZWRDYW5k" +
  "aWRhdGVzLAogICAgICAgICAgICAgICAgICAgICAgICAoc2VsZWN0ZWQpID0+IHsKICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIGlmIChzZWxlY3RlZCkgewogICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIGNvbXBhbmllcy5wdXNoKHNlbGVjdGVkKTsKICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICBwZW5kaW5nQ29tcGFuaWVzLnNwbGljZShpbmRleCwgMSk7CiAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgc2F2ZVRvTG9jYWxTdG9yYWdlKCk7CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgcmVuZGVyQ29tcGFueUxpc3QoKTsKICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICByZW5kZXJNYXJrZXJzKCk7CiAgICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgc2hvd1RvYXN0KGDinIUg5bey5re75Yqg77yaJHtjb21wYW55Lm5hbWV9YCwgJ3N1Y2Nl" +
  "c3MnKTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgfQogICAgICAgICAgICAgICAgICAgICk7CiAgICAgICAgICAgICAgICB9IGVsc2UgewogICAg" +
  "ICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5pyq5om+5Yiw6K+l5Zyw5Z2A77yM6K+35qOA5p+l" +
  "5Zyw5Z2A5piv5ZCm5q2j56GuJywgJ2Vycm9yJyk7CiAgICAgICAgICAgICAgICB9CiAgICAgICAg" +
  "ICAgIH0pOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDmuLLmn5PlnLDlm77moIforrAK" +
  "ICAgICAgICBmdW5jdGlvbiByZW5kZXJNYXJrZXJzKCkgewogICAgICAgICAgICAvLyDmuIXpmaTn" +
  "jrDmnInmoIforrAKICAgICAgICAgICAgbWFya2Vycy5mb3JFYWNoKG1hcmtlciA9PiB7CiAgICAg" +
  "ICAgICAgICAgICBtYXAucmVtb3ZlKG1hcmtlcik7CiAgICAgICAgICAgIH0pOwogICAgICAgICAg" +
  "ICBtYXJrZXJzID0gW107CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlpoLmnpzmnInkvJjl" +
  "jJbot6/nur/vvIzmjInnhafkvJjljJbot6/nur/nmoTpobrluo/nvJblj7cKICAgICAgICAgICAg" +
  "Y29uc3QgZ2V0RGlzcGxheU51bWJlciA9IChjb21wYW55KSA9PiB7CiAgICAgICAgICAgICAgICBp" +
  "ZiAob3B0aW1pemVkUm91dGUubGVuZ3RoID4gMCkgewogICAgICAgICAgICAgICAgICAgIGNvbnN0" +
  "IHJvdXRlSW5kZXggPSBvcHRpbWl6ZWRSb3V0ZS5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBjb21w" +
  "YW55LmlkKTsKICAgICAgICAgICAgICAgICAgICByZXR1cm4gcm91dGVJbmRleCA+PSAwID8gcm91" +
  "dGVJbmRleCArIDEgOiAnLSc7CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAvLyDp" +
  "u5jorqTmjInnhafmt7vliqDpobrluo/nvJblj7cKICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4" +
  "ID0gY29tcGFuaWVzLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGNvbXBhbnkuaWQpOwogICAgICAg" +
  "ICAgICAgICAgcmV0dXJuIGluZGV4ICsgMTsKICAgICAgICAgICAgfTsKICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIC8vIOa3u+WKoOaWsOagh+iusAogICAgICAgICAgICBjb21wYW5pZXMuZm9yRWFj" +
  "aCgoY29tcGFueSkgPT4gewogICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheU51bWJlciA9IGdl" +
  "dERpc3BsYXlOdW1iZXIoY29tcGFueSk7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAg" +
  "IGNvbnN0IG1hcmtlciA9IG5ldyBBTWFwLk1hcmtlcih7CiAgICAgICAgICAgICAgICAgICAgcG9z" +
  "aXRpb246IFtjb21wYW55LmxuZywgY29tcGFueS5sYXRdLAogICAgICAgICAgICAgICAgICAgIHRp" +
  "dGxlOiBgJHtjb21wYW55Lm5hbWV9XFxuJHtjb21wYW55LmFkZHJlc3N9YCwKICAgICAgICAgICAg" +
  "ICAgICAgICBsYWJlbDogewogICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBgPGRpdiBz" +
  "dHlsZT0iYmFja2dyb3VuZDogIzY2N2VlYTsgY29sb3I6IHdoaXRlOyBwYWRkaW5nOiA0cHggOHB4" +
  "OyBib3JkZXItcmFkaXVzOiA1MCU7IGZvbnQtc2l6ZTogMTJweDsgZm9udC13ZWlnaHQ6IGJvbGQ7" +
  "IG1pbi13aWR0aDogMjRweDsgaGVpZ2h0OiAyNHB4OyBsaW5lLWhlaWdodDogMTZweDsgdGV4dC1h" +
  "bGlnbjogY2VudGVyOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyI+JHtkaXNwbGF5TnVtYmVyfTwv" +
  "ZGl2PmAsCiAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogJ3RvcCcsCiAgICAgICAg" +
  "ICAgICAgICAgICAgICAgIG9mZnNldDogbmV3IEFNYXAuUGl4ZWwoMCwgLTUpCiAgICAgICAgICAg" +
  "ICAgICAgICAgfQogICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAgICAKICAgICAgICAg" +
  "ICAgICAgIC8vIOeCueWHu+agh+iusOaYvuekuuS/oeaBr+eql+WPo++8iOW4pue8lui+kS/liKDp" +
  "maTmjInpkq7vvIkKICAgICAgICAgICAgICAgIG1hcmtlci5vbignY2xpY2snLCAoKSA9PiB7CiAg" +
  "ICAgICAgICAgICAgICAgICAgc2hvd01hcmtlckluZm9XaW5kb3coY29tcGFueSwgbWFya2VyKTsK" +
  "ICAgICAgICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBtYXJr" +
  "ZXJzLnB1c2gobWFya2VyKTsKICAgICAgICAgICAgICAgIG1hcC5hZGQobWFya2VyKTsKICAgICAg" +
  "ICAgICAgfSk7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDmmL7npLrlvoXkv53lrZjkv67m" +
  "lLnmj5DnpLoKICAgICAgICAgICAgCiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOaYvuek" +
  "uuagh+iusOS/oeaBr+eql+WPo++8iOW4pue8lui+kS/liKDpmaTmjInpkq7vvIkKICAgICAgICBm" +
  "dW5jdGlvbiBzaG93TWFya2VySW5mb1dpbmRvdyhjb21wYW55LCBtYXJrZXIpIHsKICAgICAgICAg" +
  "ICAgY29uc3QgY29udGVudCA9IGAKICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9InBhZGRpbmc6" +
  "IDEycHg7IG1pbi13aWR0aDogMjAwcHg7Ij4KICAgICAgICAgICAgICAgICAgICA8aDQgc3R5bGU9" +
  "Im1hcmdpbjogMCAwIDhweCAwOyBmb250LXNpemU6IDE0cHg7IGNvbG9yOiAjMzMzOyI+JHtjb21w" +
  "YW55Lm5hbWV9PC9oND4KICAgICAgICAgICAgICAgICAgICA8cCBzdHlsZT0ibWFyZ2luOiAwIDAg" +
  "MTJweCAwOyBjb2xvcjogIzY2NjsgZm9udC1zaXplOiAxMnB4OyBsaW5lLWhlaWdodDogMS40OyI+" +
  "JHtjb21wYW55LmFkZHJlc3N9PC9wPgogICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImRp" +
  "c3BsYXk6IGZsZXg7IGdhcDogOHB4OyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24g" +
  "b25jbGljaz0iZWRpdENvbXBhbnlGcm9tTWFwKCR7Y29tcGFueS5pZH0pIiBzdHlsZT0iZmxleDog" +
  "MTsgcGFkZGluZzogNnB4IDEycHg7IGJvcmRlcjogMXB4IHNvbGlkICM2NjdlZWE7IGJhY2tncm91" +
  "bmQ6IHdoaXRlOyBjb2xvcjogIzY2N2VlYTsgYm9yZGVyLXJhZGl1czogNHB4OyBmb250LXNpemU6" +
  "IDEycHg7IGN1cnNvcjogcG9pbnRlcjsiPvCfk40g57yW6L6R5Zyw5Z2APC9idXR0b24+CiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0iZGVsZXRlQ29tcGFueUZyb21NYXAo" +
  "JHtjb21wYW55LmlkfSkiIHN0eWxlPSJmbGV4OiAxOyBwYWRkaW5nOiA2cHggMTJweDsgYm9yZGVy" +
  "OiAxcHggc29saWQgI2VmNDQ0NDsgYmFja2dyb3VuZDogI2ZlZjJmMjsgY29sb3I6ICNlZjQ0NDQ7" +
  "IGJvcmRlci1yYWRpdXM6IDRweDsgZm9udC1zaXplOiAxMnB4OyBjdXJzb3I6IHBvaW50ZXI7Ij7w" +
  "n5eR77iPIOWIoOmZpDwvYnV0dG9uPgogICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAg" +
  "ICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIGA7CiAgICAgICAgICAgIAogICAgICAgICAgICBj" +
  "b25zdCBpbmZvV2luZG93ID0gbmV3IEFNYXAuSW5mb1dpbmRvdyh7CiAgICAgICAgICAgICAgICBj" +
  "b250ZW50OiBjb250ZW50LAogICAgICAgICAgICAgICAgb2Zmc2V0OiBuZXcgQU1hcC5QaXhlbCgw" +
  "LCAtMzApCiAgICAgICAgICAgIH0pOwogICAgICAgICAgICBpbmZvV2luZG93Lm9wZW4obWFwLCBt" +
  "YXJrZXIuZ2V0UG9zaXRpb24oKSk7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOS7juWc" +
  "sOWbvuWIoOmZpOWFrOWPuO+8iOebtOaOpeWIoOmZpO+8jOS4jeW+heS/neWtmO+8iQogICAgICAg" +
  "IGZ1bmN0aW9uIGRlbGV0ZUNvbXBhbnlGcm9tTWFwKGNvbXBhbnlJZCkgewogICAgICAgICAgICBp" +
  "ZiAoIWNvbmZpcm0oJ+ehruWumuS7jui3r+e6v+S4reWIoOmZpOi/meS4quWFrOWPuOWQl++8nycp" +
  "KSB7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIC8vIOebtOaOpeWIoOmZpAogICAgICAgICAgICBjb21wYW5pZXMgPSBjb21wYW5p" +
  "ZXMuZmlsdGVyKGMgPT4gYy5pZCAhPT0gY29tcGFueUlkKTsKICAgICAgICAgICAgCiAgICAgICAg" +
  "ICAgIC8vIOS7juS8mOWMlui3r+e6v+S4reS5n+WIoOmZpAogICAgICAgICAgICBpZiAob3B0aW1p" +
  "emVkUm91dGUubGVuZ3RoID4gMCkgewogICAgICAgICAgICAgICAgb3B0aW1pemVkUm91dGUgPSBv" +
  "cHRpbWl6ZWRSb3V0ZS5maWx0ZXIoYyA9PiBjLmlkICE9PSBjb21wYW55SWQpOwogICAgICAgICAg" +
  "ICB9CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlhbPpl63lnLDlm77kuIrnmoTkv6Hmga/n" +
  "qpcKICAgICAgICAgICAgbWFwLmNsZWFySW5mb1dpbmRvdygpOwogICAgICAgICAgICAKICAgICAg" +
  "ICAgICAgLy8g5L+d5a2Y5bm25pu05pawCiAgICAgICAgICAgIHNhdmVUb0xvY2FsU3RvcmFnZSgp" +
  "OwogICAgICAgICAgICByZW5kZXJDb21wYW55TGlzdCgpOwogICAgICAgICAgICByZW5kZXJNYXJr" +
  "ZXJzKCk7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlpoLmnpzmnInop4TliJLnu5Pmnpzv" +
  "vIzmm7TmlrDnu5PmnpzpnaLmnb8KICAgICAgICAgICAgaWYgKG9wdGltaXplZFJvdXRlLmxlbmd0" +
  "aCA+IDApIHsKICAgICAgICAgICAgICAgIHJlbmRlckRyYWdnYWJsZVJvdXRlTGlzdChvcHRpbWl6" +
  "ZWRSb3V0ZSk7CiAgICAgICAgICAgICAgICAvLyDph43mlrDop4TliJLot6/nur/vvIjlpoLmnpzo" +
  "v5jmnInotrPlpJ/nmoTngrnvvIkKICAgICAgICAgICAgICAgIGlmIChvcHRpbWl6ZWRSb3V0ZS5s" +
  "ZW5ndGggPj0gMikgewogICAgICAgICAgICAgICAgICAgIHJlcGxhblJvdXRlQnlPcmRlcigpOwog" +
  "ICAgICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgICAgICAgICAvLyDngrnmlbDkuI3l" +
  "pJ/vvIzmuIXnqbrot6/nur8KICAgICAgICAgICAgICAgICAgICBpZiAoZHJpdmluZykgZHJpdmlu" +
  "Zy5jbGVhcigpOwogICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdy" +
  "ZXN1bHRQYW5lbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKTsKICAgICAgICAgICAgICAgICAg" +
  "ICBvcHRpbWl6ZWRSb3V0ZSA9IFtdOwogICAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAg" +
  "ICAgICAgICAgIAogICAgICAgICAgICBzaG93VG9hc3QoJ+KchSDlt7LliKDpmaQnLCAnc3VjY2Vz" +
  "cycpOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDku47lnLDlm77nvJbovpHlhazlj7jl" +
  "nLDlnYAKICAgICAgICBmdW5jdGlvbiBlZGl0Q29tcGFueUZyb21NYXAoY29tcGFueUlkKSB7CiAg" +
  "ICAgICAgICAgIGNvbnN0IGNvbXBhbnkgPSBjb21wYW5pZXMuZmluZChjID0+IGMuaWQgPT09IGNv" +
  "bXBhbnlJZCk7CiAgICAgICAgICAgIGlmICghY29tcGFueSkgcmV0dXJuOwogICAgICAgICAgICAK" +
  "ICAgICAgICAgICAgLy8g5pi+56S657yW6L6R5by556qXCiAgICAgICAgICAgIHNob3dFZGl0QWRk" +
  "cmVzc01vZGFsKGNvbXBhbnkpOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDlsI/lnLDl" +
  "m77lrp7kvovvvIjnvJbovpHnlKjvvIkKICAgICAgICBsZXQgZWRpdE1pbmlNYXAgPSBudWxsOwog" +
  "ICAgICAgIGxldCBlZGl0TWluaU1hcmtlciA9IG51bGw7CiAgICAgICAgCiAgICAgICAgLy8g5pi+" +
  "56S657yW6L6R5Zyw5Z2A5by556qX77yI5bim5bCP5Zyw5Zu+77yJCiAgICAgICAgZnVuY3Rpb24g" +
  "c2hvd0VkaXRBZGRyZXNzTW9kYWwoY29tcGFueSkgewogICAgICAgICAgICBjb25zdCBodG1sID0g" +
  "YAogICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDogd2hpdGU7IGJvcmRlci1y" +
  "YWRpdXM6IDEwcHg7IG1heC13aWR0aDogNTAwcHg7IHdpZHRoOiA5NSU7IiBvbmNsaWNrPSJldmVu" +
  "dC5zdG9wUHJvcGFnYXRpb24oKSI+CiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0icGFk" +
  "ZGluZzogMTVweCAyMHB4OyBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjNjY3" +
  "ZWVhIDAlLCAjNzY0YmEyIDEwMCUpOyBjb2xvcjogd2hpdGU7Ij4KICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgPGgzIHN0eWxlPSJtYXJnaW46IDA7IGZvbnQtc2l6ZTogMTZweDsiPvCfk40g5L+u5pS5" +
  "5Zyw5Z2APC9oMz4KICAgICAgICAgICAgICAgICAgICAgICAgPHAgc3R5bGU9Im1hcmdpbjogNXB4" +
  "IDAgMCAwOyBmb250LXNpemU6IDEycHg7IG9wYWNpdHk6IDAuOTsiPiR7Y29tcGFueS5uYW1lfTwv" +
  "cD4KICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0" +
  "eWxlPSJwYWRkaW5nOiAyMHB4OyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9" +
  "Im1hcmdpbi1ib3R0b206IDEycHg7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJl" +
  "bCBzdHlsZT0iZGlzcGxheTogYmxvY2s7IG1hcmdpbi1ib3R0b206IDZweDsgZm9udC1zaXplOiAx" +
  "MnB4OyBjb2xvcjogIzY2NjsiPuW9k+WJjeWcsOWdgO+8miR7Y29tcGFueS5hZGRyZXNzfTwvbGFi" +
  "ZWw+CiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgICAgICAg" +
  "ICA8ZGl2IHN0eWxlPSJkaXNwbGF5OiBmbGV4OyBnYXA6IDhweDsgbWFyZ2luLWJvdHRvbTogMTJw" +
  "eDsiPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9InRleHQiIGlkPSJl" +
  "ZGl0QWRkcmVzc0lucHV0IiB2YWx1ZT0iIiBzdHlsZT0iZmxleDogMTsgcGFkZGluZzogMTBweDsg" +
  "Ym9yZGVyOiAxcHggc29saWQgI2RkZDsgYm9yZGVyLXJhZGl1czogNHB4OyBmb250LXNpemU6IDEz" +
  "cHg7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IiBwbGFjZWhvbGRlcj0i6L6T5YWl5paw5Zyw5Z2A" +
  "5pCc57SiIj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0ic2Vh" +
  "cmNoQWRkcmVzc0Zvck1pbmlNYXAoJHtjb21wYW55LmlkfSkiIHN0eWxlPSJwYWRkaW5nOiAxMHB4" +
  "IDE2cHg7IGJvcmRlcjogbm9uZTsgYmFja2dyb3VuZDogIzY2N2VlYTsgY29sb3I6IHdoaXRlOyBi" +
  "b3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjsgZm9udC1zaXplOiAxM3B4OyB3aGl0" +
  "ZS1zcGFjZTogbm93cmFwOyI+8J+UjSDmkJzntKI8L2J1dHRvbj4KICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
  "ICAgICA8IS0tIOWwj+WcsOWbvuWMuuWfnyAtLT4KICAgICAgICAgICAgICAgICAgICAgICAgPGRp" +
  "diBzdHlsZT0ibWFyZ2luLWJvdHRvbTogMTJweDsiPgogICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgPGRpdiBzdHlsZT0iZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3" +
  "ZWVuOyBhbGlnbi1pdGVtczogY2VudGVyOyBtYXJnaW4tYm90dG9tOiA2cHg7Ij4KICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9ImZvbnQtc2l6ZTogMTJweDsgY29s" +
  "b3I6ICM2NjY7Ij7lnKjlnLDlm77kuIrngrnlh7vmiJbmi5bliqjosIPmlbTkvY3nva48L2xhYmVs" +
  "PgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGlkPSJtaW5pTWFwSGludCIg" +
  "c3R5bGU9ImZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICM5OTk7Ij7lvZPliY3kvY3nva48L3NwYW4+" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgIDxkaXYgaWQ9ImVkaXRNaW5pTWFwIiBzdHlsZT0id2lkdGg6IDEwMCU7IGhlaWdodDog" +
  "MjAwcHg7IGJvcmRlci1yYWRpdXM6IDhweDsgYm9yZGVyOiAycHggc29saWQgI2UwZTBlMDsiPjwv" +
  "ZGl2PgogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgCiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9Im5vUmVzdWx0SGludCIgc3R5bGU9" +
  "ImRpc3BsYXk6IG5vbmU7IGJhY2tncm91bmQ6ICNmZWYyZjI7IGJvcmRlcjogMXB4IHNvbGlkICNl" +
  "ZjQ0NDQ7IGJvcmRlci1yYWRpdXM6IDZweDsgcGFkZGluZzogMTBweDsgbWFyZ2luLWJvdHRvbTog" +
  "MTJweDsgZm9udC1zaXplOiAxMnB4OyBjb2xvcjogI2RjMjYyNjsiPgogICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAg4p2MIOacquaJvuWIsOivpeWcsOWdgO+8jOivt+WcqOWcsOWbvuS4iuaJi+WK" +
  "qOmAieaLqQogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6IGZsZXg7" +
  "IGdhcDogMTBweDsiPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBvbmNsaWNr" +
  "PSJjbG9zZUVkaXRNb2RhbCgpIiBzdHlsZT0iZmxleDogMTsgcGFkZGluZzogMTBweDsgYm9yZGVy" +
  "OiAxcHggc29saWQgI2RkZDsgYmFja2dyb3VuZDogd2hpdGU7IGJvcmRlci1yYWRpdXM6IDZweDsg" +
  "Y3Vyc29yOiBwb2ludGVyOyBmb250LXNpemU6IDEzcHg7Ij7lj5bmtog8L2J1dHRvbj4KICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0iY29uZmlybU1pbmlNYXBTZWxl" +
  "Y3Rpb24oJHtjb21wYW55LmlkfSkiIHN0eWxlPSJmbGV4OiAxOyBwYWRkaW5nOiAxMHB4OyBib3Jk" +
  "ZXI6IG5vbmU7IGJhY2tncm91bmQ6ICMxMGI5ODE7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyLXJhZGl1" +
  "czogNnB4OyBjdXJzb3I6IHBvaW50ZXI7IGZvbnQtc2l6ZTogMTNweDsiPuKchSDnoa7orqTpgInm" +
  "i6k8L2J1dHRvbj4KICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAg" +
  "ICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgYDsKICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgIGxldCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdl" +
  "ZGl0QWRkcmVzc01vZGFsJyk7CiAgICAgICAgICAgIGlmICghbW9kYWwpIHsKICAgICAgICAgICAg" +
  "ICAgIG1vZGFsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7CiAgICAgICAgICAgICAg" +
  "ICBtb2RhbC5pZCA9ICdlZGl0QWRkcmVzc01vZGFsJzsKICAgICAgICAgICAgICAgIG1vZGFsLnN0" +
  "eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGZpeGVkOyB0b3A6IDA7IGxlZnQ6IDA7IHJpZ2h0OiAw" +
  "OyBib3R0b206IDA7IGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsMC41KTsgZGlzcGxheTogZmxleDsg" +
  "YWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IHotaW5kZXg6IDEw" +
  "MDAyOyc7CiAgICAgICAgICAgICAgICBtb2RhbC5vbmNsaWNrID0gZnVuY3Rpb24oZSkgewogICAg" +
  "ICAgICAgICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gbW9kYWwpIGNsb3NlRWRpdE1vZGFsKCk7" +
  "CiAgICAgICAgICAgICAgICB9OwogICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRD" +
  "aGlsZChtb2RhbCk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgbW9kYWwuaW5uZXJIVE1MID0g" +
  "aHRtbDsKICAgICAgICAgICAgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4JzsKICAgICAgICAg" +
  "ICAgCiAgICAgICAgICAgIC8vIOS/neWtmOW9k+WJjee8lui+keeahOWFrOWPuElE5ZKM5Z2Q5qCH" +
  "CiAgICAgICAgICAgIHdpbmRvdy5jdXJyZW50RWRpdENvbXBhbnlJZCA9IGNvbXBhbnkuaWQ7CiAg" +
  "ICAgICAgICAgIHdpbmRvdy5jdXJyZW50RWRpdExhdCA9IGNvbXBhbnkubGF0OwogICAgICAgICAg" +
  "ICB3aW5kb3cuY3VycmVudEVkaXRMbmcgPSBjb21wYW55LmxuZzsKICAgICAgICAgICAgd2luZG93" +
  "LmN1cnJlbnRFZGl0QWRkcmVzcyA9IGNvbXBhbnkuYWRkcmVzczsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIC8vIOWIneWni+WMluWwj+WcsOWbvgogICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+" +
  "IHsKICAgICAgICAgICAgICAgIGluaXRFZGl0TWluaU1hcChjb21wYW55LmxuZywgY29tcGFueS5s" +
  "YXQpOwogICAgICAgICAgICB9LCAxMDApOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDl" +
  "iJ3lp4vljJbnvJbovpHlsI/lnLDlm74KICAgICAgICBmdW5jdGlvbiBpbml0RWRpdE1pbmlNYXAo" +
  "bG5nLCBsYXQpIHsKICAgICAgICAgICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxl" +
  "bWVudEJ5SWQoJ2VkaXRNaW5pTWFwJyk7CiAgICAgICAgICAgIGlmICghY29udGFpbmVyKSByZXR1" +
  "cm47CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDplIDmr4Hml6flnLDlm74KICAgICAgICAg" +
  "ICAgaWYgKGVkaXRNaW5pTWFwKSB7CiAgICAgICAgICAgICAgICBlZGl0TWluaU1hcC5kZXN0cm95" +
  "KCk7CiAgICAgICAgICAgICAgICBlZGl0TWluaU1hcCA9IG51bGw7CiAgICAgICAgICAgIH0KICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgIC8vIOWIm+W7uuWwj+WcsOWbvgogICAgICAgICAgICBlZGl0" +
  "TWluaU1hcCA9IG5ldyBBTWFwLk1hcCgnZWRpdE1pbmlNYXAnLCB7CiAgICAgICAgICAgICAgICB6" +
  "b29tOiAxNSwKICAgICAgICAgICAgICAgIGNlbnRlcjogW2xuZywgbGF0XSwKICAgICAgICAgICAg" +
  "ICAgIHZpZXdNb2RlOiAnMkQnCiAgICAgICAgICAgIH0pOwogICAgICAgICAgICAKICAgICAgICAg" +
  "ICAgLy8g5re75Yqg5Y+v5ouW5Yqo5qCH6K6wCiAgICAgICAgICAgIGVkaXRNaW5pTWFya2VyID0g" +
  "bmV3IEFNYXAuTWFya2VyKHsKICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBbbG5nLCBsYXRdLAog" +
  "ICAgICAgICAgICAgICAgZHJhZ2dhYmxlOiB0cnVlLAogICAgICAgICAgICAgICAgdGl0bGU6ICfm" +
  "i5bliqjosIPmlbTkvY3nva4nLAogICAgICAgICAgICAgICAgbGFiZWw6IHsKICAgICAgICAgICAg" +
  "ICAgICAgICBjb250ZW50OiAnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDogIzY2N2VlYTsgY29sb3I6" +
  "IHdoaXRlOyBwYWRkaW5nOiA0cHggOHB4OyBib3JkZXItcmFkaXVzOiA0cHg7IGZvbnQtc2l6ZTog" +
  "MTFweDsiPuaLluWKqOaIkTwvZGl2PicsCiAgICAgICAgICAgICAgICAgICAgZGlyZWN0aW9uOiAn" +
  "dG9wJwogICAgICAgICAgICAgICAgfQogICAgICAgICAgICB9KTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIGVkaXRNaW5pTWFwLmFkZChlZGl0TWluaU1hcmtlcik7CiAgICAgICAgICAgIAogICAg" +
  "ICAgICAgICAvLyDnm5HlkKzmi5bliqjnu5PmnZ8KICAgICAgICAgICAgZWRpdE1pbmlNYXJrZXIu" +
  "b24oJ2RyYWdlbmQnLCBmdW5jdGlvbihlKSB7CiAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBl" +
  "LmxuZ2xhdDsKICAgICAgICAgICAgICAgIHdpbmRvdy5jdXJyZW50RWRpdExuZyA9IHBvcy5sbmc7" +
  "CiAgICAgICAgICAgICAgICB3aW5kb3cuY3VycmVudEVkaXRMYXQgPSBwb3MubGF0OwogICAgICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyDpgIblnLDnkIbnvJbnoIHojrflj5blnLDlnYAK" +
  "ICAgICAgICAgICAgICAgIGNvbnN0IGdlb2NvZGVyID0gbmV3IEFNYXAuR2VvY29kZXIoKTsKICAg" +
  "ICAgICAgICAgICAgIGdlb2NvZGVyLmdldEFkZHJlc3MoW3Bvcy5sbmcsIHBvcy5sYXRdLCBmdW5j" +
  "dGlvbihzdGF0dXMsIHJlc3VsdCkgewogICAgICAgICAgICAgICAgICAgIGlmIChzdGF0dXMgPT09" +
  "ICdjb21wbGV0ZScgJiYgcmVzdWx0LnJlZ2VvY29kZSkgewogICAgICAgICAgICAgICAgICAgICAg" +
  "ICB3aW5kb3cuY3VycmVudEVkaXRBZGRyZXNzID0gcmVzdWx0LnJlZ2VvY29kZS5mb3JtYXR0ZWRB" +
  "ZGRyZXNzOwogICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgn" +
  "bWluaU1hcEhpbnQnKS50ZXh0Q29udGVudCA9ICflt7LmiYvliqjosIPmlbTkvY3nva4nOwogICAg" +
  "ICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWluaU1hcEhpbnQn" +
  "KS5zdHlsZS5jb2xvciA9ICcjMTBiOTgxJzsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAg" +
  "ICAgICAgICB9KTsKICAgICAgICAgICAgfSk7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDn" +
  "m5HlkKzlnLDlm77ngrnlh7vvvIjngrnlh7vlnLDlm77np7vliqjmoIforrDvvIkKICAgICAgICAg" +
  "ICAgZWRpdE1pbmlNYXAub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkgewogICAgICAgICAgICAgICAg" +
  "Y29uc3QgcG9zID0gZS5sbmdsYXQ7CiAgICAgICAgICAgICAgICBlZGl0TWluaU1hcmtlci5zZXRQ" +
  "b3NpdGlvbihwb3MpOwogICAgICAgICAgICAgICAgd2luZG93LmN1cnJlbnRFZGl0TG5nID0gcG9z" +
  "LmxuZzsKICAgICAgICAgICAgICAgIHdpbmRvdy5jdXJyZW50RWRpdExhdCA9IHBvcy5sYXQ7CiAg" +
  "ICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIC8vIOmAhuWcsOeQhue8lueggQogICAgICAg" +
  "ICAgICAgICAgY29uc3QgZ2VvY29kZXIgPSBuZXcgQU1hcC5HZW9jb2RlcigpOwogICAgICAgICAg" +
  "ICAgICAgZ2VvY29kZXIuZ2V0QWRkcmVzcyhbcG9zLmxuZywgcG9zLmxhdF0sIGZ1bmN0aW9uKHN0" +
  "YXR1cywgcmVzdWx0KSB7CiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gJ2NvbXBs" +
  "ZXRlJyAmJiByZXN1bHQucmVnZW9jb2RlKSB7CiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRv" +
  "dy5jdXJyZW50RWRpdEFkZHJlc3MgPSByZXN1bHQucmVnZW9jb2RlLmZvcm1hdHRlZEFkZHJlc3M7" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaW5pTWFw" +
  "SGludCcpLnRleHRDb250ZW50ID0gJ+W3sumAieaLqeaWsOS9jee9ric7CiAgICAgICAgICAgICAg" +
  "ICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaW5pTWFwSGludCcpLnN0eWxlLmNv" +
  "bG9yID0gJyMxMGI5ODEnOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0p" +
  "OwogICAgICAgICAgICB9KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5Zyo5bCP5Zyw" +
  "5Zu+5Lit5pCc57Si5Zyw5Z2ACiAgICAgICAgZnVuY3Rpb24gc2VhcmNoQWRkcmVzc0Zvck1pbmlN" +
  "YXAoY29tcGFueUlkKSB7CiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuZ2V0RWxl" +
  "bWVudEJ5SWQoJ2VkaXRBZGRyZXNzSW5wdXQnKTsKICAgICAgICAgICAgY29uc3QgYWRkcmVzcyA9" +
  "IGlucHV0LnZhbHVlLnRyaW0oKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIGlmICghYWRkcmVz" +
  "cykgewogICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfor7fovpPlhaXlnLDlnYAnLCAnd2Fybmlu" +
  "ZycpOwogICAgICAgICAgICAgICAgcmV0dXJuOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICBzaG93TG9hZGluZyh0cnVlKTsKICAgICAgICAgICAgcGxhY2VTZWFyY2guc2Vh" +
  "cmNoKGFkZHJlc3MsIGZ1bmN0aW9uKHN0YXR1cywgcmVzdWx0KSB7CiAgICAgICAgICAgICAgICBz" +
  "aG93TG9hZGluZyhmYWxzZSk7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIGlmIChz" +
  "dGF0dXMgPT09ICdjb21wbGV0ZScgJiYgcmVzdWx0LnBvaUxpc3QgJiYgcmVzdWx0LnBvaUxpc3Qu" +
  "cG9pcy5sZW5ndGggPiAwKSB7CiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9pID0gcmVzdWx0" +
  "LnBvaUxpc3QucG9pc1swXTsKICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBwb2kubG9j" +
  "YXRpb247CiAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g5pu05paw" +
  "5bCP5Zyw5Zu+5L2N572uCiAgICAgICAgICAgICAgICAgICAgaWYgKGVkaXRNaW5pTWFwICYmIGVk" +
  "aXRNaW5pTWFya2VyKSB7CiAgICAgICAgICAgICAgICAgICAgICAgIGVkaXRNaW5pTWFwLnNldENl" +
  "bnRlcihbcG9zLmxuZywgcG9zLmxhdF0pOwogICAgICAgICAgICAgICAgICAgICAgICBlZGl0TWlu" +
  "aU1hcmtlci5zZXRQb3NpdGlvbihbcG9zLmxuZywgcG9zLmxhdF0pOwogICAgICAgICAgICAgICAg" +
  "ICAgIH0KICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAvLyDkv53lrZjm" +
  "lrDlnZDmoIcKICAgICAgICAgICAgICAgICAgICB3aW5kb3cuY3VycmVudEVkaXRMbmcgPSBwb3Mu" +
  "bG5nOwogICAgICAgICAgICAgICAgICAgIHdpbmRvdy5jdXJyZW50RWRpdExhdCA9IHBvcy5sYXQ7" +
  "CiAgICAgICAgICAgICAgICAgICAgd2luZG93LmN1cnJlbnRFZGl0QWRkcmVzcyA9IHBvaS5hZGRy" +
  "ZXNzIHx8IHBvaS5uYW1lOwogICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
  "IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaW5pTWFwSGludCcpLnRleHRDb250ZW50ID0gJ+W3" +
  "suWumuS9jeWIsO+8micgKyBwb2kubmFtZTsKICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5n" +
  "ZXRFbGVtZW50QnlJZCgnbWluaU1hcEhpbnQnKS5zdHlsZS5jb2xvciA9ICcjMTBiOTgxJzsKICAg" +
  "ICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbm9SZXN1bHRIaW50Jyku" +
  "c3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAg" +
  "ICAgICAgICBzaG93VG9hc3QoJ+KchSDlt7Lmib7liLDkvY3nva7vvIzlj6/mi5bliqjmoIforrDl" +
  "vq7osIMnLCAnc3VjY2VzcycpOwogICAgICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAg" +
  "ICAgICAgICAvLyDmmL7npLrml6Dnu5Pmnpzmj5DnpLoKICAgICAgICAgICAgICAgICAgICBkb2N1" +
  "bWVudC5nZXRFbGVtZW50QnlJZCgnbm9SZXN1bHRIaW50Jykuc3R5bGUuZGlzcGxheSA9ICdibG9j" +
  "ayc7CiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrmib7liLDor6XlnLDlnYDvvIzo" +
  "r7flnKjlnLDlm77kuIrmiYvliqjpgInmi6knLCAnd2FybmluZycpOwogICAgICAgICAgICAgICAg" +
  "fQogICAgICAgICAgICB9KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g56Gu6K6k5bCP" +
  "5Zyw5Zu+6YCJ5oup77yI55u05o6l55Sf5pWI77yM5LiN5b6F5L+d5a2Y77yJCiAgICAgICAgZnVu" +
  "Y3Rpb24gY29uZmlybU1pbmlNYXBTZWxlY3Rpb24oY29tcGFueUlkKSB7CiAgICAgICAgICAgIC8v" +
  "IOebtOaOpeabtOaWsOWFrOWPuOS/oeaBrwogICAgICAgICAgICBjb25zdCBjb21wYW55ID0gY29t" +
  "cGFuaWVzLmZpbmQoYyA9PiBjLmlkID09PSBjb21wYW55SWQpOwogICAgICAgICAgICBpZiAoY29t" +
  "cGFueSkgewogICAgICAgICAgICAgICAgY29tcGFueS5hZGRyZXNzID0gd2luZG93LmN1cnJlbnRF" +
  "ZGl0QWRkcmVzczsKICAgICAgICAgICAgICAgIGNvbXBhbnkubG5nID0gd2luZG93LmN1cnJlbnRF" +
  "ZGl0TG5nOwogICAgICAgICAgICAgICAgY29tcGFueS5sYXQgPSB3aW5kb3cuY3VycmVudEVkaXRM" +
  "YXQ7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIC8vIOS/neWtmOW5tuabtOaWsAog" +
  "ICAgICAgICAgICAgICAgc2F2ZVRvTG9jYWxTdG9yYWdlKCk7CiAgICAgICAgICAgICAgICByZW5k" +
  "ZXJDb21wYW55TGlzdCgpOwogICAgICAgICAgICAgICAgcmVuZGVyTWFya2VycygpOwogICAgICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyDlpoLmnpzor6Xlhazlj7jlnKjkvJjljJbot6/n" +
  "ur/kuK3vvIzmm7TmlrDot6/nur8KICAgICAgICAgICAgICAgIGlmIChvcHRpbWl6ZWRSb3V0ZS5s" +
  "ZW5ndGggPiAwKSB7CiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm91dGVJbmRleCA9IG9wdGlt" +
  "aXplZFJvdXRlLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGNvbXBhbnlJZCk7CiAgICAgICAgICAg" +
  "ICAgICAgICAgaWYgKHJvdXRlSW5kZXggPj0gMCkgewogICAgICAgICAgICAgICAgICAgICAgICBv" +
  "cHRpbWl6ZWRSb3V0ZVtyb3V0ZUluZGV4XSA9IGNvbXBhbnk7CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIHJlbmRlckRyYWdnYWJsZVJvdXRlTGlzdChvcHRpbWl6ZWRSb3V0ZSk7CiAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIHJlcGxhblJvdXRlQnlPcmRlcigpOwogICAgICAgICAgICAgICAgICAgIH0K" +
  "ICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgc2hvd1Rv" +
  "YXN0KCfinIUg5Zyw5Z2A5bey5L+u5pS5JywgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgfQogICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgY2xvc2VFZGl0TW9kYWwoKTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIC8vIOWFs+mXreWcsOWbvuS4iueahOS/oeaBr+eqlwogICAgICAgICAgICBtYXAuY2xl" +
  "YXJJbmZvV2luZG93KCk7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOWFs+mXree8lui+" +
  "keW8ueeqlwogICAgICAgIGZ1bmN0aW9uIGNsb3NlRWRpdE1vZGFsKCkgewogICAgICAgICAgICBj" +
  "b25zdCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0QWRkcmVzc01vZGFsJyk7" +
  "CiAgICAgICAgICAgIGlmIChtb2RhbCkgbW9kYWwuc3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgIC8vIOa4hemZpOS4tOaXtuagh+iusAogICAgICAgICAgICBp" +
  "ZiAodGVtcEVkaXRNYXJrZXIpIHsKICAgICAgICAgICAgICAgIG1hcC5yZW1vdmUodGVtcEVkaXRN" +
  "YXJrZXIpOwogICAgICAgICAgICAgICAgdGVtcEVkaXRNYXJrZXIgPSBudWxsOwogICAgICAgICAg" +
  "ICB9CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOehruiupOe8lui+keWcsOWdgAogICAg" +
  "ICAgIGZ1bmN0aW9uIGNvbmZpcm1FZGl0QWRkcmVzcyhjb21wYW55SWQpIHsKICAgICAgICAgICAg" +
  "Y29uc3QgbWFudWFsU2VsZWN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21hbnVhbFNlbGVj" +
  "dENoZWNrJykuY2hlY2tlZDsKICAgICAgICAgICAgY29uc3QgbmV3QWRkcmVzcyA9IGRvY3VtZW50" +
  "LmdldEVsZW1lbnRCeUlkKCdlZGl0QWRkcmVzc0lucHV0JykudmFsdWUudHJpbSgpOwogICAgICAg" +
  "ICAgICAKICAgICAgICAgICAgaWYgKCFuZXdBZGRyZXNzKSB7CiAgICAgICAgICAgICAgICBzaG93" +
  "VG9hc3QoJ+ivt+i+k+WFpeaWsOWcsOWdgCcsICdlcnJvcicpOwogICAgICAgICAgICAgICAgcmV0" +
  "dXJuOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICBpZiAobWFudWFsU2Vs" +
  "ZWN0KSB7CiAgICAgICAgICAgICAgICAvLyDov5vlhaXmiYvliqjlnLDlm77pgInngrnmqKHlvI8K" +
  "ICAgICAgICAgICAgICAgIGNsb3NlRWRpdE1vZGFsKCk7CiAgICAgICAgICAgICAgICBlbmFibGVN" +
  "YW51YWxNYXBTZWxlY3Rpb24oY29tcGFueUlkLCBuZXdBZGRyZXNzKTsKICAgICAgICAgICAgfSBl" +
  "bHNlIHsKICAgICAgICAgICAgICAgIC8vIOaQnOe0ouaWsOWcsOWdgAogICAgICAgICAgICAgICAg" +
  "c2VhcmNoTmV3QWRkcmVzc0ZvckVkaXQoY29tcGFueUlkLCBuZXdBZGRyZXNzKTsKICAgICAgICAg" +
  "ICAgfQogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDmkJzntKLmlrDlnLDlnYDvvIjnvJbo" +
  "vpHnlKjvvIkKICAgICAgICBmdW5jdGlvbiBzZWFyY2hOZXdBZGRyZXNzRm9yRWRpdChjb21wYW55" +
  "SWQsIGFkZHJlc3MpIHsKICAgICAgICAgICAgc2hvd0xvYWRpbmcodHJ1ZSk7CiAgICAgICAgICAg" +
  "IHBsYWNlU2VhcmNoLnNlYXJjaChhZGRyZXNzLCBmdW5jdGlvbihzdGF0dXMsIHJlc3VsdCkgewog" +
  "ICAgICAgICAgICAgICAgc2hvd0xvYWRpbmcoZmFsc2UpOwogICAgICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgICAgICBpZiAoc3RhdHVzID09PSAnY29tcGxldGUnICYmIHJlc3VsdC5wb2lMaXN0ICYm" +
  "IHJlc3VsdC5wb2lMaXN0LnBvaXMubGVuZ3RoID4gMCkgewogICAgICAgICAgICAgICAgICAgIGNv" +
  "bnN0IHBvaXMgPSByZXN1bHQucG9pTGlzdC5wb2lzOwogICAgICAgICAgICAgICAgICAgIGNvbnN0" +
  "IGNvbXBhbnkgPSBjb21wYW5pZXMuZmluZChjID0+IGMuaWQgPT09IGNvbXBhbnlJZCk7CiAgICAg" +
  "ICAgICAgICAgICAgICAgY29uc3Qgc2NvcmVkQ2FuZGlkYXRlcyA9IHNjb3JlQ2FuZGlkYXRlcyhw" +
  "b2lzLCBhZGRyZXNzLCBjb21wYW55Lm5hbWUpOwogICAgICAgICAgICAgICAgICAgIAogICAgICAg" +
  "ICAgICAgICAgICAgIC8vIOWFs+mXree8lui+keW8ueeql++8jOaYvuekuuWAmemAiemAieaLqeWZ" +
  "qAogICAgICAgICAgICAgICAgICAgIGNsb3NlRWRpdE1vZGFsKCk7CiAgICAgICAgICAgICAgICAg" +
  "ICAgc2hvd0VkaXRDYW5kaWRhdGVTZWxlY3Rvcihjb21wYW55SWQsIHNjb3JlZENhbmRpZGF0ZXMs" +
  "IGFkZHJlc3MpOwogICAgICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgICAgICAgICAv" +
  "LyDmkJzntKLlpLHotKXvvIzlnKjlvLnnqpflhoXmmL7npLrmj5DnpLoKICAgICAgICAgICAgICAg" +
  "ICAgICBzaG93Tm9SZXN1bHRJbkVkaXRNb2RhbCgpOwogICAgICAgICAgICAgICAgfQogICAgICAg" +
  "ICAgICB9KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5Zyo57yW6L6R5by556qX5YaF" +
  "5pi+56S65peg57uT5p6c5o+Q56S6CiAgICAgICAgZnVuY3Rpb24gc2hvd05vUmVzdWx0SW5FZGl0" +
  "TW9kYWwoKSB7CiAgICAgICAgICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5" +
  "SWQoJ2VkaXRBZGRyZXNzTW9kYWwnKTsKICAgICAgICAgICAgaWYgKCFtb2RhbCkgcmV0dXJuOwog" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgLy8g5qOA5p+l5piv5ZCm5bey5pyJ5o+Q56S6CiAgICAg" +
  "ICAgICAgIGxldCBoaW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25vUmVzdWx0SGludCcp" +
  "OwogICAgICAgICAgICBpZiAoaGludCkgaGludC5yZW1vdmUoKTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIC8vIOa3u+WKoOaPkOekuuWIsOW8ueeql+WGhQogICAgICAgICAgICBjb25zdCBjb250" +
  "ZW50ID0gbW9kYWwucXVlcnlTZWxlY3RvcignZGl2ID4gZGl2Om50aC1jaGlsZCgyKScpOwogICAg" +
  "ICAgICAgICBpZiAoY29udGVudCkgewogICAgICAgICAgICAgICAgaGludCA9IGRvY3VtZW50LmNy" +
  "ZWF0ZUVsZW1lbnQoJ2RpdicpOwogICAgICAgICAgICAgICAgaGludC5pZCA9ICdub1Jlc3VsdEhp" +
  "bnQnOwogICAgICAgICAgICAgICAgaGludC5zdHlsZS5jc3NUZXh0ID0gJ2JhY2tncm91bmQ6ICNm" +
  "ZWYyZjI7IGJvcmRlcjogMXB4IHNvbGlkICNlZjQ0NDQ7IGJvcmRlci1yYWRpdXM6IDZweDsgcGFk" +
  "ZGluZzogMTJweDsgbWFyZ2luOiAxNXB4IDA7IGZvbnQtc2l6ZTogMTNweDsgY29sb3I6ICNkYzI2" +
  "MjY7JzsKICAgICAgICAgICAgICAgIGhpbnQuaW5uZXJIVE1MID0gYAogICAgICAgICAgICAgICAg" +
  "ICAgIDxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OiA2MDA7IG1hcmdpbi1ib3R0b206IDRweDsiPuKd" +
  "jCDmnKrmib7liLDor6XlnLDlnYA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxl" +
  "PSJmb250LXNpemU6IDEycHg7Ij7lu7rorq7vvJrli77pgIki5omL5Yqo5Zyo5Zyw5Zu+5LiK54K5" +
  "6YCJIu+8jOebtOaOpeWcqOWcsOWbvuS4iuWumuS9jTwvZGl2PgogICAgICAgICAgICAgICAgYDsK" +
  "ICAgICAgICAgICAgICAgIGNvbnRlbnQuaW5zZXJ0QmVmb3JlKGhpbnQsIGNvbnRlbnQucXVlcnlT" +
  "ZWxlY3RvcignZGl2Omxhc3QtY2hpbGQnKSk7CiAgICAgICAgICAgIH0KICAgICAgICB9CiAgICAg" +
  "ICAgCiAgICAgICAgLy8g5pi+56S657yW6L6R5YCZ6YCJ6YCJ5oup5ZmoCiAgICAgICAgZnVuY3Rp" +
  "b24gc2hvd0VkaXRDYW5kaWRhdGVTZWxlY3Rvcihjb21wYW55SWQsIHNjb3JlZENhbmRpZGF0ZXMs" +
  "IHNlYXJjaEFkZHJlc3MpIHsKICAgICAgICAgICAgY29uc3QgY29tcGFueSA9IGNvbXBhbmllcy5m" +
  "aW5kKGMgPT4gYy5pZCA9PT0gY29tcGFueUlkKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIGxl" +
  "dCBodG1sID0gYAogICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDogd2hpdGU7" +
  "IGJvcmRlci1yYWRpdXM6IDEwcHg7IG1heC13aWR0aDogNTAwcHg7IHdpZHRoOiA5NSU7IG1heC1o" +
  "ZWlnaHQ6IDgwdmg7IG92ZXJmbG93OiBoaWRkZW47IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0" +
  "aW9uOiBjb2x1bW47IiBvbmNsaWNrPSJldmVudC5zdG9wUHJvcGFnYXRpb24oKSI+CiAgICAgICAg" +
  "ICAgICAgICAgICAgPGRpdiBzdHlsZT0icGFkZGluZzogMTVweCAyMHB4OyBiYWNrZ3JvdW5kOiBs" +
  "aW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjNjY3ZWVhIDAlLCAjNzY0YmEyIDEwMCUpOyBjb2xvcjog" +
  "d2hpdGU7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgPGgzIHN0eWxlPSJtYXJnaW46IDA7IGZv" +
  "bnQtc2l6ZTogMTZweDsiPumAieaLqeaWsOWcsOWdgDwvaDM+CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIDxwIHN0eWxlPSJtYXJnaW46IDVweCAwIDAgMDsgZm9udC1zaXplOiAxMnB4OyI+JHtjb21w" +
  "YW55Lm5hbWV9IC0gJHtzZWFyY2hBZGRyZXNzfTwvcD4KICAgICAgICAgICAgICAgICAgICA8L2Rp" +
  "dj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJwYWRkaW5nOiAxNXB4OyBvdmVyZmxv" +
  "dy15OiBhdXRvOyBmbGV4OiAxOyBtYXgtaGVpZ2h0OiA0MDBweDsiPgogICAgICAgICAgICBgOwog" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgc2NvcmVkQ2FuZGlkYXRlcy5zbGljZSgwLCA4KS5mb3JF" +
  "YWNoKChjYW5kaWRhdGUsIGluZGV4KSA9PiB7CiAgICAgICAgICAgICAgICBjb25zdCBwb2kgPSBj" +
  "YW5kaWRhdGUucG9pOwogICAgICAgICAgICAgICAgY29uc3QgZGlzdHJpY3QgPSBnZXRQb2lEaXN0" +
  "cmljdChwb2kpIHx8ICfmnKrnn6UnOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBs" +
  "ZXQgYm9yZGVyQ29sb3IgPSAnI2UwZTBlMCc7CiAgICAgICAgICAgICAgICBsZXQgYmdDb2xvciA9" +
  "ICcjZmFmYWZhJzsKICAgICAgICAgICAgICAgIGxldCBiYWRnZSA9ICcnOwogICAgICAgICAgICAg" +
  "ICAgCiAgICAgICAgICAgICAgICBpZiAoY2FuZGlkYXRlLmlzUmVjb21tZW5kZWQpIHsKICAgICAg" +
  "ICAgICAgICAgICAgICBib3JkZXJDb2xvciA9ICcjMTBiOTgxJzsKICAgICAgICAgICAgICAgICAg" +
  "ICBiZ0NvbG9yID0gJyNlY2ZkZjUnOwogICAgICAgICAgICAgICAgICAgIGJhZGdlID0gJzxzcGFu" +
  "IHN0eWxlPSJiYWNrZ3JvdW5kOiAjMTBiOTgxOyBjb2xvcjogd2hpdGU7IHBhZGRpbmc6IDJweCA4" +
  "cHg7IGJvcmRlci1yYWRpdXM6IDEwcHg7IGZvbnQtc2l6ZTogMTFweDsgbWFyZ2luLWxlZnQ6IDhw" +
  "eDsiPuKtkCDmjqjojZA8L3NwYW4+JzsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAg" +
  "IAogICAgICAgICAgICAgICAgaHRtbCArPSBgCiAgICAgICAgICAgICAgICAgICAgPGRpdiBvbmNs" +
  "aWNrPSJzZWxlY3RFZGl0Q2FuZGlkYXRlKCR7Y29tcGFueUlkfSwgJHtpbmRleH0pIiAKICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIHN0eWxlPSJib3JkZXI6IDJweCBzb2xpZCAke2JvcmRlckNvbG9y" +
  "fTsgYmFja2dyb3VuZDogJHtiZ0NvbG9yfTsgYm9yZGVyLXJhZGl1czogOHB4OyBwYWRkaW5nOiAx" +
  "MnB4OyBtYXJnaW4tYm90dG9tOiAxMHB4OyBjdXJzb3I6IHBvaW50ZXI7IHRyYW5zaXRpb246IGFs" +
  "bCAwLjJzOyIKICAgICAgICAgICAgICAgICAgICAgICAgIG9ubW91c2VvdmVyPSJ0aGlzLnN0eWxl" +
  "LmJveFNoYWRvdz0nMCAycHggOHB4IHJnYmEoMCwwLDAsMC4xKSciIAogICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgb25tb3VzZW91dD0idGhpcy5zdHlsZS5ib3hTaGFkb3c9J25vbmUnIj4KICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTogZmxleDsganVzdGlmeS1jb250" +
  "ZW50OiBzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczogc3RhcnQ7Ij4KICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OiA2MDA7IGNvbG9yOiAjMzMzOyBm" +
  "b250LXNpemU6IDE0cHg7Ij4ke3BvaS5uYW1lfSAke2JhZGdlfTwvZGl2PgogICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOiAxMXB4OyBjb2xvcjogIzY2Njsg" +
  "YmFja2dyb3VuZDogI2YwZjBmMDsgcGFkZGluZzogMnB4IDhweDsgYm9yZGVyLXJhZGl1czogNHB4" +
  "OyI+JHtkaXN0cmljdH3ljLo8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAg" +
  "ICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZTogMTJweDsgY29sb3I6" +
  "ICM2NjY7IG1hcmdpbi10b3A6IDZweDsgbGluZS1oZWlnaHQ6IDEuNDsiPgogICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgJHtwb2kuYWRkcmVzcyB8fCAn5pqC5peg6K+m57uG5Zyw5Z2AJ30KICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAg" +
  "ICAgICAgICAgICAgICBgOwogICAgICAgICAgICB9KTsKICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IGh0bWwgKz0gYAogICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgICAg" +
  "IDxkaXYgc3R5bGU9InBhZGRpbmc6IDE1cHg7IGJvcmRlci10b3A6IDFweCBzb2xpZCAjZWVlOyBi" +
  "YWNrZ3JvdW5kOiAjZjhmOWZhOyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9" +
  "ImJhY2tncm91bmQ6ICNmZmYzY2Q7IGJvcmRlcjogMXB4IHNvbGlkICNmZmMxMDc7IGJvcmRlci1y" +
  "YWRpdXM6IDZweDsgcGFkZGluZzogMTBweDsgbWFyZ2luLWJvdHRvbTogMTJweDsgZm9udC1zaXpl" +
  "OiAxMnB4OyBjb2xvcjogIzg1NjQwNDsiPgogICAgICAgICAgICAgICAgICAgICAgICAgICAg8J+S" +
  "oSDlpoLmnpzku6XkuIrlnLDlnYDpg73kuI3mraPnoa7vvIzngrnlh7vkuIvmlrnmjInpkq7miYvl" +
  "iqjlnKjlnLDlm77kuIrpgInmi6kKICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0ic3dpdGNoVG9NYW51YWxTZWxlY3Qo" +
  "JHtjb21wYW55SWR9LCAnJHtzZWFyY2hBZGRyZXNzLnJlcGxhY2UoLycvZywgIlxcJyIpfScpIiBz" +
  "dHlsZT0id2lkdGg6IDEwMCU7IHBhZGRpbmc6IDEwcHg7IGJvcmRlcjogMXB4IHNvbGlkICM2Njdl" +
  "ZWE7IGJhY2tncm91bmQ6IHdoaXRlOyBjb2xvcjogIzY2N2VlYTsgYm9yZGVyLXJhZGl1czogNnB4" +
  "OyBjdXJzb3I6IHBvaW50ZXI7IGZvbnQtc2l6ZTogMTNweDsiPvCfl7rvuI8g5omL5Yqo5Zyo5Zyw" +
  "5Zu+5LiK6YCJ54K5PC9idXR0b24+CiAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAg" +
  "ICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgYDsKICAgICAgICAgICAgCiAgICAgICAgICAgIGxl" +
  "dCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlZGl0Q2FuZGlkYXRlTW9kYWwnKTsK" +
  "ICAgICAgICAgICAgaWYgKCFtb2RhbCkgewogICAgICAgICAgICAgICAgbW9kYWwgPSBkb2N1bWVu" +
  "dC5jcmVhdGVFbGVtZW50KCdkaXYnKTsKICAgICAgICAgICAgICAgIG1vZGFsLmlkID0gJ2VkaXRD" +
  "YW5kaWRhdGVNb2RhbCc7CiAgICAgICAgICAgICAgICBtb2RhbC5zdHlsZS5jc3NUZXh0ID0gJ3Bv" +
  "c2l0aW9uOiBmaXhlZDsgdG9wOiAwOyBsZWZ0OiAwOyByaWdodDogMDsgYm90dG9tOiAwOyBiYWNr" +
  "Z3JvdW5kOiByZ2JhKDAsMCwwLDAuNSk7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50" +
  "ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyOyB6LWluZGV4OiAxMDAwMzsnOwogICAgICAgICAg" +
  "ICAgICAgbW9kYWwub25jbGljayA9IGZ1bmN0aW9uKGUpIHsKICAgICAgICAgICAgICAgICAgICBp" +
  "ZiAoZS50YXJnZXQgPT09IG1vZGFsKSB7CiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGFsLnN0" +
  "eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAg" +
  "ICAgfTsKICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobW9kYWwpOwog" +
  "ICAgICAgICAgICB9CiAgICAgICAgICAgIG1vZGFsLmlubmVySFRNTCA9IGh0bWw7CiAgICAgICAg" +
  "ICAgIG1vZGFsLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7CiAgICAgICAgICAgIAogICAgICAgICAg" +
  "ICB3aW5kb3cuZWRpdENhbmRpZGF0ZXMgPSBzY29yZWRDYW5kaWRhdGVzOwogICAgICAgICAgICB3" +
  "aW5kb3cuY3VycmVudEVkaXRDb21wYW55SWQgPSBjb21wYW55SWQ7CiAgICAgICAgfQogICAgICAg" +
  "IAogICAgICAgIC8vIOmAieaLqee8lui+keWAmemAiQogICAgICAgIGZ1bmN0aW9uIHNlbGVjdEVk" +
  "aXRDYW5kaWRhdGUoY29tcGFueUlkLCBpbmRleCkgewogICAgICAgICAgICBjb25zdCBjYW5kaWRh" +
  "dGUgPSB3aW5kb3cuZWRpdENhbmRpZGF0ZXNbaW5kZXhdOwogICAgICAgICAgICBjb25zdCBwb2kg" +
  "PSBjYW5kaWRhdGUucG9pOwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g5re75Yqg5Yiw5b6F" +
  "57yW6L6R5YiX6KGoCiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nRWRpdCA9IHBlbmRpbmdDaGFu" +
  "Z2VzLmVkaXQuZmluZChlID0+IGUuaWQgPT09IGNvbXBhbnlJZCk7CiAgICAgICAgICAgIGlmIChl" +
  "eGlzdGluZ0VkaXQpIHsKICAgICAgICAgICAgICAgIGV4aXN0aW5nRWRpdC5uZXdBZGRyZXNzID0g" +
  "cG9pLmFkZHJlc3MgfHwgcG9pLm5hbWU7CiAgICAgICAgICAgICAgICBleGlzdGluZ0VkaXQubmV3" +
  "TG5nID0gcG9pLmxvY2F0aW9uLmxuZzsKICAgICAgICAgICAgICAgIGV4aXN0aW5nRWRpdC5uZXdM" +
  "YXQgPSBwb2kubG9jYXRpb24ubGF0OwogICAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAg" +
  "ICAgcGVuZGluZ0NoYW5nZXMuZWRpdC5wdXNoKHsKICAgICAgICAgICAgICAgICAgICBpZDogY29t" +
  "cGFueUlkLAogICAgICAgICAgICAgICAgICAgIG5ld0FkZHJlc3M6IHBvaS5hZGRyZXNzIHx8IHBv" +
  "aS5uYW1lLAogICAgICAgICAgICAgICAgICAgIG5ld0xuZzogcG9pLmxvY2F0aW9uLmxuZywKICAg" +
  "ICAgICAgICAgICAgICAgICBuZXdMYXQ6IHBvaS5sb2NhdGlvbi5sYXQKICAgICAgICAgICAgICAg" +
  "IH0pOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlhbPpl63lvLnn" +
  "qpcKICAgICAgICAgICAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZWRp" +
  "dENhbmRpZGF0ZU1vZGFsJyk7CiAgICAgICAgICAgIGlmIChtb2RhbCkgbW9kYWwuc3R5bGUuZGlz" +
  "cGxheSA9ICdub25lJzsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOabtOaWsOeVjOmdogog" +
  "ICAgICAgICAgICByZW5kZXJDb21wYW55TGlzdFdpdGhQZW5kaW5nKCk7CiAgICAgICAgICAgIHJl" +
  "bmRlck1hcmtlcnNXaXRoUGVuZGluZygpOwogICAgICAgICAgICAKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIHNob3dUb2FzdCgn5bey5qCH6K6w5L+u5pS577yM6K+354K55Ye7IuS/neWtmOS/ruaU" +
  "uSLnlJ/mlYgnLCAnc3VjY2VzcycpOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDliIfm" +
  "jaLliLDmiYvliqjpgInmi6kKICAgICAgICBmdW5jdGlvbiBzd2l0Y2hUb01hbnVhbFNlbGVjdChj" +
  "b21wYW55SWQsIGFkZHJlc3MpIHsKICAgICAgICAgICAgLy8g5YWz6Zet5YCZ6YCJ6YCJ5oup5by5" +
  "56qXCiAgICAgICAgICAgIGNvbnN0IGNhbmRpZGF0ZU1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVu" +
  "dEJ5SWQoJ2VkaXRDYW5kaWRhdGVNb2RhbCcpOwogICAgICAgICAgICBpZiAoY2FuZGlkYXRlTW9k" +
  "YWwpIGNhbmRpZGF0ZU1vZGFsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICAvLyDlhbPpl63nvJbovpHlnLDlnYDlvLnnqpfvvIjlpoLmnpzov5jlvIDnnYDv" +
  "vIkKICAgICAgICAgICAgY29uc3QgZWRpdE1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQo" +
  "J2VkaXRBZGRyZXNzTW9kYWwnKTsKICAgICAgICAgICAgaWYgKGVkaXRNb2RhbCkgZWRpdE1vZGFs" +
  "LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICAgICAgICAgIAogICAgICAgICAgICBlbmFibGVN" +
  "YW51YWxNYXBTZWxlY3Rpb24oY29tcGFueUlkLCBhZGRyZXNzKTsKICAgICAgICB9CiAgICAgICAg" +
  "CiAgICAgICAgLy8g5ZCv55So5omL5Yqo5Zyw5Zu+6YCJ5oup77yI5Y+v5ouW5Yqo77yJCiAgICAg" +
  "ICAgZnVuY3Rpb24gZW5hYmxlTWFudWFsTWFwU2VsZWN0aW9uKGNvbXBhbnlJZCwgYWRkcmVzcykg" +
  "ewogICAgICAgICAgICBzaG93VG9hc3QoJ/Cfl7rvuI8g6K+35Zyo5Zyw5Zu+5LiK54K55Ye76YCJ" +
  "5oup5L2N572u77yM5Y+v5ouW5Yqo5b6u6LCDJywgJ3N1Y2Nlc3MnLCA1MDAwKTsKICAgICAgICAg" +
  "ICAgCiAgICAgICAgICAgIC8vIOeCueWHu+WcsOWbvuaUvue9ruagh+iusAogICAgICAgICAgICBj" +
  "b25zdCBjbGlja0hhbmRsZXIgPSBmdW5jdGlvbihlKSB7CiAgICAgICAgICAgICAgICBjb25zdCBs" +
  "bmdsYXQgPSBlLmxuZ2xhdDsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgLy8g5riF" +
  "6Zmk5LmL5YmN55qE5Li05pe25qCH6K6wCiAgICAgICAgICAgICAgICBpZiAodGVtcEVkaXRNYXJr" +
  "ZXIpIHsKICAgICAgICAgICAgICAgICAgICBtYXAucmVtb3ZlKHRlbXBFZGl0TWFya2VyKTsKICAg" +
  "ICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgLy8g5Yib5bu6" +
  "5Y+v5ouW5Yqo55qE5Li05pe25qCH6K6wCiAgICAgICAgICAgICAgICB0ZW1wRWRpdE1hcmtlciA9" +
  "IG5ldyBBTWFwLk1hcmtlcih7CiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IGxuZ2xhdCwK" +
  "ICAgICAgICAgICAgICAgICAgICBkcmFnZ2FibGU6IHRydWUsCiAgICAgICAgICAgICAgICAgICAg" +
  "dGl0bGU6ICfmi5bliqjosIPmlbTkvY3nva4nLAogICAgICAgICAgICAgICAgICAgIGxhYmVsOiB7" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5k" +
  "OiAjZjU5ZTBiOyBjb2xvcjogd2hpdGU7IHBhZGRpbmc6IDRweCA4cHg7IGJvcmRlci1yYWRpdXM6" +
  "IDRweDsgZm9udC1zaXplOiAxMnB4OyI+5ouW5Yqo6LCD5pW0PC9kaXY+JywKICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgZGlyZWN0aW9uOiAndG9wJwogICAgICAgICAgICAgICAgICAgIH0KICAgICAg" +
  "ICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBtYXAuYWRkKHRl" +
  "bXBFZGl0TWFya2VyKTsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgLy8g55u05o6l" +
  "55Sf5pWI77yM5LiN5by55Ye656Gu6K6kCiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+" +
  "IHsKICAgICAgICAgICAgICAgICAgICBjb25zdCBmaW5hbFBvc2l0aW9uID0gdGVtcEVkaXRNYXJr" +
  "ZXIuZ2V0UG9zaXRpb24oKTsKICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAg" +
  "ICAvLyDnm7TmjqXmm7TmlrDlhazlj7jkv6Hmga8KICAgICAgICAgICAgICAgICAgICBjb25zdCBj" +
  "b21wYW55ID0gY29tcGFuaWVzLmZpbmQoYyA9PiBjLmlkID09PSBjb21wYW55SWQpOwogICAgICAg" +
  "ICAgICAgICAgICAgIGlmIChjb21wYW55KSB7CiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBh" +
  "bnkuYWRkcmVzcyA9IGFkZHJlc3MgKyAnICjmiYvliqjpgInngrkpJzsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgY29tcGFueS5sbmcgPSBmaW5hbFBvc2l0aW9uLmxuZzsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgY29tcGFueS5sYXQgPSBmaW5hbFBvc2l0aW9uLmxhdDsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOS/neWtmOW5tuabtOaWsAogICAg" +
  "ICAgICAgICAgICAgICAgICAgICBzYXZlVG9Mb2NhbFN0b3JhZ2UoKTsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgcmVuZGVyQ29tcGFueUxpc3QoKTsKICAgICAgICAgICAgICAgICAgICAgICAgcmVu" +
  "ZGVyTWFya2VycygpOwogICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgLy8g5aaC5p6c6K+l5YWs5Y+45Zyo5LyY5YyW6Lev57q/5Lit77yM5pu05paw6Lev57q/" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcHRpbWl6ZWRSb3V0ZS5sZW5ndGggPiAwKSB7" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3V0ZUluZGV4ID0gb3B0aW1pemVk" +
  "Um91dGUuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gY29tcGFueUlkKTsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgIGlmIChyb3V0ZUluZGV4ID49IDApIHsKICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgICBvcHRpbWl6ZWRSb3V0ZVtyb3V0ZUluZGV4XSA9IGNvbXBhbnk7CiAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyRHJhZ2dhYmxlUm91dGVMaXN0KG9wdGltaXpl" +
  "ZFJvdXRlKTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBsYW5Sb3V0ZUJ5T3Jk" +
  "ZXIoKTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgfQogICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgc2hv" +
  "d1RvYXN0KCfinIUg5L2N572u5bey5pu05pawJywgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgICAg" +
  "ICAgICB9CiAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g5riF55CG" +
  "CiAgICAgICAgICAgICAgICAgICAgbWFwLm9mZignY2xpY2snLCBjbGlja0hhbmRsZXIpOwogICAg" +
  "ICAgICAgICAgICAgICAgIG1hcC5yZW1vdmUodGVtcEVkaXRNYXJrZXIpOwogICAgICAgICAgICAg" +
  "ICAgICAgIHRlbXBFZGl0TWFya2VyID0gbnVsbDsKICAgICAgICAgICAgICAgICAgICAKICAgICAg" +
  "ICAgICAgICAgICAgICAvLyDlhbPpl63lnLDlm77kuIrnmoTkv6Hmga/nqpcKICAgICAgICAgICAg" +
  "ICAgICAgICBtYXAuY2xlYXJJbmZvV2luZG93KCk7CiAgICAgICAgICAgICAgICB9LCAxMDApOwog" +
  "ICAgICAgICAgICB9OwogICAgICAgICAgICAKICAgICAgICAgICAgbWFwLm9uKCdjbGljaycsIGNs" +
  "aWNrSGFuZGxlcik7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyAzMOenkuWQjuiHquWKqOWP" +
  "lua2iAogICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsKICAgICAgICAgICAgICAgIG1hcC5v" +
  "ZmYoJ2NsaWNrJywgY2xpY2tIYW5kbGVyKTsKICAgICAgICAgICAgICAgIGlmICh0ZW1wRWRpdE1h" +
  "cmtlciAmJiAhcGVuZGluZ0NoYW5nZXMuZWRpdC5maW5kKGUgPT4gZS5pZCA9PT0gY29tcGFueUlk" +
  "KSkgewogICAgICAgICAgICAgICAgICAgIG1hcC5yZW1vdmUodGVtcEVkaXRNYXJrZXIpOwogICAg" +
  "ICAgICAgICAgICAgICAgIHRlbXBFZGl0TWFya2VyID0gbnVsbDsKICAgICAgICAgICAgICAgIH0K" +
  "ICAgICAgICAgICAgfSwgMzAwMDApOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDmmL7n" +
  "pLrluKblvoXkv67mlLnmoIforrDnmoTlhazlj7jliJfooagKICAgICAgICBmdW5jdGlvbiByZW5k" +
  "ZXJDb21wYW55TGlzdFdpdGhQZW5kaW5nKCkgewogICAgICAgICAgICBjb25zdCBsaXN0Q29udGFp" +
  "bmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbXBhbnlMaXN0Jyk7CiAgICAgICAgICAg" +
  "IAogICAgICAgICAgICAvLyDov4fmu6TmjonlvoXliKDpmaTnmoQKICAgICAgICAgICAgY29uc3Qg" +
  "dmlzaWJsZUNvbXBhbmllcyA9IGNvbXBhbmllcy5maWx0ZXIoYyA9PiAhcGVuZGluZ0NoYW5nZXMu" +
  "ZGVsZXRlLmluY2x1ZGVzKGMuaWQpKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOagh+iu" +
  "sOW+hee8lui+keeahAogICAgICAgICAgICBjb25zdCBnZXRDb21wYW55RGlzcGxheSA9IChjb21w" +
  "YW55KSA9PiB7CiAgICAgICAgICAgICAgICBjb25zdCBlZGl0SW5mbyA9IHBlbmRpbmdDaGFuZ2Vz" +
  "LmVkaXQuZmluZChlID0+IGUuaWQgPT09IGNvbXBhbnkuaWQpOwogICAgICAgICAgICAgICAgaWYg" +
  "KGVkaXRJbmZvKSB7CiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgLi4uY29tcGFueSwKICAgICAgICAgICAgICAgICAgICAgICAgYWRkcmVzczogZWRp" +
  "dEluZm8ubmV3QWRkcmVzcyArICcgKOW+heS/ruaUuSknLAogICAgICAgICAgICAgICAgICAgICAg" +
  "ICBfaXNQZW5kaW5nRWRpdDogdHJ1ZQogICAgICAgICAgICAgICAgICAgIH07CiAgICAgICAgICAg" +
  "ICAgICB9CiAgICAgICAgICAgICAgICByZXR1cm4gY29tcGFueTsKICAgICAgICAgICAgfTsKICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlDb21wYW5pZXMgPSB2aXNpYmxlQ29t" +
  "cGFuaWVzLm1hcChnZXRDb21wYW55RGlzcGxheSk7CiAgICAgICAgICAgIAogICAgICAgICAgICAv" +
  "LyDmuLLmn5PpgLvovpHvvIjnsbvkvLzljp9yZW5kZXJDb21wYW55TGlzdOS9huS9v+eUqGRpc3Bs" +
  "YXlDb21wYW5pZXPvvIkKICAgICAgICAgICAgLy8gLi4uIOi/memHjOWkjeeUqOWOn+adpeeahOa4" +
  "suafk+mAu+i+kQogICAgICAgICAgICByZW5kZXJDb21wYW55TGlzdFdpdGhEYXRhKGRpc3BsYXlD" +
  "b21wYW5pZXMpOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDkvb/nlKjmjIflrprmlbDm" +
  "ja7muLLmn5Plhazlj7jliJfooagKICAgICAgICBmdW5jdGlvbiByZW5kZXJDb21wYW55TGlzdFdp" +
  "dGhEYXRhKGRhdGEpIHsKICAgICAgICAgICAgY29uc3QgbGlzdENvbnRhaW5lciA9IGRvY3VtZW50" +
  "LmdldEVsZW1lbnRCeUlkKCdjb21wYW55TGlzdCcpOwogICAgICAgICAgICAKICAgICAgICAgICAg" +
  "aWYgKGRhdGEubGVuZ3RoID09PSAwICYmIHBlbmRpbmdDb21wYW5pZXMubGVuZ3RoID09PSAwKSB7" +
  "CiAgICAgICAgICAgICAgICBsaXN0Q29udGFpbmVyLmlubmVySFRNTCA9ICc8cCBzdHlsZT0iY29s" +
  "b3I6ICM5OTk7IHRleHQtYWxpZ246IGNlbnRlcjsgcGFkZGluZzogMTVweDsgZm9udC1zaXplOiAx" +
  "MnB4OyI+5pqC5peg5YWs5Y+45L+h5oGv77yM6K+35re75Yqg5oiW5a+85YWlPC9wPic7CiAgICAg" +
  "ICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IGxldCBodG1sID0gJyc7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDlvoXnoa7orqTnmoTl" +
  "hazlj7gKICAgICAgICAgICAgaWYgKHBlbmRpbmdDb21wYW5pZXMubGVuZ3RoID4gMCkgewogICAg" +
  "ICAgICAgICAgICAgaHRtbCArPSAnPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTogMTBweDsgZm9u" +
  "dC1zaXplOiAxMXB4OyBjb2xvcjogI2Y1OWUwYjsgZm9udC13ZWlnaHQ6IDYwMDsiPuKaoO+4jyDl" +
  "nLDlnYDlvoXnoa7orqQgKCcgKyBwZW5kaW5nQ29tcGFuaWVzLmxlbmd0aCArICcpPC9kaXY+JzsK" +
  "ICAgICAgICAgICAgICAgIGh0bWwgKz0gcGVuZGluZ0NvbXBhbmllcy5tYXAoKGNvbXBhbnksIGlu" +
  "ZGV4KSA9PiBgCiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1pdGVtIiBz" +
  "dHlsZT0iYm9yZGVyLWxlZnQtY29sb3I6ICNmNTllMGI7IGJhY2tncm91bmQ6ICNmZmZiZWI7Ij4K" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1pbmZvIj4KICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNvbXBhbnktbmFtZSI+JHtjb21wYW55" +
  "Lm5hbWV9PC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb21w" +
  "YW55LWFkZHJlc3MiIHN0eWxlPSJjb2xvcjogI2Q5NzcwNjsiPiR7Y29tcGFueS5hZGRyZXNzfTwv" +
  "ZGl2PgogICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgPGRpdiBjbGFzcz0iY29tcGFueS1hY3Rpb25zIj4KICAgICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIDxidXR0b24gY2xhc3M9ImJ0bi1zbWFsbCIgb25jbGljaz0iZWRpdFBlbmRpbmdDb21wYW55" +
  "KCR7aW5kZXh9KSIgc3R5bGU9ImJhY2tncm91bmQ6ICNmNTllMGI7IGNvbG9yOiB3aGl0ZTsiPuS/" +
  "ruaUuTwvYnV0dG9uPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0i" +
  "YnRuLXNtYWxsIGJ0bi1kZWxldGUiIG9uY2xpY2s9ImRlbGV0ZVBlbmRpbmdDb21wYW55KCR7aW5k" +
  "ZXh9KSI+5Yig6ZmkPC9idXR0b24+CiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAg" +
  "ICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgYCkuam9pbignJyk7CiAgICAg" +
  "ICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOW3suehruiupOeahOWFrOWPuO+8" +
  "iOWQq+W+heS/ruaUueagh+iusO+8iQogICAgICAgICAgICBpZiAoZGF0YS5sZW5ndGggPiAwKSB7" +
  "CiAgICAgICAgICAgICAgICBodG1sICs9ICc8ZGl2IHN0eWxlPSJtYXJnaW46IDE1cHggMCAxMHB4" +
  "IDA7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICM2NjdlZWE7IGZvbnQtd2VpZ2h0OiA2MDA7Ij7l" +
  "t7Lnoa7orqQgKCcgKyBkYXRhLmxlbmd0aCArICcpPC9kaXY+JzsKICAgICAgICAgICAgICAgIGh0" +
  "bWwgKz0gZGF0YS5tYXAoY29tcGFueSA9PiBgCiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFz" +
  "cz0iY29tcGFueS1pdGVtIiBzdHlsZT0iJHtjb21wYW55Ll9pc1BlbmRpbmdFZGl0ID8gJ2JvcmRl" +
  "ci1sZWZ0LWNvbG9yOiAjNjY3ZWVhOyBiYWNrZ3JvdW5kOiAjZWVmMmZmOycgOiAnJ30iPgogICAg" +
  "ICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb21wYW55LWluZm8iPgogICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29tcGFueS1uYW1lIj4ke2NvbXBhbnkubmFt" +
  "ZX08L2Rpdj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNvbXBhbnkt" +
  "YWRkcmVzcyIgc3R5bGU9IiR7Y29tcGFueS5faXNQZW5kaW5nRWRpdCA/ICdjb2xvcjogIzY2N2Vl" +
  "YTsnIDogJyd9Ij4ke2NvbXBhbnkuYWRkcmVzc308L2Rpdj4KICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNvbXBhbnktYWN0" +
  "aW9ucyI+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJidG4tc21h" +
  "bGwgYnRuLWRlbGV0ZSIgb25jbGljaz0iZGVsZXRlQ29tcGFueSgke2NvbXBhbnkuaWR9KSI+5Yig" +
  "6ZmkPC9idXR0b24+CiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAg" +
  "ICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgYCkuam9pbignJyk7CiAgICAgICAgICAgIH0K" +
  "ICAgICAgICAgICAgCiAgICAgICAgICAgIGxpc3RDb250YWluZXIuaW5uZXJIVE1MID0gaHRtbDsK" +
  "ICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5pi+56S65bim5b6F5L+u5pS55qCH6K6w55qE" +
  "5Zyw5Zu+5qCH6K6wCiAgICAgICAgZnVuY3Rpb24gcmVuZGVyTWFya2Vyc1dpdGhQZW5kaW5nKCkg" +
  "ewogICAgICAgICAgICAvLyDmuIXpmaTnjrDmnInmoIforrAKICAgICAgICAgICAgbWFya2Vycy5m" +
  "b3JFYWNoKG1hcmtlciA9PiB7CiAgICAgICAgICAgICAgICBtYXAucmVtb3ZlKG1hcmtlcik7CiAg" +
  "ICAgICAgICAgIH0pOwogICAgICAgICAgICBtYXJrZXJzID0gW107CiAgICAgICAgICAgIAogICAg" +
  "ICAgICAgICAvLyDov4fmu6TmjonlvoXliKDpmaTnmoQKICAgICAgICAgICAgY29uc3QgdmlzaWJs" +
  "ZUNvbXBhbmllcyA9IGNvbXBhbmllcy5maWx0ZXIoYyA9PiAhcGVuZGluZ0NoYW5nZXMuZGVsZXRl" +
  "LmluY2x1ZGVzKGMuaWQpKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOW6lOeUqOW+hee8" +
  "lui+keeahOWdkOaghwogICAgICAgICAgICBjb25zdCBkaXNwbGF5Q29tcGFuaWVzID0gdmlzaWJs" +
  "ZUNvbXBhbmllcy5tYXAoY29tcGFueSA9PiB7CiAgICAgICAgICAgICAgICBjb25zdCBlZGl0SW5m" +
  "byA9IHBlbmRpbmdDaGFuZ2VzLmVkaXQuZmluZChlID0+IGUuaWQgPT09IGNvbXBhbnkuaWQpOwog" +
  "ICAgICAgICAgICAgICAgaWYgKGVkaXRJbmZvKSB7CiAgICAgICAgICAgICAgICAgICAgcmV0dXJu" +
  "IHsKICAgICAgICAgICAgICAgICAgICAgICAgLi4uY29tcGFueSwKICAgICAgICAgICAgICAgICAg" +
  "ICAgICAgbG5nOiBlZGl0SW5mby5uZXdMbmcsCiAgICAgICAgICAgICAgICAgICAgICAgIGxhdDog" +
  "ZWRpdEluZm8ubmV3TGF0LAogICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiBlZGl0SW5m" +
  "by5uZXdBZGRyZXNzLAogICAgICAgICAgICAgICAgICAgICAgICBfaXNQZW5kaW5nRWRpdDogdHJ1" +
  "ZQogICAgICAgICAgICAgICAgICAgIH07CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAg" +
  "ICByZXR1cm4gY29tcGFueTsKICAgICAgICAgICAgfSk7CiAgICAgICAgICAgIAogICAgICAgICAg" +
  "ICAvLyDph43mlrDmuLLmn5PmoIforrDvvIjkvb/nlKhkaXNwbGF5Q29tcGFuaWVz77yJCiAgICAg" +
  "ICAgICAgIGNvbnN0IGdldERpc3BsYXlOdW1iZXIgPSAoY29tcGFueSkgPT4gewogICAgICAgICAg" +
  "ICAgICAgaWYgKG9wdGltaXplZFJvdXRlLmxlbmd0aCA+IDApIHsKICAgICAgICAgICAgICAgICAg" +
  "ICBjb25zdCByb3V0ZUluZGV4ID0gb3B0aW1pemVkUm91dGUuZmluZEluZGV4KGMgPT4gYy5pZCA9" +
  "PT0gY29tcGFueS5pZCk7CiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJvdXRlSW5kZXggPj0g" +
  "MCA/IHJvdXRlSW5kZXggKyAxIDogJy0nOwogICAgICAgICAgICAgICAgfQogICAgICAgICAgICAg" +
  "ICAgY29uc3QgaW5kZXggPSBkaXNwbGF5Q29tcGFuaWVzLmZpbmRJbmRleChjID0+IGMuaWQgPT09" +
  "IGNvbXBhbnkuaWQpOwogICAgICAgICAgICAgICAgcmV0dXJuIGluZGV4ICsgMTsKICAgICAgICAg" +
  "ICAgfTsKICAgICAgICAgICAgCiAgICAgICAgICAgIGRpc3BsYXlDb21wYW5pZXMuZm9yRWFjaCgo" +
  "Y29tcGFueSkgPT4gewogICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheU51bWJlciA9IGdldERp" +
  "c3BsYXlOdW1iZXIoY29tcGFueSk7CiAgICAgICAgICAgICAgICBjb25zdCBpc1BlbmRpbmdFZGl0" +
  "ID0gY29tcGFueS5faXNQZW5kaW5nRWRpdDsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAg" +
  "ICAgY29uc3QgbWFya2VyID0gbmV3IEFNYXAuTWFya2VyKHsKICAgICAgICAgICAgICAgICAgICBw" +
  "b3NpdGlvbjogW2NvbXBhbnkubG5nLCBjb21wYW55LmxhdF0sCiAgICAgICAgICAgICAgICAgICAg" +
  "dGl0bGU6IGAke2NvbXBhbnkubmFtZX1cXG4ke2NvbXBhbnkuYWRkcmVzc31gLAogICAgICAgICAg" +
  "ICAgICAgICAgIGxhYmVsOiB7CiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGA8ZGl2" +
  "IHN0eWxlPSJiYWNrZ3JvdW5kOiAke2lzUGVuZGluZ0VkaXQgPyAnI2Y1OWUwYicgOiAnIzY2N2Vl" +
  "YSd9OyBjb2xvcjogd2hpdGU7IHBhZGRpbmc6IDRweCA4cHg7IGJvcmRlci1yYWRpdXM6IDUwJTsg" +
  "Zm9udC1zaXplOiAxMnB4OyBmb250LXdlaWdodDogYm9sZDsgbWluLXdpZHRoOiAyNHB4OyBoZWln" +
  "aHQ6IDI0cHg7IGxpbmUtaGVpZ2h0OiAxNnB4OyB0ZXh0LWFsaWduOiBjZW50ZXI7IGJveC1zaXpp" +
  "bmc6IGJvcmRlci1ib3g7Ij4ke2Rpc3BsYXlOdW1iZXJ9PC9kaXY+YCwKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgZGlyZWN0aW9uOiAndG9wJywKICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0" +
  "OiBuZXcgQU1hcC5QaXhlbCgwLCAtNSkKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAg" +
  "ICAgICB9KTsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgbWFya2VyLm9uKCdjbGlj" +
  "aycsICgpID0+IHsKICAgICAgICAgICAgICAgICAgICBzaG93TWFya2VySW5mb1dpbmRvdyhjb21w" +
  "YW55LCBtYXJrZXIpOwogICAgICAgICAgICAgICAgfSk7CiAgICAgICAgICAgICAgICAKICAgICAg" +
  "ICAgICAgICAgIG1hcmtlcnMucHVzaChtYXJrZXIpOwogICAgICAgICAgICAgICAgbWFwLmFkZCht" +
  "YXJrZXIpOwogICAgICAgICAgICB9KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5rOo" +
  "77ya5bey56e76Zmk5b6F5L+d5a2Y5py65Yi277yM5omA5pyJ5L+u5pS555u05o6l55Sf5pWICiAg" +
  "ICAgICAgCiAgICAgICAgLy8g5Yig6Zmk5YWs5Y+4CiAgICAgICAgZnVuY3Rpb24gZGVsZXRlQ29t" +
  "cGFueShpZCkgewogICAgICAgICAgICBjb21wYW5pZXMgPSBjb21wYW5pZXMuZmlsdGVyKGMgPT4g" +
  "Yy5pZCAhPT0gaWQpOwogICAgICAgICAgICBzYXZlVG9Mb2NhbFN0b3JhZ2UoKTsKICAgICAgICAg" +
  "ICAgcmVuZGVyQ29tcGFueUxpc3QoKTsKICAgICAgICAgICAgcmVuZGVyTWFya2VycygpOwogICAg" +
  "ICAgICAgICBzaG93VG9hc3QoJ/Cfl5HvuI8g5YWs5Y+45Yig6Zmk5oiQ5Yqf77yBJywgJ3N1Y2Nl" +
  "c3MnKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOa4hemZpOS8mOWMlui3r+e6vwogICAg" +
  "ICAgICAgICBvcHRpbWl6ZWRSb3V0ZSA9IFtdOwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g" +
  "6ZqQ6JeP57uT5p6c6Z2i5p2/CiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdy" +
  "ZXN1bHRQYW5lbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIC8vIOa4hemZpOi3r+e6vwogICAgICAgICAgICBpZiAoZHJpdmluZykgewogICAgICAg" +
  "ICAgICAgICAgZHJpdmluZy5jbGVhcigpOwogICAgICAgICAgICB9CiAgICAgICAgfQogICAgICAg" +
  "IAogICAgICAgIC8vIOa4heepuuaJgOacieaVsOaNrgogICAgICAgIGZ1bmN0aW9uIGNsZWFyQWxs" +
  "KCkgewogICAgICAgICAgICBpZiAoIWNvbmZpcm0oJ+ehruWumuimgea4heepuuaJgOacieWFrOWP" +
  "uOaVsOaNruWQl++8nycpKSB7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0K" +
  "ICAgICAgICAgICAgCiAgICAgICAgICAgIGNvbXBhbmllcyA9IFtdOwogICAgICAgICAgICBvcHRp" +
  "bWl6ZWRSb3V0ZSA9IFtdOwogICAgICAgICAgICBzYXZlVG9Mb2NhbFN0b3JhZ2UoKTsKICAgICAg" +
  "ICAgICAgcmVuZGVyQ29tcGFueUxpc3QoKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOa4" +
  "hemZpOagh+iusAogICAgICAgICAgICBtYXJrZXJzLmZvckVhY2gobWFya2VyID0+IHsKICAgICAg" +
  "ICAgICAgICAgIG1hcC5yZW1vdmUobWFya2VyKTsKICAgICAgICAgICAgfSk7CiAgICAgICAgICAg" +
  "IG1hcmtlcnMgPSBbXTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOa4hemZpOi3r+e6vwog" +
  "ICAgICAgICAgICBpZiAoZHJpdmluZykgewogICAgICAgICAgICAgICAgZHJpdmluZy5jbGVhcigp" +
  "OwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDpmpDol4/nu5Pmnpzp" +
  "naLmnb8KICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3VsdFBhbmVsJyku" +
  "Y2xhc3NMaXN0LnJlbW92ZSgnc2hvdycpOwogICAgICAgICAgICAKICAgICAgICAgICAgc2hvd1Rv" +
  "YXN0KCfwn5eR77iPIOaJgOacieaVsOaNruW3sua4heepuu+8gScsICdzdWNjZXNzJyk7CiAgICAg" +
  "ICAgfQogICAgICAgIAogICAgICAgIC8vIOinhOWIkui3r+e6v++8iFRTUOeul+azlSArIOmrmOW+" +
  "t+i3r+W+hOinhOWIku+8iQogICAgICAgIGZ1bmN0aW9uIHBsYW5Sb3V0ZSgpIHsKICAgICAgICAg" +
  "ICAgaWYgKGNvbXBhbmllcy5sZW5ndGggPCAyKSB7CiAgICAgICAgICAgICAgICBzaG93VG9hc3Qo" +
  "J+KdjCDor7foh7PlsJHmt7vliqAy5a625YWs5Y+45omN6IO96KeE5YiS6Lev57q/77yBJywgJ2Vy" +
  "cm9yJyk7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgIHNob3dMb2FkaW5nKHRydWUpOwogICAgICAgICAgICAKICAgICAgICAgICAg" +
  "dHJ5IHsKICAgICAgICAgICAgICAgIC8vIOS9v+eUqOeul+azleS8mOWMlui3r+e6v+mhuuW6jwog" +
  "ICAgICAgICAgICAgICAgb3B0aW1pemVkUm91dGUgPSBvcHRpbWl6ZVJvdXRlKGNvbXBhbmllcyk7" +
  "CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIC8vIOiwg+eUqOmrmOW+t+mpvui9pui3" +
  "r+W+hOinhOWIkgogICAgICAgICAgICAgICAgcGxvdERyaXZpbmdSb3V0ZShvcHRpbWl6ZWRSb3V0" +
  "ZSk7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn8J+agCDot6/n" +
  "ur/op4TliJLlrozmiJDvvIEnLCAnc3VjY2VzcycpOwogICAgICAgICAgICB9IGNhdGNoIChlcnJv" +
  "cikgewogICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign6Lev57q/6KeE5YiS5aSx6LSlOics" +
  "IGVycm9yKTsKICAgICAgICAgICAgICAgIHNob3dUb2FzdChg4p2MIOi3r+e6v+inhOWIkuWksei0" +
  "pTogJHtlcnJvci5tZXNzYWdlfWAsICdlcnJvcicpOwogICAgICAgICAgICB9CiAgICAgICAgICAg" +
  "IAogICAgICAgICAgICBzaG93TG9hZGluZyhmYWxzZSk7CiAgICAgICAgfQogICAgICAgIAogICAg" +
  "ICAgIC8vIOS8mOWMlui3r+e6v+eul+azle+8iOi0quW/gyArIDItb3B077yJCiAgICAgICAgZnVu" +
  "Y3Rpb24gb3B0aW1pemVSb3V0ZShjb21wYW5pZXMpIHsKICAgICAgICAgICAgaWYgKGNvbXBhbmll" +
  "cy5sZW5ndGggPT09IDApIHJldHVybiBbXTsKICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOiu" +
  "oeeul+S4pOeCuemXtOeahOWkp+Wchui3neemuwogICAgICAgICAgICBmdW5jdGlvbiBjYWxjdWxh" +
  "dGVEaXN0YW5jZShwb2ludDEsIHBvaW50MikgewogICAgICAgICAgICAgICAgY29uc3QgUiA9IDYz" +
  "NzE7IC8vIOWcsOeQg+WNiuW+hO+8jOWNleS9jWttCiAgICAgICAgICAgICAgICBjb25zdCBkTGF0" +
  "ID0gKHBvaW50Mi5sYXQgLSBwb2ludDEubGF0KSAqIE1hdGguUEkgLyAxODA7CiAgICAgICAgICAg" +
  "ICAgICBjb25zdCBkTG9uID0gKHBvaW50Mi5sbmcgLSBwb2ludDEubG5nKSAqIE1hdGguUEkgLyAx" +
  "ODA7CiAgICAgICAgICAgICAgICBjb25zdCBhID0gTWF0aC5zaW4oZExhdC8yKSAqIE1hdGguc2lu" +
  "KGRMYXQvMikgKwogICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNvcyhwb2ludDEubGF0ICog" +
  "TWF0aC5QSSAvIDE4MCkgKiBNYXRoLmNvcyhwb2ludDIubGF0ICogTWF0aC5QSSAvIDE4MCkgKgog" +
  "ICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnNpbihkTG9uLzIpICogTWF0aC5zaW4oZExvbi8y" +
  "KTsKICAgICAgICAgICAgICAgIGNvbnN0IGMgPSAyICogTWF0aC5hdGFuMihNYXRoLnNxcnQoYSks" +
  "IE1hdGguc3FydCgxLWEpKTsKICAgICAgICAgICAgICAgIHJldHVybiBSICogYzsKICAgICAgICAg" +
  "ICAgfQogICAgICAgICAgICAKICAgICAgICAgICAgLy8g6LSq5b+D566X5rOV5Yid5aeL5YyWCiAg" +
  "ICAgICAgICAgIGxldCByb3V0ZSA9IFtjb21wYW5pZXNbMF1dOwogICAgICAgICAgICBsZXQgcmVt" +
  "YWluaW5nID0gWy4uLmNvbXBhbmllcy5zbGljZSgxKV07CiAgICAgICAgICAgIAogICAgICAgICAg" +
  "ICB3aGlsZSAocmVtYWluaW5nLmxlbmd0aCA+IDApIHsKICAgICAgICAgICAgICAgIGxldCBjdXJy" +
  "ZW50ID0gcm91dGVbcm91dGUubGVuZ3RoIC0gMV07CiAgICAgICAgICAgICAgICBsZXQgbmVhcmVz" +
  "dEluZGV4ID0gMDsKICAgICAgICAgICAgICAgIGxldCBtaW5EaXN0YW5jZSA9IEluZmluaXR5Owog" +
  "ICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbWFp" +
  "bmluZy5sZW5ndGg7IGkrKykgewogICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3QgPSBjYWxj" +
  "dWxhdGVEaXN0YW5jZShjdXJyZW50LCByZW1haW5pbmdbaV0pOwogICAgICAgICAgICAgICAgICAg" +
  "IGlmIChkaXN0IDwgbWluRGlzdGFuY2UpIHsKICAgICAgICAgICAgICAgICAgICAgICAgbWluRGlz" +
  "dGFuY2UgPSBkaXN0OwogICAgICAgICAgICAgICAgICAgICAgICBuZWFyZXN0SW5kZXggPSBpOwog" +
  "ICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICAgICAgcm91dGUucHVzaChyZW1haW5pbmdbbmVhcmVzdEluZGV4XSk7CiAgICAg" +
  "ICAgICAgICAgICByZW1haW5pbmcuc3BsaWNlKG5lYXJlc3RJbmRleCwgMSk7CiAgICAgICAgICAg" +
  "IH0KICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIDItb3B05LyY5YyWCiAgICAgICAgICAgIGxl" +
  "dCBpbXByb3ZlZCA9IHRydWU7CiAgICAgICAgICAgIGxldCBpdGVyYXRpb25zID0gMDsKICAgICAg" +
  "ICAgICAgY29uc3QgbWF4SXRlcmF0aW9ucyA9IDEwMDsKICAgICAgICAgICAgCiAgICAgICAgICAg" +
  "IHdoaWxlIChpbXByb3ZlZCAmJiBpdGVyYXRpb25zIDwgbWF4SXRlcmF0aW9ucykgewogICAgICAg" +
  "ICAgICAgICAgaW1wcm92ZWQgPSBmYWxzZTsKICAgICAgICAgICAgICAgIGl0ZXJhdGlvbnMrKzsK" +
  "ICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCByb3V0" +
  "ZS5sZW5ndGggLSAxOyBpKyspIHsKICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gaSAr" +
  "IDE7IGogPCByb3V0ZS5sZW5ndGg7IGorKykgewogICAgICAgICAgICAgICAgICAgICAgICBjb25z" +
  "dCBuZXdSb3V0ZSA9IHR3b09wdFN3YXAocm91dGUsIGksIGopOwogICAgICAgICAgICAgICAgICAg" +
  "ICAgICBpZiAoY2FsY3VsYXRlVG90YWxEaXN0YW5jZShuZXdSb3V0ZSkgPCBjYWxjdWxhdGVUb3Rh" +
  "bERpc3RhbmNlKHJvdXRlKSkgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgcm91dGUgPSBu" +
  "ZXdSb3V0ZTsKICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltcHJvdmVkID0gdHJ1ZTsKICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAg" +
  "ICAgIH0KICAgICAgICAgICAgfQogICAgICAgICAgICAKICAgICAgICAgICAgcmV0dXJuIHJvdXRl" +
  "OwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyAyLW9wdOS6pOaNogogICAgICAgIGZ1bmN0" +
  "aW9uIHR3b09wdFN3YXAocm91dGUsIGksIGopIHsKICAgICAgICAgICAgY29uc3QgbmV3Um91dGUg" +
  "PSByb3V0ZS5zbGljZSgwLCBpKTsKICAgICAgICAgICAgY29uc3QgcmV2ZXJzZWQgPSByb3V0ZS5z" +
  "bGljZShpLCBqICsgMSkucmV2ZXJzZSgpOwogICAgICAgICAgICBjb25zdCByZW1haW5pbmcgPSBy" +
  "b3V0ZS5zbGljZShqICsgMSk7CiAgICAgICAgICAgIHJldHVybiBbLi4ubmV3Um91dGUsIC4uLnJl" +
  "dmVyc2VkLCAuLi5yZW1haW5pbmddOwogICAgICAgIH0KICAgICAgICAKICAgICAgICAvLyDorqHn" +
  "rpfot6/nur/mgLvot53nprsKICAgICAgICBmdW5jdGlvbiBjYWxjdWxhdGVUb3RhbERpc3RhbmNl" +
  "KHJvdXRlKSB7CiAgICAgICAgICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZURpc3RhbmNlKHBvaW50MSwg" +
  "cG9pbnQyKSB7CiAgICAgICAgICAgICAgICBjb25zdCBSID0gNjM3MTsKICAgICAgICAgICAgICAg" +
  "IGNvbnN0IGRMYXQgPSAocG9pbnQyLmxhdCAtIHBvaW50MS5sYXQpICogTWF0aC5QSSAvIDE4MDsK" +
  "ICAgICAgICAgICAgICAgIGNvbnN0IGRMb24gPSAocG9pbnQyLmxuZyAtIHBvaW50MS5sbmcpICog" +
  "TWF0aC5QSSAvIDE4MDsKICAgICAgICAgICAgICAgIGNvbnN0IGEgPSBNYXRoLnNpbihkTGF0LzIp" +
  "ICogTWF0aC5zaW4oZExhdC8yKSArCiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguY29zKHBv" +
  "aW50MS5sYXQgKiBNYXRoLlBJIC8gMTgwKSAqIE1hdGguY29zKHBvaW50Mi5sYXQgKiBNYXRoLlBJ" +
  "IC8gMTgwKSAqCiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguc2luKGRMb24vMikgKiBNYXRo" +
  "LnNpbihkTG9uLzIpOwogICAgICAgICAgICAgICAgY29uc3QgYyA9IDIgKiBNYXRoLmF0YW4yKE1h" +
  "dGguc3FydChhKSwgTWF0aC5zcXJ0KDEtYSkpOwogICAgICAgICAgICAgICAgcmV0dXJuIFIgKiBj" +
  "OwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICBsZXQgdG90YWwgPSAwOwog" +
  "ICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJvdXRlLmxlbmd0aCAtIDE7IGkrKykgewog" +
  "ICAgICAgICAgICAgICAgdG90YWwgKz0gY2FsY3VsYXRlRGlzdGFuY2Uocm91dGVbaV0sIHJvdXRl" +
  "W2kgKyAxXSk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgcmV0dXJuIHRvdGFsOwogICAgICAg" +
  "IH0KICAgICAgICAKICAgICAgICAvLyDnu5jliLbpqb7ovabot6/nur8KICAgICAgICBmdW5jdGlv" +
  "biBwbG90RHJpdmluZ1JvdXRlKHJvdXRlKSB7CiAgICAgICAgICAgIGlmICghZHJpdmluZykgewog" +
  "ICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfpqb7ovabop4TliJLmnI3liqHmnKrliJ3l" +
  "p4vljJYnKTsKICAgICAgICAgICAgfQogICAgICAgICAgICAKICAgICAgICAgICAgLy8g5riF6Zmk" +
  "5LmL5YmN55qE6Lev57q/CiAgICAgICAgICAgIGRyaXZpbmcuY2xlYXIoKTsKICAgICAgICAgICAg" +
  "CiAgICAgICAgICAgIC8vIOiwg+ivle+8muaJk+WNsOaJgOacieWdkOaghwogICAgICAgICAgICBs" +
  "b2coYPCfk40g6KeE5YiS6Lev57q/77yM5YWxICR7cm91dGUubGVuZ3RofSDkuKrngrk6YCwgJ2lu" +
  "Zm8nKTsKICAgICAgICAgICAgcm91dGUuZm9yRWFjaCgoYywgaSkgPT4gewogICAgICAgICAgICAg" +
  "ICAgbG9nKGAgICR7aSsxfS4gJHtjLm5hbWV9OiBbJHtjLmxuZ30sICR7Yy5sYXR9XWAsICdpbmZv" +
  "Jyk7CiAgICAgICAgICAgIH0pOwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g6L+H5ruk5o6J" +
  "5Z2Q5qCH5peg5pWI55qE54K5CiAgICAgICAgICAgIGNvbnN0IHZhbGlkUm91dGUgPSByb3V0ZS5m" +
  "aWx0ZXIoY29tcGFueSA9PiB7CiAgICAgICAgICAgICAgICBjb25zdCBoYXNDb29yZHMgPSBjb21w" +
  "YW55LmxuZyAhPT0gdW5kZWZpbmVkICYmIGNvbXBhbnkubGF0ICE9PSB1bmRlZmluZWQ7CiAgICAg" +
  "ICAgICAgICAgICBjb25zdCBpc051bWJlciA9IHR5cGVvZiBjb21wYW55LmxuZyA9PT0gJ251bWJl" +
  "cicgJiYgdHlwZW9mIGNvbXBhbnkubGF0ID09PSAnbnVtYmVyJzsKICAgICAgICAgICAgICAgIGNv" +
  "bnN0IGlzVmFsaWQgPSBoYXNDb29yZHMgJiYgaXNOdW1iZXIgJiYgIWlzTmFOKGNvbXBhbnkubG5n" +
  "KSAmJiAhaXNOYU4oY29tcGFueS5sYXQpOwogICAgICAgICAgICAgICAgY29uc3QgaW5SYW5nZSA9" +
  "IGlzVmFsaWQgJiYgY29tcGFueS5sbmcgPj0gLTE4MCAmJiBjb21wYW55LmxuZyA8PSAxODAgJiYg" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wYW55LmxhdCA+PSAtOTAgJiYgY29t" +
  "cGFueS5sYXQgPD0gOTA7CiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIGlmICghaXNW" +
  "YWxpZCkgewogICAgICAgICAgICAgICAgICAgIGxvZyhg4pqg77iPIOi3s+i/h+aXoOaViOWdkOag" +
  "hzogJHtjb21wYW55Lm5hbWV9IFtsbmc6JHtjb21wYW55LmxuZ30sIGxhdDoke2NvbXBhbnkubGF0" +
  "fV1gLCAnd2FybmluZycpOwogICAgICAgICAgICAgICAgfSBlbHNlIGlmICghaW5SYW5nZSkgewog" +
  "ICAgICAgICAgICAgICAgICAgIGxvZyhg4pqg77iPIOWdkOagh+i2heWHuuiMg+WbtDogJHtjb21w" +
  "YW55Lm5hbWV9IFske2NvbXBhbnkubG5nfSwgJHtjb21wYW55LmxhdH1dYCwgJ3dhcm5pbmcnKTsK" +
  "ICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIHJldHVybiBpc1ZhbGlkICYmIGluUmFu" +
  "Z2U7CiAgICAgICAgICAgIH0pOwogICAgICAgICAgICAKICAgICAgICAgICAgbG9nKGDinIUg5pyJ" +
  "5pWI5Z2Q5qCHOiAke3ZhbGlkUm91dGUubGVuZ3RofS8ke3JvdXRlLmxlbmd0aH0g5LiqYCwgdmFs" +
  "aWRSb3V0ZS5sZW5ndGggPiAwID8gJ3N1Y2Nlc3MnIDogJ2Vycm9yJyk7CiAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICBpZiAodmFsaWRSb3V0ZS5sZW5ndGggPCAyKSB7CiAgICAgICAgICAgICAgICBz" +
  "aG93VG9hc3QoJ+KdjCDmnInmlYjlnLDlnYDkuI3otrMy5Liq77yM5peg5rOV6KeE5YiS6Lev57q/" +
  "JywgJ2Vycm9yJyk7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgIGlmICh2YWxpZFJvdXRlLmxlbmd0aCA8IHJvdXRlLmxlbmd0aCkg" +
  "ewogICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDimqDvuI8g5pyJICR7cm91dGUubGVuZ3RoIC0g" +
  "dmFsaWRSb3V0ZS5sZW5ndGh9IOS4quWcsOWdgOaXoOaViO+8jOW3sui3s+i/h2AsICd3YXJuaW5n" +
  "Jyk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAgIC8vIOabtOaWsOS8mOWM" +
  "lui3r+e6v+S4uuacieaViOi3r+e6vwogICAgICAgICAgICBvcHRpbWl6ZWRSb3V0ZSA9IHZhbGlk" +
  "Um91dGU7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDmnoTlu7rpgJTnu4/ngrkKICAgICAg" +
  "ICAgICAgY29uc3Qgd2F5cG9pbnRzID0gdmFsaWRSb3V0ZS5zbGljZSgxLCAtMSkubWFwKGNvbXBh" +
  "bnkgPT4gCiAgICAgICAgICAgICAgICBuZXcgQU1hcC5MbmdMYXQoY29tcGFueS5sbmcsIGNvbXBh" +
  "bnkubGF0KQogICAgICAgICAgICApOwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g6LCD55So" +
  "6auY5b636am+6L2m6Lev5b6E6KeE5YiSCiAgICAgICAgICAgIGRyaXZpbmcuc2VhcmNoKAogICAg" +
  "ICAgICAgICAgICAgbmV3IEFNYXAuTG5nTGF0KHZhbGlkUm91dGVbMF0ubG5nLCB2YWxpZFJvdXRl" +
  "WzBdLmxhdCksIC8vIOi1t+eCuQogICAgICAgICAgICAgICAgbmV3IEFNYXAuTG5nTGF0KHZhbGlk" +
  "Um91dGVbdmFsaWRSb3V0ZS5sZW5ndGggLSAxXS5sbmcsIHZhbGlkUm91dGVbdmFsaWRSb3V0ZS5s" +
  "ZW5ndGggLSAxXS5sYXQpLCAvLyDnu4jngrkKICAgICAgICAgICAgICAgIHsgd2F5cG9pbnRzOiB3" +
  "YXlwb2ludHMgfSwKICAgICAgICAgICAgICAgIChzdGF0dXMsIHJlc3VsdCkgPT4gewogICAgICAg" +
  "ICAgICAgICAgICAgIGlmIChzdGF0dXMgPT09ICdjb21wbGV0ZScpIHsKICAgICAgICAgICAgICAg" +
  "ICAgICAgICAgLy8g5pu05paw5qCH6K6w57yW5Y+377yI5oyJ54Wn5LyY5YyW6Lev57q/6aG65bqP" +
  "77yJCiAgICAgICAgICAgICAgICAgICAgICAgIHJlbmRlck1hcmtlcnMoKTsKICAgICAgICAgICAg" +
  "ICAgICAgICAgICAgLy8g5pi+56S657uT5p6cCiAgICAgICAgICAgICAgICAgICAgICAgIGRpc3Bs" +
  "YXlSZXN1bHQocmVzdWx0LCB2YWxpZFJvdXRlKTsKICAgICAgICAgICAgICAgICAgICB9IGVsc2Ug" +
  "ewogICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfpqb7ovabop4TliJLlpLHo" +
  "tKU6Jywgc3RhdHVzLCByZXN1bHQpOwogICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3Qo" +
  "J+KdjCDpqb7ovabot6/lvoTop4TliJLlpLHotKXvvIzpg6jliIblnLDlnYDlj6/og73ml6Dms5Xl" +
  "iLDovr4nLCAnZXJyb3InKTsKICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICB9" +
  "CiAgICAgICAgICAgICk7CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOaYvuekuue7k+ae" +
  "nAogICAgICAgIGZ1bmN0aW9uIGRpc3BsYXlSZXN1bHQocmVzdWx0LCByb3V0ZSkgewogICAgICAg" +
  "ICAgICBpZiAocmVzdWx0LnJvdXRlcyAmJiByZXN1bHQucm91dGVzLmxlbmd0aCA+IDApIHsKICAg" +
  "ICAgICAgICAgICAgIGNvbnN0IHJvdXRlRGF0YSA9IHJlc3VsdC5yb3V0ZXNbMF07CiAgICAgICAg" +
  "ICAgICAgICBjb25zdCB0b3RhbERpc3RhbmNlID0gKHJvdXRlRGF0YS5kaXN0YW5jZSAvIDEwMDAp" +
  "LnRvRml4ZWQoMik7IC8vIOi9rOaNouS4uuWFrOmHjAogICAgICAgICAgICAgICAgY29uc3QgdG90" +
  "YWxUaW1lID0gTWF0aC5yb3VuZChyb3V0ZURhdGEudGltZSAvIDYwKTsgLy8g6L2s5o2i5Li65YiG" +
  "6ZKfCiAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRC" +
  "eUlkKCd0b3RhbERpc3RhbmNlJykudGV4dENvbnRlbnQgPSB0b3RhbERpc3RhbmNlOwogICAgICAg" +
  "ICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvdGFsVGltZScpLnRleHRDb250ZW50" +
  "ID0gdG90YWxUaW1lOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICByZW5kZXJEcmFn" +
  "Z2FibGVSb3V0ZUxpc3Qocm91dGUpOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICBk" +
  "b2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdWx0UGFuZWwnKS5jbGFzc0xpc3QuYWRkKCdzaG93" +
  "Jyk7CiAgICAgICAgICAgIH0KICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5riy5p+T5Y+v" +
  "5ouW5ou955qE6Lev57q/5YiX6KGoCiAgICAgICAgZnVuY3Rpb24gcmVuZGVyRHJhZ2dhYmxlUm91" +
  "dGVMaXN0KHJvdXRlKSB7CiAgICAgICAgICAgIGNvbnN0IHJvdXRlTGlzdCA9IGRvY3VtZW50Lmdl" +
  "dEVsZW1lbnRCeUlkKCdyb3V0ZUxpc3QnKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIHJvdXRl" +
  "TGlzdC5pbm5lckhUTUwgPSByb3V0ZS5tYXAoKGNvbXBhbnksIGluZGV4KSA9PiBgCiAgICAgICAg" +
  "ICAgICAgICA8bGkgY2xhc3M9InJvdXRlLWl0ZW0iIGRyYWdnYWJsZT0idHJ1ZSIgZGF0YS1pbmRl" +
  "eD0iJHtpbmRleH0iIGRhdGEtaWQ9IiR7Y29tcGFueS5pZH0iIHN0eWxlPSJjdXJzb3I6IG1vdmU7" +
  "Ij4KICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJyb3V0ZS1udW1iZXIiPiR7aW5kZXgg" +
  "KyAxfTwvZGl2PgogICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9InJvdXRlLWluZm8iIHN0" +
  "eWxlPSJmbGV4OiAxOyI+CiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9InJvdXRl" +
  "LW5hbWUiPiR7Y29tcGFueS5uYW1lfTwvZGl2PgogICAgICAgICAgICAgICAgICAgICAgICA8ZGl2" +
  "IGNsYXNzPSJyb3V0ZS1hZGRyZXNzIj4ke2NvbXBhbnkuYWRkcmVzc308L2Rpdj4KICAgICAgICAg" +
  "ICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJjb2xvcjog" +
  "Izk5OTsgZm9udC1zaXplOiAxNnB4OyBtYXJnaW4tbGVmdDogOHB4OyI+4piwPC9kaXY+CiAgICAg" +
  "ICAgICAgICAgICA8L2xpPgogICAgICAgICAgICBgKS5qb2luKCcnKTsKICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIC8vIOa3u+WKoOaLluaLveS6i+S7tgogICAgICAgICAgICBsZXQgZHJhZ2dlZEl0" +
  "ZW0gPSBudWxsOwogICAgICAgICAgICBsZXQgZHJhZ2dlZEluZGV4ID0gbnVsbDsKICAgICAgICAg" +
  "ICAgCiAgICAgICAgICAgIHJvdXRlTGlzdC5xdWVyeVNlbGVjdG9yQWxsKCcucm91dGUtaXRlbScp" +
  "LmZvckVhY2goaXRlbSA9PiB7CiAgICAgICAgICAgICAgICAvLyDmi5bmi73lvIDlp4sKICAgICAg" +
  "ICAgICAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZSkg" +
  "ewogICAgICAgICAgICAgICAgICAgIGRyYWdnZWRJdGVtID0gdGhpczsKICAgICAgICAgICAgICAg" +
  "ICAgICBkcmFnZ2VkSW5kZXggPSBwYXJzZUludCh0aGlzLmRhdGFzZXQuaW5kZXgpOwogICAgICAg" +
  "ICAgICAgICAgICAgIHRoaXMuc3R5bGUub3BhY2l0eSA9ICcwLjUnOwogICAgICAgICAgICAgICAg" +
  "ICAgIGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7CiAgICAgICAgICAgICAg" +
  "ICB9KTsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgLy8g5ouW5ou957uT5p2fCiAg" +
  "ICAgICAgICAgICAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBmdW5jdGlvbihl" +
  "KSB7CiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHlsZS5vcGFjaXR5ID0gJzEnOwogICAgICAg" +
  "ICAgICAgICAgICAgIGRyYWdnZWRJdGVtID0gbnVsbDsKICAgICAgICAgICAgICAgICAgICBkcmFn" +
  "Z2VkSW5kZXggPSBudWxsOwogICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
  "IC8vIOenu+mZpOaJgOaciemrmOS6rgogICAgICAgICAgICAgICAgICAgIHJvdXRlTGlzdC5xdWVy" +
  "eVNlbGVjdG9yQWxsKCcucm91dGUtaXRlbScpLmZvckVhY2gobGkgPT4gewogICAgICAgICAgICAg" +
  "ICAgICAgICAgICBsaS5zdHlsZS5ib3JkZXJUb3AgPSAnJzsKICAgICAgICAgICAgICAgICAgICAg" +
  "ICAgbGkuc3R5bGUuYm9yZGVyQm90dG9tID0gJyc7CiAgICAgICAgICAgICAgICAgICAgfSk7CiAg" +
  "ICAgICAgICAgICAgICB9KTsKICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgLy8g5ouW" +
  "5ou957uP6L+HCiAgICAgICAgICAgICAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVy" +
  "JywgZnVuY3Rpb24oZSkgewogICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTsK" +
  "ICAgICAgICAgICAgICAgICAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ21vdmUnOwog" +
  "ICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgIGlmICh0aGlzID09PSBkcmFn" +
  "Z2VkSXRlbSkgcmV0dXJuOwogICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAg" +
  "IGNvbnN0IHJlY3QgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpOwogICAgICAgICAgICAg" +
  "ICAgICAgIGNvbnN0IG1pZFkgPSByZWN0LnRvcCArIHJlY3QuaGVpZ2h0IC8gMjsKICAgICAgICAg" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAvLyDpq5jkuq7mlL7nva7kvY3nva4KICAg" +
  "ICAgICAgICAgICAgICAgICBpZiAoZS5jbGllbnRZIDwgbWlkWSkgewogICAgICAgICAgICAgICAg" +
  "ICAgICAgICB0aGlzLnN0eWxlLmJvcmRlclRvcCA9ICczcHggc29saWQgIzY2N2VlYSc7CiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIHRoaXMuc3R5bGUuYm9yZGVyQm90dG9tID0gJyc7CiAgICAgICAg" +
  "ICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHlsZS5i" +
  "b3JkZXJUb3AgPSAnJzsKICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHlsZS5ib3JkZXJC" +
  "b3R0b20gPSAnM3B4IHNvbGlkICM2NjdlZWEnOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAg" +
  "ICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyDmi5bmi73n" +
  "prvlvIAKICAgICAgICAgICAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywg" +
  "ZnVuY3Rpb24oZSkgewogICAgICAgICAgICAgICAgICAgIHRoaXMuc3R5bGUuYm9yZGVyVG9wID0g" +
  "Jyc7CiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHlsZS5ib3JkZXJCb3R0b20gPSAnJzsKICAg" +
  "ICAgICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAvLyDmlL7n" +
  "va4KICAgICAgICAgICAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGZ1bmN0aW9u" +
  "KGUpIHsKICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7CiAgICAgICAgICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMgPT09IGRyYWdnZWRJdGVtKSBy" +
  "ZXR1cm47CiAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHJv" +
  "cEluZGV4ID0gcGFyc2VJbnQodGhpcy5kYXRhc2V0LmluZGV4KTsKICAgICAgICAgICAgICAgICAg" +
  "ICAKICAgICAgICAgICAgICAgICAgICAvLyDph43mlrDmjpLluo8gb3B0aW1pemVkUm91dGUKICAg" +
  "ICAgICAgICAgICAgICAgICBjb25zdCBuZXdSb3V0ZSA9IFsuLi5vcHRpbWl6ZWRSb3V0ZV07CiAg" +
  "ICAgICAgICAgICAgICAgICAgY29uc3QgW3JlbW92ZWRdID0gbmV3Um91dGUuc3BsaWNlKGRyYWdn" +
  "ZWRJbmRleCwgMSk7CiAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g" +
  "56Gu5a6a5o+S5YWl5L2N572uCiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMu" +
  "Z2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7CiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWlkWSA9" +
  "IHJlY3QudG9wICsgcmVjdC5oZWlnaHQgLyAyOwogICAgICAgICAgICAgICAgICAgIGxldCBpbnNl" +
  "cnRJbmRleCA9IGRyb3BJbmRleDsKICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAg" +
  "ICAgICBpZiAoZHJhZ2dlZEluZGV4IDwgZHJvcEluZGV4ICYmIGUuY2xpZW50WSA8IG1pZFkpIHsK" +
  "ICAgICAgICAgICAgICAgICAgICAgICAgaW5zZXJ0SW5kZXggPSBkcm9wSW5kZXggLSAxOwogICAg" +
  "ICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZHJhZ2dlZEluZGV4ID4gZHJvcEluZGV4ICYmIGUu" +
  "Y2xpZW50WSA+IG1pZFkpIHsKICAgICAgICAgICAgICAgICAgICAgICAgaW5zZXJ0SW5kZXggPSBk" +
  "cm9wSW5kZXggKyAxOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICAK" +
  "ICAgICAgICAgICAgICAgICAgICBuZXdSb3V0ZS5zcGxpY2UoaW5zZXJ0SW5kZXgsIDAsIHJlbW92" +
  "ZWQpOwogICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgIC8vIOabtOaWsOS8" +
  "mOWMlui3r+e6vwogICAgICAgICAgICAgICAgICAgIG9wdGltaXplZFJvdXRlID0gbmV3Um91dGU7" +
  "CiAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g6YeN5paw5riy5p+T" +
  "CiAgICAgICAgICAgICAgICAgICAgcmVuZGVyRHJhZ2dhYmxlUm91dGVMaXN0KG9wdGltaXplZFJv" +
  "dXRlKTsKICAgICAgICAgICAgICAgICAgICByZW5kZXJNYXJrZXJzKCk7CiAgICAgICAgICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgLy8g6YeN5paw6KeE5YiS6am+6L2m6Lev57q/77yI" +
  "5oyJ5paw6aG65bqP77yJCiAgICAgICAgICAgICAgICAgICAgcmVwbGFuUm91dGVCeU9yZGVyKCk7" +
  "CiAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfinIUg" +
  "6Lev57q/6aG65bqP5bey6LCD5pW0JywgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgICAgIH0pOwog" +
  "ICAgICAgICAgICB9KTsKICAgICAgICB9CiAgICAgICAgCiAgICAgICAgLy8g5oyJ5paw6aG65bqP" +
  "6YeN5paw6KeE5YiS6Lev57q/CiAgICAgICAgZnVuY3Rpb24gcmVwbGFuUm91dGVCeU9yZGVyKCkg" +
  "ewogICAgICAgICAgICBpZiAoIWRyaXZpbmcgfHwgb3B0aW1pemVkUm91dGUubGVuZ3RoIDwgMikg" +
  "cmV0dXJuOwogICAgICAgICAgICAKICAgICAgICAgICAgLy8g6L+H5ruk5peg5pWI5Z2Q5qCHCiAg" +
  "ICAgICAgICAgIGNvbnN0IHZhbGlkUm91dGUgPSBvcHRpbWl6ZWRSb3V0ZS5maWx0ZXIoY29tcGFu" +
  "eSA9PiAKICAgICAgICAgICAgICAgIGNvbXBhbnkubG5nICYmIGNvbXBhbnkubGF0ICYmICFpc05h" +
  "Tihjb21wYW55LmxuZykgJiYgIWlzTmFOKGNvbXBhbnkubGF0KQogICAgICAgICAgICApOwogICAg" +
  "ICAgICAgICAKICAgICAgICAgICAgaWYgKHZhbGlkUm91dGUubGVuZ3RoIDwgMikgewogICAgICAg" +
  "ICAgICAgICAgc2hvd1RvYXN0KCfinYwg5pyJ5pWI5Zyw5Z2A5LiN6Laz77yM5peg5rOV6YeN5paw" +
  "6KeE5YiSJywgJ2Vycm9yJyk7CiAgICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0K" +
  "ICAgICAgICAgICAgCiAgICAgICAgICAgIGRyaXZpbmcuY2xlYXIoKTsKICAgICAgICAgICAgCiAg" +
  "ICAgICAgICAgIGNvbnN0IHdheXBvaW50cyA9IHZhbGlkUm91dGUuc2xpY2UoMSwgLTEpLm1hcChj" +
  "b21wYW55ID0+IAogICAgICAgICAgICAgICAgbmV3IEFNYXAuTG5nTGF0KGNvbXBhbnkubG5nLCBj" +
  "b21wYW55LmxhdCkKICAgICAgICAgICAgKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIGRyaXZp" +
  "bmcuc2VhcmNoKAogICAgICAgICAgICAgICAgbmV3IEFNYXAuTG5nTGF0KHZhbGlkUm91dGVbMF0u" +
  "bG5nLCB2YWxpZFJvdXRlWzBdLmxhdCksCiAgICAgICAgICAgICAgICBuZXcgQU1hcC5MbmdMYXQo" +
  "dmFsaWRSb3V0ZVt2YWxpZFJvdXRlLmxlbmd0aCAtIDFdLmxuZywgdmFsaWRSb3V0ZVt2YWxpZFJv" +
  "dXRlLmxlbmd0aCAtIDFdLmxhdCksCiAgICAgICAgICAgICAgICB7IHdheXBvaW50czogd2F5cG9p" +
  "bnRzIH0sCiAgICAgICAgICAgICAgICAoc3RhdHVzLCByZXN1bHQpID0+IHsKICAgICAgICAgICAg" +
  "ICAgICAgICBpZiAoc3RhdHVzID09PSAnY29tcGxldGUnKSB7CiAgICAgICAgICAgICAgICAgICAg" +
  "ICAgIC8vIOabtOaWsOi3neemu+WSjOaXtumXtOaYvuekugogICAgICAgICAgICAgICAgICAgICAg" +
  "ICBpZiAocmVzdWx0LnJvdXRlcyAmJiByZXN1bHQucm91dGVzLmxlbmd0aCA+IDApIHsKICAgICAg" +
  "ICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdXRlRGF0YSA9IHJlc3VsdC5yb3V0ZXNbMF07" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG90" +
  "YWxEaXN0YW5jZScpLnRleHRDb250ZW50ID0gKHJvdXRlRGF0YS5kaXN0YW5jZSAvIDEwMDApLnRv" +
  "Rml4ZWQoMik7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50" +
  "QnlJZCgndG90YWxUaW1lJykudGV4dENvbnRlbnQgPSBNYXRoLnJvdW5kKHJvdXRlRGF0YS50aW1l" +
  "IC8gNjApOwogICAgICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICAgICAgfSBl" +
  "bHNlIHsKICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign6YeN5paw6KeE5YiS" +
  "5aSx6LSlOicsIHN0YXR1cyk7CiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn4p2M" +
  "IOmHjeaWsOinhOWIkui3r+e6v+Wksei0pScsICdlcnJvcicpOwogICAgICAgICAgICAgICAgICAg" +
  "IH0KICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgKTsKICAgICAgICB9CiAgICAgICAgCiAg" +
  "ICAgICAgLy8g5pys5Zyw5a2Y5YKo5Yqf6IO9CiAgICAgICAgZnVuY3Rpb24gc2F2ZVRvTG9jYWxT" +
  "dG9yYWdlKCkgewogICAgICAgICAgICB0cnkgewogICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdl" +
  "LnNldEl0ZW0oJ3JvdXRlUGxhbm5lckNvbXBhbmllcycsIEpTT04uc3RyaW5naWZ5KGNvbXBhbmll" +
  "cykpOwogICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3JvdXRlUGxhbm5lclBl" +
  "bmRpbmcnLCBKU09OLnN0cmluZ2lmeShwZW5kaW5nQ29tcGFuaWVzKSk7CiAgICAgICAgICAgIH0g" +
  "Y2F0Y2ggKGVycm9yKSB7CiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfkv53lrZjliLDm" +
  "nKzlnLDlrZjlgqjlpLHotKU6JywgZXJyb3IpOwogICAgICAgICAgICB9CiAgICAgICAgfQogICAg" +
  "ICAgIAogICAgICAgIGZ1bmN0aW9uIGxvYWRGcm9tTG9jYWxTdG9yYWdlKCkgewogICAgICAgICAg" +
  "ICB0cnkgewogICAgICAgICAgICAgICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRl" +
  "bSgncm91dGVQbGFubmVyQ29tcGFuaWVzJyk7CiAgICAgICAgICAgICAgICBpZiAoc2F2ZWQpIHsK" +
  "ICAgICAgICAgICAgICAgICAgICBjb21wYW5pZXMgPSBKU09OLnBhcnNlKHNhdmVkKTsKICAgICAg" +
  "ICAgICAgICAgIH0KICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgY29uc3Qgc2F2ZWRQ" +
  "ZW5kaW5nID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3JvdXRlUGxhbm5lclBlbmRpbmcnKTsKICAg" +
  "ICAgICAgICAgICAgIGlmIChzYXZlZFBlbmRpbmcpIHsKICAgICAgICAgICAgICAgICAgICBwZW5k" +
  "aW5nQ29tcGFuaWVzID0gSlNPTi5wYXJzZShzYXZlZFBlbmRpbmcpOwogICAgICAgICAgICAgICAg" +
  "fQogICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICByZW5kZXJDb21wYW55TGlzdCgpOwog" +
  "ICAgICAgICAgICAgICAgcmVuZGVyTWFya2VycygpOwogICAgICAgICAgICAgICAgCiAgICAgICAg" +
  "ICAgICAgICBpZiAoY29tcGFuaWVzLmxlbmd0aCA+IDAgfHwgcGVuZGluZ0NvbXBhbmllcy5sZW5n" +
  "dGggPiAwKSB7CiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7CiAgICAgICAg" +
  "ICAgICAgICAgICAgICAgIG1hcC5zZXRGaXRWaWV3KCk7CiAgICAgICAgICAgICAgICAgICAgfSwg" +
  "MTAwMCk7CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAg" +
  "ICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfku47mnKzlnLDlrZjlgqjliqDovb3lpLHotKU6" +
  "JywgZXJyb3IpOwogICAgICAgICAgICB9CiAgICAgICAgfQogICAgICAgIAogICAgICAgIC8vIOaY" +
  "vuekuuWKoOi9veeKtuaAgQogICAgICAgIGZ1bmN0aW9uIHNob3dMb2FkaW5nKHNob3cpIHsKICAg" +
  "ICAgICAgICAgY29uc3QgbG9hZGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkaW5n" +
  "Jyk7CiAgICAgICAgICAgIGlmIChzaG93KSB7CiAgICAgICAgICAgICAgICBsb2FkaW5nLmNsYXNz" +
  "TGlzdC5hZGQoJ3Nob3cnKTsKICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgICAgIGxv" +
  "YWRpbmcuY2xhc3NMaXN0LnJlbW92ZSgnc2hvdycpOwogICAgICAgICAgICB9CiAgICAgICAgfQog" +
  "ICAgICAgIAogICAgICAgIC8vIOaYvuekuuaPkOekuua2iOaBrwogICAgICAgIGZ1bmN0aW9uIHNo" +
  "b3dUb2FzdChtZXNzYWdlLCB0eXBlID0gJ3N1Y2Nlc3MnKSB7CiAgICAgICAgICAgIGNvbnN0IGV4" +
  "aXN0aW5nVG9hc3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudG9hc3QnKTsKICAgICAgICAg" +
  "ICAgaWYgKGV4aXN0aW5nVG9hc3QpIHsKICAgICAgICAgICAgICAgIGV4aXN0aW5nVG9hc3QucmVt" +
  "b3ZlKCk7CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAgICAgIGNvbnN0IHRvYXN0" +
  "ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7CiAgICAgICAgICAgIHRvYXN0LmNsYXNz" +
  "TmFtZSA9IGB0b2FzdCAke3R5cGV9YDsKICAgICAgICAgICAgdG9hc3QudGV4dENvbnRlbnQgPSBt" +
  "ZXNzYWdlOwogICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTsKICAg" +
  "ICAgICAgICAgCiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gewogICAgICAgICAgICAgICAg" +
  "dG9hc3QucmVtb3ZlKCk7CiAgICAgICAgICAgIH0sIDMwMDApOwogICAgICAgIH0KICAgICAgICAK" +
  "ICAgICAgICAvLyDpobXpnaLliqDovb3lrozmiJDlkI7liJ3lp4vljJYKICAgICAgICB3aW5kb3cu" +
  "b25sb2FkID0gZnVuY3Rpb24oKSB7CiAgICAgICAgICAgIC8vIOWKoOi9vemFjee9rgogICAgICAg" +
  "ICAgICBsb2FkQ29uZmlnKCk7CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDnrYnlvoXpq5jl" +
  "vrflnLDlm75BUEnliqDovb3lrozmiJAKICAgICAgICAgICAgaWYgKHR5cGVvZiBBTWFwICE9PSAn" +
  "dW5kZWZpbmVkJykgewogICAgICAgICAgICAgICAgaW5pdE1hcCgpOwogICAgICAgICAgICB9IGVs" +
  "c2UgewogICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfwn5SEIOmrmOW+t+WcsOWbvkFQSeWKoOi9" +
  "veS4rS4uLicsICdzdWNjZXNzJyk7CiAgICAgICAgICAgICAgICBjb25zdCBjaGVja0ludGVydmFs" +
  "ID0gc2V0SW50ZXJ2YWwoKCkgPT4gewogICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgQU1h" +
  "cCAhPT0gJ3VuZGVmaW5lZCcpIHsKICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZh" +
  "bChjaGVja0ludGVydmFsKTsKICAgICAgICAgICAgICAgICAgICAgICAgaW5pdE1hcCgpOwogICAg" +
  "ICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0sIDUwMCk7CiAgICAgICAgICAgIH0K" +
  "ICAgICAgICB9OwogICAgICAgIAogICAgICAgIC8vIOW/q+mAn+a3u+WKoOWFrOWPuO+8iOaUr+aM" +
  "geWQjOWQjeimhueblu+8iQogICAgICAgIGZ1bmN0aW9uIHF1aWNrQWRkQ29tcGFueSgpIHsKICAg" +
  "ICAgICAgICAgY29uc3QgbmFtZUlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3F1aWNr" +
  "Q29tcGFueU5hbWUnKTsKICAgICAgICAgICAgY29uc3QgYWRkcmVzc0lucHV0ID0gZG9jdW1lbnQu" +
  "Z2V0RWxlbWVudEJ5SWQoJ3F1aWNrQ29tcGFueUFkZHJlc3MnKTsKICAgICAgICAgICAgCiAgICAg" +
  "ICAgICAgIGNvbnN0IGNvbXBhbnlOYW1lID0gbmFtZUlucHV0LnZhbHVlLnRyaW0oKTsKICAgICAg" +
  "ICAgICAgY29uc3QgY29tcGFueUFkZHJlc3MgPSBhZGRyZXNzSW5wdXQudmFsdWUudHJpbSgpOwog" +
  "ICAgICAgICAgICAKICAgICAgICAgICAgaWYgKCFjb21wYW55TmFtZSkgewogICAgICAgICAgICAg" +
  "ICAgc2hvd1RvYXN0KCfinYwg6K+35aGr5YaZ5YWs5Y+45ZCN56ew77yBJywgJ2Vycm9yJyk7CiAg" +
  "ICAgICAgICAgICAgICByZXR1cm47CiAgICAgICAgICAgIH0KICAgICAgICAgICAgCiAgICAgICAg" +
  "ICAgIGlmICghY29tcGFueUFkZHJlc3MpIHsKICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn4p2M" +
  "IOivt+Whq+WGmeWFrOWPuOWcsOWdgO+8gScsICdlcnJvcicpOwogICAgICAgICAgICAgICAgcmV0" +
  "dXJuOwogICAgICAgICAgICB9CiAgICAgICAgICAgIAogICAgICAgICAgICAvLyDmo4Dmn6XmmK/l" +
  "kKblt7LlrZjlnKjlkIzlkI3lhazlj7gKICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdJbmRleCA9" +
  "IGNvbXBhbmllcy5maW5kSW5kZXgoYyA9PiBjLm5hbWUgPT09IGNvbXBhbnlOYW1lKTsKICAgICAg" +
  "ICAgICAgY29uc3QgaXNVcGRhdGUgPSBleGlzdGluZ0luZGV4ID49IDA7CiAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICBzaG93TG9hZGluZyh0cnVlKTsKICAgICAgICAgICAgCiAgICAgICAgICAgIHBs" +
  "YWNlU2VhcmNoLnNlYXJjaChjb21wYW55QWRkcmVzcywgZnVuY3Rpb24oc3RhdHVzLCByZXN1bHQp" +
  "IHsKICAgICAgICAgICAgICAgIHNob3dMb2FkaW5nKGZhbHNlKTsKICAgICAgICAgICAgICAgIAog" +
  "ICAgICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gJ2NvbXBsZXRlJyAmJiByZXN1bHQucG9pTGlz" +
  "dCAmJiByZXN1bHQucG9pTGlzdC5wb2lzLmxlbmd0aCA+IDApIHsKICAgICAgICAgICAgICAgICAg" +
  "ICBjb25zdCBzY29yZWRDYW5kaWRhdGVzID0gc2NvcmVDYW5kaWRhdGVzKHJlc3VsdC5wb2lMaXN0" +
  "LnBvaXMsIGNvbXBhbnlBZGRyZXNzLCBjb21wYW55TmFtZSk7CiAgICAgICAgICAgICAgICAgICAg" +
  "Y29uc3QgYmVzdENhbmRpZGF0ZSA9IHNjb3JlZENhbmRpZGF0ZXNbMF07CiAgICAgICAgICAgICAg" +
  "ICAgICAgCiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3Q29tcGFueSA9IHsKICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgaWQ6IGlzVXBkYXRlID8gY29tcGFuaWVzW2V4aXN0aW5nSW5kZXhdLmlk" +
  "IDogRGF0ZS5ub3coKSwKICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogY29tcGFueU5hbWUs" +
  "CiAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3M6IGJlc3RDYW5kaWRhdGUucG9pLmFkZHJl" +
  "c3MgfHwgY29tcGFueUFkZHJlc3MsCiAgICAgICAgICAgICAgICAgICAgICAgIGxuZzogYmVzdENh" +
  "bmRpZGF0ZS5wb2kubG9jYXRpb24ubG5nLAogICAgICAgICAgICAgICAgICAgICAgICBsYXQ6IGJl" +
  "c3RDYW5kaWRhdGUucG9pLmxvY2F0aW9uLmxhdAogICAgICAgICAgICAgICAgICAgIH07CiAgICAg" +
  "ICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgaWYgKGlzVXBkYXRlKSB7CiAgICAg" +
  "ICAgICAgICAgICAgICAgICAgIC8vIOimhuebluabtOaWsAogICAgICAgICAgICAgICAgICAgICAg" +
  "ICBjb21wYW5pZXNbZXhpc3RpbmdJbmRleF0gPSBuZXdDb21wYW55OwogICAgICAgICAgICAgICAg" +
  "ICAgICAgICBsb2coYOKchSDmm7TmlrDlhazlj7jvvJoke2NvbXBhbnlOYW1lfWAsICdzdWNjZXNz" +
  "Jyk7CiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg4pyFIOW3suabtOaWsO+8miR7" +
  "Y29tcGFueU5hbWV9YCwgJ3N1Y2Nlc3MnKTsKICAgICAgICAgICAgICAgICAgICB9IGVsc2Ugewog" +
  "ICAgICAgICAgICAgICAgICAgICAgICAvLyDmlrDlop4KICAgICAgICAgICAgICAgICAgICAgICAg" +
  "Y29tcGFuaWVzLnB1c2gobmV3Q29tcGFueSk7CiAgICAgICAgICAgICAgICAgICAgICAgIGxvZyhg" +
  "4pyFIOaWsOWinuWFrOWPuO+8miR7Y29tcGFueU5hbWV9YCwgJ3N1Y2Nlc3MnKTsKICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDinIUg5bey5re75Yqg77yaJHtjb21wYW55TmFtZX1g" +
  "LCAnc3VjY2VzcycpOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICAK" +
  "ICAgICAgICAgICAgICAgICAgICBzYXZlVG9Mb2NhbFN0b3JhZ2UoKTsKICAgICAgICAgICAgICAg" +
  "ICAgICByZW5kZXJDb21wYW55TGlzdCgpOwogICAgICAgICAgICAgICAgICAgIHJlbmRlck1hcmtl" +
  "cnMoKTsKICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAvLyDmuIXnqbro" +
  "vpPlhaUKICAgICAgICAgICAgICAgICAgICBuYW1lSW5wdXQudmFsdWUgPSAnJzsKICAgICAgICAg" +
  "ICAgICAgICAgICBhZGRyZXNzSW5wdXQudmFsdWUgPSAnJzsKICAgICAgICAgICAgICAgICAgICAK" +
  "ICAgICAgICAgICAgICAgICAgICBpZiAoY29tcGFuaWVzLmxlbmd0aCA+IDApIHsKICAgICAgICAg" +
  "ICAgICAgICAgICAgICAgbWFwLnNldEZpdFZpZXcoKTsKICAgICAgICAgICAgICAgICAgICB9CiAg" +
  "ICAgICAgICAgICAgICB9IGVsc2UgewogICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg4p2M" +
  "IOacquaJvuWIsOWcsOWdgO+8miR7Y29tcGFueUFkZHJlc3N9YCwgJ2Vycm9yJyk7CiAgICAgICAg" +
  "ICAgICAgICB9CiAgICAgICAgICAgIH0pOwogICAgICAgIH0KICAgIDwvc2NyaXB0Pgo8L2JvZHk+" +
  "CjwvaHRtbD4=" ;

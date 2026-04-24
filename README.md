# 高德地图顺路规划系统

一个基于高德地图 API 的智能路线规划工具，帮助销售人员、外勤人员高效规划客户拜访路线。

## 功能

- **批量导入**：支持粘贴公司名和地址，自动批量添加
- **智能排序**：按最近邻算法计算最优拜访顺序
- **地图可视化**：在高德地图上标注客户位置并显示规划路线
- **单条添加**：支持手动逐个添加客户
- **实时日志**：操作过程可视化，方便排查问题

## 在线体验

https://route-planner-8tm.pages.dev/

国内可直接访问，无需翻墙。

## 快速开始

### 方式一：直接打开
1. 访问 https://route-planner-8tm.pages.dev/
2. 在左侧输入公司信息，格式：`公司名,地址`
3. 点击"规划最优路线"

### 方式二：本地运行
```bash
git clone https://github.com/yang1996202-cpu/route-planner.git
cd route-planner
# 直接用浏览器打开 index.html 即可
open index.html
```

## 技术栈

- **前端**：原生 HTML + CSS + JavaScript
- **地图**：高德地图 JS API 2.0
- **部署**：Cloudflare Pages
- **算法**：最近邻算法（Nearest Neighbor）计算近似最优路径

## 注意事项

1. 高德 API Key 已配置域名白名单，仅限指定域名调用
2. 路线规划采用贪心算法，对于少量坐标点（<20）效果良好

## License

MIT

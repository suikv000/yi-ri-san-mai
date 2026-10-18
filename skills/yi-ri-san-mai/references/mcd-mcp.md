# 官方 MCP 接入与核价

官方：https://open.mcd.cn/mcp/doc 、https://github.com/M-China/mcd-mcp-server
服务：https://mcp.mcd.cn ，Streamable HTTP，Bearer认证。令牌在客户端环境变量MCD_MCP_TOKEN中提供；不得写进网页、档案、截图、Git或回答。客户端环境变量插值语法须按实际宿主说明配置。

优先使用宿主已连接的MCP工具。只有用户已配置本机环境变量时，才使用 scripts/mcp_readonly.py 进行只读复现。脚本不向用户索要明文令牌，不自动读取.env，不持久化令牌。

1. initialize → notifications/initialized → tools/list，按本次inputSchema调用。
2. query-nearby-stores：当前实测参数beType=1、searchType=2、city、keyword。城市和商圈来自用户；不要猜造经纬度或把用户常用位置当公开示例。
3. 各店query-meals：storeCode、orderType=1、beType=1；预约时按支持日期传reservationDate。核对营业时间、预约时段和渠道。工具返回的distance不是路线绕行距离。
4. query-meal-detail读取各套餐rounds、choices、diffPrice、数量与可选项。名称和起价不够证明某组合可买。特调遵循服务输出要求，默认不展开所有特调项；本项目使用标准配方，不改酱料。
5. list-nutrition-foods读取食品营养，精确匹配品名及份量。不同地区版本、大小杯和新品不能靠相似名字替代。
6. calculate-price传明确productCode、quantity，套餐带roundList、round、comboItemList。价格单位分，转换元展示。未指定个人券和随单购卡，不声称享受其权益。

只核价，不跟随工具返回的建单建议。只读调用的许可不包括创建订单、付款、领券、抽奖、开卡、查询个人账户、对外发送。

实测示例：天津时代奥城附近宾水西道1980076、凌宾路1980342、环湖中道1980183。双吉+小玉米1+1在后两店核价1490分；最近店该次未返回可选双吉。板烧双蛋堡+豆浆2150/2200/2100分。不能按菜单13.9起价给最近店编造双吉套餐价。

连接失败要明确失败；以快照降级时写日期与范围。若要将新数据用于优化，先标准化为snapshot.json里的foods、offers.storeQuotes、nearbyStores，并验证参数、金额、数量、来源与范围，再运行离线引擎；不能直接把自由文本当作可执行脚本。

# MCP 接入与业务价值

官方：https://open.mcd.cn/mcp/doc 、https://github.com/M-China/mcd-mcp-server

服务 `https://mcp.mcd.cn`，Streamable HTTP，Bearer认证。[配置示例](mcp-config.example.json)只含环境变量占位符，实际语法按宿主说明配置。Token由用户在本机环境变量MCD_MCP_TOKEN提供，不写入前端、文件、截图或Git。

## 实际调用

2026-10-18开发会话完成官方initialize、tools/list、list-nutrition-foods、query-nearby-stores、query-meals、query-meal-detail、calculate-price。工具目录35项，营养160行；天津时代奥城查到5店，对最近3店逐店查菜单、套餐选项和核价。公开食品与报价保存在demo/data.js和Skill的references/snapshot.json，不含账号、收货地址或凭证。

38个有营养对应的购买单元，天津三店95条单元报价，形成56个本地候选。未返回的报价不按零。

| 门店 | 板烧单点 | 双吉＋小玉米1+1 | 板烧炒双蛋堡＋豆浆 |
| --- | ---: | ---: | ---: |
| 宾水西道1980076 | 23.5元 | 当次未返回可选双吉 | 21.5元 |
| 凌宾路1980342 | 24元 | 14.9元 | 22元 |
| 环湖中道1980183 | 23.5元 | 14.9元 | 21元 |

正餐为10月18日即时核价，早餐预约10月19日08:15，不是未来一周价格承诺。原始调试日志不纳入公开仓库。

## Skill流程与价值

1. 读取用户预算口径、身体资料、目标、地点、时段和餐次约束。
2. 从当前tools/list发现inputSchema，按用户城市及商圈query-nearby-stores；各店query-meals、query-meal-detail核对具体选项、规格、数量、营业和预约时段。
3. list-nutrition-foods精确匹配营养；calculate-price传入商品、数量、套餐roundList，按分转元，不能只用起价或条件卡价。
4. 同店比较单点、1+1、套餐及加购，以周预算为硬上限试排，保留营养差距、时间和待核实项；不宣称整周全局最优。
5. 单餐更换只改该餐，重算预算和当天营养；临餐复核供应和最终整单。

价值：避免按单点标价硬凑套餐，识别附近门店价差与选项差异，解释蛋白质性价比及卡费分摊，让预算和营养取舍可见。

## 可复现方式

优先使用安装Skill的助手及已连接官方MCP。配置好本机环境变量后，也可用随包只读客户端（Python3.10+）：

```sh
python3 skills/yi-ri-san-mai/scripts/mcp_readonly.py list-tools
python3 skills/yi-ri-san-mai/scripts/mcp_readonly.py query-nearby-stores --arguments '{"city":"天津","keyword":"时代奥城","beType":1,"searchType":2}'
```

脚本实现初始化、通知、会话头和JSON/SSE响应，只允许营养、附近门店、菜单、详情及核价五种业务工具。若本机Python缺CA应配置系统CA，不能关闭TLS验证。

自动测试覆盖模拟JSON/SSE、会话、交易工具拒绝；**随包客户端尚未独立带令牌在线联调**。真实数据来自开发会话的只读客户端，不把模拟测试说成官方实测。网页版与plan脚本只用公开快照；新数据须按schema整理校验后再输入，不能只改日期冒充当前调用。

## 权限及范围

没有账户、优惠券领取、抽奖、开卡、订单、支付或对外发送。个人卡券兼容性、地图路线、手机宿主、周日任务和到点下单未接通。卡费可按用户假设记账，未知优惠不计省钱额；内部价格组编号未返回，直接逐店核价。复合加购是购买单元相加，最终整单及未来供应需复核。

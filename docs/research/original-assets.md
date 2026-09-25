# Gold Miner 原版美术获取调查

核查日期：2026-09-20。范围：经典 Flash 版的矿工、金块、钻石、鼹鼠、TNT 等美术来源，以及接入当前项目的可行性。

## 结论

**找到了原作者网站和历史官方发行入口。更可靠的路线是取得有适用授权的原始工程／SWF，从中导出原有资源，而不是继续临摹或裁剪游戏截图。**

但需要区分三个结论：

- **来源已定位**：原作者 Dan Glover 的 CartoonDan 网站仍有 Gold Miner 页面，并引用 SWF；历史 GameRival 官网也能定位到具体游戏和嵌入文件。
- **通用导出能力已确认**：JPEXS 官方文档支持导出 SWF 中的矢量形状、图片、影片剪辑及动画帧。
- **尚未确认可直接复用**：没有建立允许本项目抽取、移植和分发原版美术的有效许可；也未确认哪份文件与目标旧版完全一致。本次没有下载、解析或导出这些游戏二进制，更没有逐项认证所需素材。

这里的“未确认授权”不表示授权不存在或不能取得。游戏代码和现有美术未改动。

## 1. 原作与文件来源

### 原作者线索：Dan Glover / CartoonDan

Dan Glover 的[个人介绍](https://www.cartoondan.com/about.html)及[作品集](https://www.cartoondan.com/portfolio/games.html)将其与游戏设计、美术和原始 Gold Miner 的创作联系起来。作品集的 *2-Bit Miner* 条目明确提到原始 Gold Miner 的创作者身份。这比来源不明的素材站更适合作为询权起点。

其现行 [Gold Miner 游戏页面](https://www.cartoondan.com/games/gold_miner.html)引用同目录的 `goldMiner.swf`。本次仅检查该端点的响应头：HTTP 200、Flash 内容类型、172,856 字节，未下载正文。

**创作者身份不等于已经证明现有商业版权或美术再许可权。** 应同时询问当年的雇佣／转让关系、当前权利人，以及能否提供原始工程或经授权的素材导出。

### 历史官方发行：GameRival

[2004-07-06 的 GameRival 官网快照](https://web.archive.org/web/20040706033440id_/http://www.gamerival.com/index.cfm?game=23E94579)将游戏列为 Gold Miner，游戏码为 `23E94579`，有游玩和下载入口。页脚署名 `Copyright 2002–2003 eUniverse, Inc. All Rights Reserved.`

[2004-07-04 的官方游戏容器](https://web.archive.org/web/20040704061443id_/http://www.gamerival.com/index.cfm?play=23E94579&fromint=1)嵌入 `i.gamerival.com/games/goldminer_511.swf`，显示区域为 550×400。

这些资料能证明历史发行关系，不能单凭网站页脚推定每张美术的当前权利归属。

### 多份文件记录，版本尚未对齐

| 来源 | 文件记录 | 可以确认的范围 |
| --- | --- | --- |
| [CartoonDan 现行页面](https://www.cartoondan.com/games/gold_miner.html) | `goldMiner.swf`，响应头报告 172,856 字节 | 作者网站确实提供了游戏文件入口；未分析文件内容 |
| [Internet Archive：1100_gold_miner](https://archive.org/metadata/1100_gold_miner) | `gold_miner.swf`，298,548 字节；SHA-1 `8e14ca303450a04ab6876b26452b20ab52b33924` | 元数据列出文件；条目描述来自 “1,100 Flash Animations” 合集 |
| [Internet Archive：gold01_202103_flash](https://archive.org/metadata/gold01_202103_flash) | `gold01.swf`，298,764 字节；SHA-1 `1b54424d1fb98544869ef107d393c065e58cc756` | 条目元数据署名 GameRival、年份 2003；不构成权利证明 |

两份档案的 SHA-1 不同，说明它们不是同一份字节内容；作者站目前只有响应头记录，没有下载后比对。**这些信息不足以判断美术一定不同、哪个更“原版”，或差异究竟来自压缩、包装还是版本更新**。本次未取得历史官网 SWF 与现存文件之间的哈希对应；相关 Wayback CDX 查询返回 503。

`1100_gold_miner` 的 `screenshot_01.png` 在此前查看中是标题画面，不是独立素材或游戏内完整资源展示。不能用标题截图认证人物动画、鼹鼠和炸药等资源齐全。

### 必须先锁定版别

经典 Gold Miner、Special Edition、Two Players、Vegas，以及现代重制版，不应按名称相似直接混用。作者[作品集](https://www.cartoondan.com/portfolio/games.html)把 *Gold Miner Vegas* 单独列为作品。

[Steam 官方产品元数据](https://store.steampowered.com/api/appdetails?appids=3777060&l=en)将 2025 年 *Gold Miner: Classic Edition* 的开发者列为 GameRival、发行商列为 Margarite Entertainment；其[发行公告](https://www.gamespress.com/Gold-Miner-Classic-Edition-Launches-July-20-on-Steam)宣传新增内容和双人合作。这是现代发行线索，不是与某个旧 Flash 版本逐帧一致的证明。

## 2. 导出原始资源在技术上是否可行

**通用方法成立，针对目标文件的完整性尚未实测。** [JPEXS 官方 README](https://github.com/jindrapetrik/jpexs-decompiler/blob/master/README.md)明确支持 SWF 资源提取，运行于 Windows、Linux 和 macOS；[官方命令行文档](https://raw.githubusercontent.com/wiki/jindrapetrik/jpexs-decompiler/Commandline-arguments.md)给出了以下能力：

| 资源／用途 | 官方支持的输出或选项 |
| --- | --- |
| 矢量形状 | `shape:svg`、`shape:png`、`shape:canvas` |
| 影片剪辑和动画帧 | `sprite:png`、`sprite:svg`、`sprite:apng`、`sprite:canvas`，以及对应的 `frame` 输出 |
| 原有位图 | PNG、JPEG、WebP 等图像输出 |
| 指定对象与动作片段 | `-selectid` 选择 Character ID；`-select` 选择对象及帧范围 |
| 嵌套剪辑 | `-sublength` 指定子动画长度 |
| 透明背景、尺寸、帧率 | `-ignorebackground`、`-zoom`；`-header` 可读取显示区域、帧数和帧率 |
| 外部资源依赖 | `-importAssets` 明确处理引用外部 SWF 的情况 |

因此，不能只在素材站搜索 `miner.png`：目标资源可能是 SWF 内的矢量形状、多个形状组成的剪辑、位图，或它们的组合。**尚未检查目标 SWF，不能声称某个具体 Character ID 就是矿工，也不能保证所有资源都内嵌在一个文件里。**

### “同一份美术”与“屏幕逐像素一致”不是同一保证

优先导出原有矢量／位图数据，可以避免重新绘制造成的设计差异。但动画状态、遮罩、颜色变换、透明边界和栅格化效果仍需对照。

JPEXS 的[官方已知问题](https://raw.githubusercontent.com/wiki/jindrapetrik/jpexs-decompiler/Known-problems.md)记录了 **FLA 导出**可能缺少部分形状或填充；其 [FAQ](https://raw.githubusercontent.com/wiki/jindrapetrik/jpexs-decompiler/FAQ.md)说明缺失图像依赖可能导致错误显示。这不能扩大解释为所有 SVG／PNG 导出都有问题，但说明不应承诺“一次导出必然完整无损”。

工具的 GPL 许可只说明工具本身的许可，不能替代目标游戏的素材授权。

### 取得适用授权后，应整理的资产

下表是针对当前项目的接入清单，**不是已经从原版文件中确认的资源清单**：

| 当前需求 | 建议核对和导出的内容 |
| --- | --- |
| 矿工、卷线器 | 待机、放钩、收钩等动作，原点与帧率；不能只用标题页头像代替完整角色 |
| 金块 | 原作不同大小／形状的完整变体；确认原有高光、阴影是否已包含 |
| 钻石 | 基础形状及原有闪光状态，避免再叠加现有自绘特效造成双重高光 |
| 鼹鼠 | 普通／携钻变体、奔跑和被抓状态、默认朝向；不预设“普通鼹鼠加一张钻石”就是原作组合 |
| TNT 与玩家炸药 | 分清地下爆炸物、玩家投掷物、商店图标和爆炸动画，不把它们当作同一资源 |
| 其他相关画面 | 钩子、绳索、石头、布袋、骨头、商人、头像、背包和商店图标 |

静态对象可优先评估 SVG 或透明 PNG；动作可整理为透明 PNG 帧序列／图集，由当前游戏时钟驱动，这样暂停、收钩状态和两名玩家能分别控制。具体格式必须在获得目标文件并核对导出效果后确定。

## 3. 当前项目不是更换几个 PNG 文件即可

当前美术由 Canvas 绘制函数和内联 SVG 实现，没有现成的原版图片目录：

| 表现入口 | 当前代码 |
| --- | --- |
| 金块、钻石 | `src/game/render.ts:53`、`src/game/render.ts:120` |
| TNT、鼹鼠／携钻鼹鼠 | `src/game/render.ts:184`、`src/game/render.ts:205` |
| 矿工、绳索、抓钩 | `src/game/render.ts:333`、`src/game/render.ts:450`、`src/game/render.ts:468` |
| 商店／背包物品绘制 | `src/game/render.ts:491`、`src/components/Art.tsx:57` |
| 菜单头像、商人 | `src/components/Art.tsx:41`、`src/components/Art.tsx:71` |
| 实体绘制分派与额外高光 | `src/game/render.ts:625-647` |

**可以主要替换表现层，不必重写无限关卡、分数、单人／双人操作等规则。** 但接入时至少需要：

1. 建立版本和资源映射，保留来源、授权、Character ID、动作帧、透明边界与锚点信息。
2. 采用图片／图集时增加资源预加载；不能让尚未加载的图片在第一帧消失，或把缺失资源当作替换成功。
3. 对齐矿工卷线器、钩尖、被抓物和精灵原点。当前碰撞与挂载分别见 `src/game/engine.ts:279`、`src/game/engine.ts:311`；尺寸信息见 `src/game/levels.ts:188-199`。
4. 保持 `src/game/viewport.ts:13` 的等比例素材规则，避免再次出现宽屏拉伸或碰撞位置偏离。
5. 检查头像、商店和背包等所有引用处，去除与原版资产重复的自绘高光／动画，避免“矿场换了、其他界面没换”。
6. 用经确认的同一版原作逐对象、逐动作比对。双人需要区分玩家时，可保留独立编号标识；不能无依据声称自行改色的第二名矿工也是原版资源。

以上是根据当前实现提出的接入建议，本次没有实施替换。

## 4. 为什么现有下载页或开源克隆还不足以直接使用

### 游戏平台与档案的条款

- [CrazyGames 现行条款](https://www.crazygames.com/terms-and-conditions)：§2 为个人、非商业游玩许可，§3 涉及有条件的截图／视频内容使用，§6.3 对复制、修改、衍生作品、分发等设置限制，§8 说明相关权利属于平台或其许可方。**游玩、直播或截图许可不能直接当作独立游戏使用 sprites 的许可。**
- [Internet Archive 官方版权帮助](https://help.archive.org/help/rights/)的 “How do I know if I can use this?” 要求使用者自行确认使用权限，不保证上传条目的版权状态。元数据里的 `source: "original"` 是档案文件来源类别，不代表原版权人已授权复用。

### 克隆仓库的证据边界

`YangQing-Lin/GoldMiner-LiveServer` 的 [MIT 许可](https://github.com/YangQing-Lin/GoldMiner-LiveServer/blob/master/LICENSE#L1-L21)署名仓库作者；[资源引用代码](https://github.com/YangQing-Lin/GoldMiner-LiveServer/blob/master/static/js/src/playground/game_map/game_background/zbase.js#L184-L214)包含矿工卷线器、金块、钻石和 TNT 等 PNG。但本次未找到从原作权利人到该仓库作者的美术授权链，也未下载图片确认其是否与原作完全一致。

这不是说 MIT 不能覆盖图片，而是不能在尚未证明授权方有权许可这些具体图片时，替其认定原作美术已获得 MIT 授权。

`meishadevs/GoldMiner` 的 [README](https://github.com/meishadevs/GoldMiner/blob/master/README.md#L1-L6)及[资源表](https://github.com/meishadevs/GoldMiner/blob/master/src/resource.js#L174-L203)指向“西游黄金矿工”和孙悟空等角色，是不同主题的实现，不能证明经典原版素材已找到。

GitHub 公开可见也不自动提供再分发许可，参见 [GitHub 官方许可说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。

## 5. 推荐的获取路线

**优先联系原作者确认版本与权属，再索取可授权的原始工程或美术导出。**

| 询权对象 | 入口 | 需要确认的内容 |
| --- | --- | --- |
| Dan Glover / CartoonDan | [公开联系页](https://www.cartoondan.com/contact.html) | 哪份文件是目标版本、原始美术归属、是否保留工程、本人能否授权或转介当前权利人 |
| Margarite Entertainment | [Steam 官方元数据中的支持信息](https://store.steampowered.com/api/appdetails?appids=3777060&l=en)、[支持入口](https://margariteentertainment.freshdesk.com/support/tickets/new) | 是否具有旧 Flash 版美术的对外再许可权；现代发行身份本身不足以证明这一点 |
| CrazyGames | [条款的 CONTACT 入口](https://www.crazygames.com/terms-and-conditions) | 能否转介该游戏许可方，而非预设平台可出售或再许可美术 |

现代发行公告中介绍公司 “worldwide rights” 的段落具体举例为 *Big Rigs*，不能将其扩大解读为目标 Gold Miner Flash 美术的完整权属证明。

询权范围应写清：目标版本／哈希或参考画面、具体角色与动画、格式转换及尺寸适配、在独立浏览器游戏中使用、公开网站分发、商业用途、期限地区，以及素材能否进入公开源码仓库。对方提供文件与对方具有相应再许可权，也需要分开确认。

**本次没有联系任何一方、购买许可或提交表单。最终状态：来源与技术路径已找到；目标版本、资源完整性和适用复用授权尚未完成确认。在这些条件满足前，不把镜像文件、截图裁片或来源不明的克隆 PNG 加入游戏发布包。**

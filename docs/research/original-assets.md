# Gold Miner 原版美术获取调查

核查日期：2026-09-20。范围：经典 Flash 版的矿工、金块、钻石、鼹鼠、TNT 等美术来源，以及接入当前项目的可行性。

第1–5节保留当时的调查记录。2026-10-02 已取得用户提供的 SWF 并完成静态核查；仅接入音效，美术仍使用现有自绘版本，详见第6节。当前项目的运行、操作、开发和部署说明集中在[第7节](#7-项目使用与开发)，不属于原版研究结论。

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

## 6. 2026-10-02：音效接入

用户提供的 `goldminer_511.swf` 为298,961字节，SHA-1 `c80f32d6d2c91c2d7d629285e87af15476fe9822`，与[物理研究](original-material-physics.md)已核实的历史 GameRival 官网样本一致。静态解析发现11个 `DefineSound`，均为22,050 Hz单声道 MP3；没有执行 ActionScript。

本轮只采用其中10段，存于 `src/assets/audio/`，由 `src/game/audio.ts` 显式导入并随 Vite 构建部署，不使用 Git 忽略目录或仅本机生效的替换。矿工、鼹鼠、矿物和其他画面均未替换；背景音乐恢复为本项目此前的合成旋律，并使用独立开关，不从 SWF 追加音乐素材。声音文件从 MP3 解码后，按 SWF `SeekSamples` 去掉编码延迟，并严格保留 `SoundSampleCount` 个采样，输出16位 PCM WAV；共315,968字节。

| 当前声音事件 | Sound ID | 原始定位及适配 |
| --- | ---: | --- |
| 下钩 `launch` | 230 | 矿工下钩剪辑231，第4帧 |
| 收绳 `reel` | 247 | 矿工收绳剪辑249，第2／9帧；当前按每个有效游戏秒最多一次触发，双人共用节奏，不再每秒播放5次 |
| 命中 `grab` | 116 | 原矿工下钩剪辑231第2帧的短机械声；完整转换链结束后，最终非钻石的物件使用通用命中声，包括点石成金后的黄金 |
| 黄金 `gold` | 268 | 抓取剪辑292／293的小金块与钱袋状态；当前统一黄金结算事件使用这一段 |
| 钻石 `gem` | 272 | 同上，钻石、携钻鼹鼠及较大金块状态；当前钻石／携钻鼹鼠命中时即播放，到账不重播，连锁技能转换也只播放一次捕获提示 |
| 石头 `rock`、拒绝 `denied` | 134 | 抓取剪辑的石头、骨头、普通鼹鼠状态，以及商店剪辑135的 `no` 状态 |
| 钱袋 `bag` | 305 | 钱袋奖励剪辑308，第5帧；适配当前统一钱袋结算事件 |
| 爆炸 `explosion` | 265 | 爆炸剪辑266及地下TNT剪辑332 |
| 碎石 `crush` | 265 | 复用爆炸采样，音量为原来的40%、播放速率1.2倍，0.3秒内淡出结束；全队每0.1秒最多触发一次，不增加音频文件，也不改变真实爆炸音 |
| 过关 `win` | 65 | 主时间轴 `yes` 成功分支，第95帧；只在成功关卡结算时播放，局内刚达标不播放 |
| 购买／选择 `buy` | 90 | 商店剪辑135的 `yes` 状态；也用于钱袋奖励 |

这些是对当前事件的声音替换，并非重放原作整套音频时间轴。没有移植未使用的关卡开场声61。倒计时与失败提示未找到直接对应的独立原作采样，继续使用已有合成音，并归音效开关控制。背景音乐独立使用原有菜单／矿场与商店旋律，分别按310／270毫秒的节拍生成。除了上表明确调整的收绳频率、钻石捕获提示和胜利声时机，玩法、数值、到账时机与达标通知保持原样。

捕获顺序为：碰撞 → 点石成金 → 璀璨胜金 → 最终货物属性／挂钩状态 → 按最终种类选择并播放一次捕获音效。转换分支不单独选声或发声。石头连续变成黄金、钻石时只播放钻石声；如果最终停在黄金，不再误播钻石声，黄金到账声仍保留到收集时。转换未触发时沿用该物件原有的声音规则。

音效在首次允许音效的用户操作后并行下载、解码并缓存；仅开启背景音乐时不下载音效，合成背景旋律也不需要额外音乐下载。加载期间每类事件只保留最新一次，超过500毫秒的不补播，避免慢网络恢复时突然响起一串过期音效。下载最多等待10秒；HTTP／解码错误显示双语音效警告，不静默退回合成替代音，也不关闭背景音乐，Web Audio 启动错误则显示整体声音警告。两个开关使用独立音量通道、播放节点与本地设置；关闭音效会停止采样及合成提示并清空待播事件，关闭音乐只停止音乐节点与定时器。暂停／切出页面和销毁实例停止两路声音，恢复游戏时按设置恢复；正常过关切换结算界面不会截断胜利音效。

### 碎石反馈

碎石机在每块石头接触点产生短促闪光、灰褐色碎屑和淡尘雾：小石头5片、大石头9片，碎屑旋转下落，并在0.25～0.4秒内消退。全部只作视觉反馈，无伤害、碰撞、镜头晃动或钩子减速，不生成可采集碎片。

声音采用上表的 `crush` 参数，遵循音效开关；短时间连续碎石和双人同时碎石共用冷却，但每块石头都保留动画，也不会抑制或改变真实TNT爆炸声。命中范围及停止条件见[碎石规则](original-material-physics.md#深渊巨口与碎石机)。

**文件来源与可提取性不等于已获得再分发许可。素材权利仍归相应权利人，未声明这些音效为本项目原创或已获开源授权；公开部署或再分发前仍需确认适用授权。**

## 7. 项目使用与开发

当前游戏的插画全部独立绘制，背景音乐使用本项目原创合成旋律；只有第6节注明的音效来自所提供的经典Flash游戏，没有纳入原版美术或关卡布局。玩法、关卡数值和能力详见[经济文档](original-economy.md#5-本项目当前玩法与能力)，物重与回拉详见[物理文档](original-material-physics.md)。

### 本地启动

需要 Node.js 20.19+ 或 22.12+，在仓库根目录执行：

```sh
npm install
npm run dev
```

打开终端显示的本地地址即可游玩，不需要账户、后端或外部素材服务。

### 键位与触屏操作

| 操作 | 单人 | 双人玩家1（左侧） | 双人玩家2（右侧） |
| --- | --- | --- | --- |
| 发射抓钩 | 下方向键 | S | 下方向键 |
| 有直角转弯时，捕获前转弯一次 | 再按下方向键 | 再按S | 再按下方向键 |
| 用炸药销毁自己钩上的物件 | 上方向键 | W | 上方向键 |
| 暂停／恢复 | Escape 或空格 | Escape 或空格 | Escape 或空格 |

点击单矿工／双矿工按钮开始，下方向键也可打开单人选卡界面。首关倒计时在选中能力后才开始。选卡可点击卡片、按 `1`／`2`／`3`，或用方向键及 `W`／`S` 移动焦点后按 Enter 确认。

持有能力后，悬停或键盘聚焦图标可查看效果与交互细节，触屏可点击图标；Escape 只关闭该提示框，不会因此暂停游戏。过关后的购物车图标进入商店，右箭头开始下一关，商品展示插画、价格和简短效果。

触屏手机和平板自动显示发射／炸药按钮，包括横屏和宽屏平板；单人一组，双人左右各一组，避开屏幕安全区域。没有触屏硬件的窄窗口也保留虚拟按钮。离开浏览器标签页会自动暂停，声音仅在用户交互后启动。

### 语言、声音与本地存档

支持简体中文和英文，右上角 **EN／中文** 按钮切换语言，选卡弹窗也有独立切换按钮。切换立即更新操作、能力、商店、通知和画布奖励文字，不重新开始游戏、不重抽选项。

音乐符号按钮控制背景音乐，扬声器按钮控制音效，两者独立开关、独立保存，支持只开音乐、只开音效、全开或全关，新玩家默认全开。暂停或离开页面时两路都停止，关闭任意一路不影响另一路。

语言、音乐、音效及分别记录的单人／双人最高分均保存在当前浏览器。旧存档缺少语言时使用中文，不丢失记录；缺少音乐字段时继承原音效开关，因此以前静音的玩家保持静音。

### 开发与构建

```sh
npm test          # Game mechanics and saved-data validation
npm run build    # Type check and production build
npx playwright install chromium
npm run test:e2e  # Real browser keyboard, shop, audio, and responsive flows
```

浏览器场景共用 `tests/game.html`，通过 `fixture` 查询参数选择，由纳入类型检查的 `tests/fixtures.ts` 初始化。它们使用真实App和引擎，但不是生产入口。模拟推进辅助函数在 `tests/engine-driver.ts`，浏览器时钟和交互辅助函数在 `tests/game-driver.ts`。

`npm run preview` 将生产构建发布到本地 `http://127.0.0.1:4173/Gold-Miner/`，开发服务器仍使用根路径 `/`。如需同一局域网其他设备访问，显式运行 `npm run dev -- --host 0.0.0.0`。

### GitHub Pages

推送到 `main` 后，[部署工作流](../../.github/workflows/deploy.yml)运行测试、类型检查及构建，再将 `dist/` 发布到 [mikeyan01.github.io/Gold-Miner](https://mikeyan01.github.io/Gold-Miner/)。生产构建及预览的素材路径前缀为 `/Gold-Miner/`，本地开发仍为 `/`。

首次部署前，仓库所有者需在 [Settings → Pages → Build and deployment → Source](https://github.com/MikeYan01/Gold-Miner/settings/pages) 选择 **GitHub Actions**，不需要个人访问令牌或额外仓库密钥。如果第一次推送早于该设置，在 Actions 中手动运行 **Deploy to GitHub Pages**。

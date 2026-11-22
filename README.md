# 人性的枷锁

双击 `index.html` 可以在本机浏览器开始游戏。运行版已经打包，游玩时可以离线。

第一幕依照原著第 I–XXI 章。用 WASD 移动，拖动场景或按左右方向键转向，按 E 或点击「前往线索」查看物件。每章的三个场景线索对应三段连续原文。读完并通过两道理解题后，才解锁下一章。答错时可以跳回原文证据段落。每段原文右侧的按钮播放本地英音，语速可切换。脚步和环境音在首次操作后启用，可单独关闭。进度保存在当前浏览器和游戏文件位置。

《破晓》可沿「看向窗边」「随女仆下楼」「转到门厅」看完开场。每处场景会显示一句英文原文，可播放离线朗读，也可点「查看原段」跳到对应上下文。完整原文和理解检查可以留到走完剧情再读。

「地图」可步行游览伦敦、布莱克斯泰布尔和特坎伯里。每处入口会显示对应的原文章号。打开已解锁地点的门并越过门槛，会以短暂淡入淡出衔接该章的室内。走出室内入口会回到地图上同一扇门前。「进入此处剧情」会引导玩家走到入口并开门进入。

靠近并朝向门时，按 E 或点击门上的提示来开关。《破晓》的楼梯门直接连通两间卧室，菲利普卧室的另一扇门可回到伦敦街道。点击右上角「全屏」或按 Z 放大游戏画面，按 Esc 或点击「退出全屏」恢复。浏览器容器限制原生全屏时，游戏铺满当前页面。

手机触屏版在右下角显示方向键。按住移动，松手停下，同时可以用另一根手指拖动场景转头。

## 开发

《破晓》的手动移动使用 [Rapier 3D](https://github.com/dimforge/rapier)（Apache-2.0）。玩家胶囊碰撞体会沿墙滑动、上下台阶，门扇碰撞与动画同步。物理引擎随离线运行版打包。

`npm install` 安装依赖，`npm run build` 重新打包。测试默认使用本机 Chrome 或 Edge，也可以通过 `BONDAGE_BROWSER` 指定浏览器可执行文件。打包后运行 `npm test` 验证完整通关流程。

`src/story.js` 保存全书八幕、章节、场景线索、词汇和理解题，`src/original.json` 保存从提供的 MOBI 提取的第 1–21 章。添加后续章节时，将原文及章节元数据按章号连续写入，并为新地点提供场景和线索物件。目录依据实际已有的章节资料开放后续各幕。

## 资源与授权

| 资源 | 授权与用途 |
| --- | --- |
| [TinyWorlds 的多地面脚步录音](https://lpc.opengameart.org/node/5701) | **已使用 · CC0。** 木地板、石地和碎石使用独立录音，木地板有两种变体。 |
| [Piper Cori 英音模型 v1.0.0](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/en/en_GB/cori/medium/MODEL_CARD) | **已使用 · 模型库 MIT，模型卡标注训练录音为公有领域。** 游戏包含合成的 Ogg 音轨。 |
| [Three.js PointerLockControls](https://threejs.org/docs/pages/PointerLockControls.html) 与 [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | **MIT。** 可用于鼠标捕获与导入 GLB 人物和家具。当前场景支持拖拽与键盘转向。 [Three.js 授权](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters) 与 [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | **CC0。** 可用作艾玛、医生和教师的成人骨骼底模，加入步行、坐下等动作。童年菲利普和维多利亚服装需要单独制作或改比例。 |
| [Quaternius Medieval Village](https://quaternius.com/packs/medievalvillage.html) | **CC0。** 可重用乡镇的围栏与配景，牧师家和国王学校适合保留定制轮廓。 |
| [Poly Haven 木桌](https://polyhaven.com/a/wooden_table_02)、[维多利亚风格木椅](https://polyhaven.com/a/WoodenChair_01) 与 [旧松木地板](https://polyhaven.com/a/wood_floor_worn) | **CC0。** 木桌可作为低面数室内道具，木椅适合少量摆放。地板可用 1K 贴图试配病房与校舍的用光。 |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | **CC0。** 可继续筛选门、桌面和木器触碰声。当前环境底噪和部分道具互动声由游戏合成。 |
| [qubodup Door Open, Door Close Set](https://opengameart.org/content/door-open-door-close-set) | **已使用 · CC0。** 门扇转动时播放 DoorOpen02，关门时播放 DoorClose01。 |
| [tevy Wooden Interior Door](https://tevy.dev/models/wooden-interior-door) | **CC0。** 四面板门适合伦敦室内，门扇和把手可单独移动，GLB 提供三档面数。 |
| [AnyRPG Medieval Doors Interiors](https://opengameart.org/content/medieval-doors-interiors) | **CC0。** Blender 门模型可打开和关闭，可参考石门框与教堂门的做法。 |
| [loafbrr_1 Low Poly Doors Asset](https://opengameart.org/content/low-poly-doors-asset) | **CC0。** 低多边形门窗适合当外景配件，导入前检查转轴和门框是否独立。 |
| [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html) | **MIT。** 可用于将第一人称镜头中心与门把手、道具模型的命中区域对应。现有门使用近距离屏幕提示。 |

重做当前 21 章的朗读时，可以向 `tools/generate-narration.mjs` 提供本机 Piper、Cori 模型和 FFmpeg 可执行文件。工具会生成 `assets/narration/` 内的音轨与段落索引。

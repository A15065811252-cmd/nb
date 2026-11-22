# 《破晓》Godot 第一章试玩

用 Godot 4 标准版打开本目录的 `project.godot`，按 F5。本机可直接双击桌面「破晓 · Godot 预演」。全章约四分钟，另加玩家观察和阅读的时间。

## 游玩

- 入场约 37 秒。可以直接跳过，进入菲利普醒来的床上视角。拖动鼠标或按方向键转头，朝向女佣时她会伸手。
- 女佣伸手后按 E 或点「回应女佣」。抱起和下楼时仍可以转头。到母亲床边后，再按 E 或点「依偎过去」继续。
- 菲利普入睡后，视角切到大人，故事在医生摇头处结束。可以随时重播。
- 「回看原文」会暂停剧情和当前朗读，可以重听已经出现的句子。关闭面板后从原处继续。

## 原文、字幕与声音

字幕位于画面下方中央，英文原文在上，中文在下，右下角可以开关字幕。本机使用用户提供的果麦经典 EPUB 第一章译文。两个本机字幕文件 `dawn/subtitles.zh-cn.local.json` 和 `dawn/chapter_end.zh-cn.local.json` 由 Git 忽略。其他检出默认显示英文原文。

英文旁白和对话用 [Piper 北英格兰男声模型](https://huggingface.co/rhasspy/piper-voices/blob/5512791644e2148e4be301d4c7fc2a4bf51a5057/en/en_GB/northern_english_male/medium/MODEL_CARD) 合成。模型卡列出的训练录音来自 [OpenSLR SLR83（Google，CC BY-SA 4.0）](https://www.openslr.org/83/)。户外风声和室内底声由项目程序生成。

## 验证

先在工程目录运行 `godot --headless --editor --import`。再运行 `godot --headless --script res://tests/dawn_smoke.gd -- --require-audio`，验证穿窗、视角接管、下楼、依偎、全章字幕和章末收尾。只在有本机译文时加 `--require-chinese`。

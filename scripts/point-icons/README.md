# 点位图图标资源（v1 匹配结果）

来源：`fast-409-matching.json` + 桌面 `00_资源整理`。

## 目录

- `mapping.json`：设备类型 → 图标文件的最终映射（含 `hidden`、自定义类型）。
- `optimized/<device-type>.png`：从 `00_资源整理/优化图标` 选出的已优化图标。
- `original/<device-type>.png`：从 `00_资源整理/assets/original-409` 选出的原始图标。
- `original/custom-*.png`：自定义设备类型使用的原图。

## 说明

- `mapping.json` 里每个条目保留原始来源（`opt:xxx.png` / `orig:xxx.png`）和仓库路径。
- 开关 4 个类型（`switch-1..4`）当前分别指向 4 张原始开关图，不再共用一张。
- `hidden` 是本次明确不用的类型，前端/生成脚本应跳过。
- 自定义类型「吸顶AP」挂在 `network` 类别下。

## 后续

下一步按 `mapping.json` 统一转 SVG（打印/点位图/画板共用），再替换现有 `point-markers` / board symbols。

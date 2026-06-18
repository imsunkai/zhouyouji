# 微信云开发测试数据

这些文件用于云开发控制台数据库导入，适合先把页面跑起来。

云开发控制台导入需要 JSON Lines 格式：一行一条记录。请优先使用 `.jsonl` 文件。如果文件选择器看不到 `.jsonl`，就选同名的 `-lines.json` 文件。

建议导入顺序：

1. `category.jsonl` 或 `category-lines.json` 导入到 `category`
2. `service.jsonl` 或 `service-lines.json` 导入到 `service`
3. `used_car.jsonl` 或 `used_car-lines.json` 导入到 `used_car`
4. `banner.jsonl` 或 `banner-lines.json` 导入到 `banner`
5. `admin_user.jsonl` 或 `admin_user-lines.json` 导入到 `admin_user`

导入方式：

1. 打开微信开发者工具的云开发控制台
2. 进入数据库，点对应集合
3. 点“导入”
4. 文件类型选 JSON
5. 选择本目录中对应的 `.jsonl` 或 `-lines.json` 文件

注意：`admin_user.jsonl` 里的默认账号是 `admin / 123456`，只适合本地测试。上线前必须改成强密码，或删除后重新创建管理员。

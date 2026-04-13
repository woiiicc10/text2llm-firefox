# 选中文字发送到大模型（Firefox 扩展）

在任意网页选中文本后，右键即可发送到你选择的大模型网页端。

## 功能

- 右键选中文本后，支持一键发送到默认模型。
- 支持在右键子菜单中选择模型后发送。
- 当前支持平台：豆包、DeepSeek。
- 选择某个模型发送后，会自动记为默认模型。

## 安装

### Firefox 官方下载

点击下方链接从 Firefox 附加组件商店安装：

[在 Firefox 中安装](https://addons.mozilla.org/zh-CN/firefox/addon/%E9%80%89%E4%B8%AD%E6%96%87%E5%AD%97%E5%8F%91%E9%80%81%E5%88%B0%E5%A4%A7%E6%A8%A1%E5%9E%8B/?utm_content=addons-manager-reviews-link&utm_medium=firefox-browser&utm_source=firefox-browser)

## 使用方式

1. 在网页中选中一段文本。
2. 右键，选择：
   - 直接发送到默认模型（xxx）
   - 选择模型发送... -> 目标模型
3. 扩展会自动打开对应模型网页并尝试填入选中文本。

## 权限说明

- contextMenus：添加右键菜单。
- tabs：新建标签页并在页面加载后注入文本。
- storage：保存默认模型。
- 站点访问权限：用于在目标模型网页内填写文本。

详见 [PRIVACY.md](PRIVACY.md)。

## 已知限制

- 不同模型网页的输入框实现会变化，自动填充可能受页面更新影响。
- 在 Firefox 的浏览器内置受限页面中，扩展功能不可用。

## 版本

当前版本：1.0.2

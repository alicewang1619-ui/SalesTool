# 贡献指南

感谢参与！无论你是业务、开发还是 AI 助手，改这个项目前请先看这里。

## 一、想改东西？先开 issue

1. 去 **Issues → New issue**
2. 选模板：
   - 想要新功能 / 改东西 → **提需求或改动**
   - 出错了 → **报 Bug**
3. 填完提交。**不要提空白 issue。**

## 二、怎么改代码（开发 / AI Agent）

```
# 1. 拉代码 + 开分支（别在 main 上直接改！）
git pull
git checkout -b feat/<简短描述>      # 新功能用 feat/，改文档用 docs/，修 bug 用 fix/

# 2. 改代码（AI 在这个分支上干活）

# 3. 推上去
git push origin feat/<简短描述>

# 4. 去 GitHub 提 Pull Request，关联 issue（写 Closes #编号）
```

**分支命名约定**：
- `feat/*` 新功能
- `fix/*` 修 bug
- `docs/*` 改文档
- `refactor/*` 重构（不改行为）

## 三、PR 合并条件

1. CI 测试**全绿**（自动跑，不绿不能合）
2. 至少 1 人 review 通过（CODEOWNERS 会自动指派）
3. PR 描述写清改了什么、关联哪个 issue

## 四、铁律

- **main 受保护**，没人能直接 push，都走 PR。
- **main 上永远：文档 = 代码 = 测试**，三者一致。
- **改了行为就要同步文档**——别只改代码不改文档。
- AI Agent 只在分支上干活，绝不直接碰 main。

## 五、外部贡献者

没有仓库写权限？用 fork + PR：fork 本仓库 → 在你的 fork 改 → 从 fork 提 PR 回来。

---

> 这个项目用「200 万·AI 落地营」提示词套件开发。需求用 prd-master、设计用 design-master、测试用 tdd-master，协作规范由 git-master 配置。

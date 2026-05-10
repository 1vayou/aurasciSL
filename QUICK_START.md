# 给 Eva 的快速开始指南

这个目录是叠加在你 fork 的 `1vayou/aurasci` 之上的 Solana 集成层。Claude
**没有也不能**直接登录 GitHub 帮你 fork，所以下面是你或你的开发团队需要
跑的命令清单。每一步我都标注了"为什么"，方便你 review 而不是黑箱执行。

## 30 秒版本

1. 用浏览器进 <https://github.com/zizizizazaza/aurasci>，右上角点 **Fork**，
   选你的账号 `1vayou`。
2. 把这个文件夹（`aurasci-solana/`）的内容覆盖到 fork 后的本地仓库上。
3. `npm install` → `anchor build` → `anchor deploy --provider.cluster devnet` → `npm run dev`。
4. 进 <https://arena.colosseum.org/signup> 注册并提交。

详细的 step-by-step 在 `docs/FORK_GUIDE.md`。

## 这次新增了什么

- **完整的 Anchor 程序**（Rust）— 6 个 instruction、4 个 account、3 个事件
- **Solana 钱包集成**（Phantom / Solflare / Backpack）
- **USDC 托管支付**（PDA-owned escrow vault）
- **链上里程碑验证**（AI Verifier 服务端密钥签名）
- **NFT 凭证铸造**（Metaplex Token Metadata）
- **IPFS 证据存证**（浏览器侧 SHA-256 + Pinata 钉住）
- **链上事件实时活动流**（替换原 mock）
- **devnet seed 脚本**（一键复刻 3 个 demo intent）
- **黑客松级 README**（评委友好）+ 架构文档 + fork 指南

## Colosseum 黑客松赛道选择

我研究了 Colosseum 当前在跑的 **Solana Frontier Hackathon**：它**没有
固定赛道**，而是一个 $30K Grand Champion + 20 × $10K runner-up + 公共
品奖 + 大学生奖的结构。给 AuraSci 的最佳定位是同时打：

1. **Grand Champion** — 强调消费级 UX（钱包连一下就能资助科研）
2. **Public Goods** — 强调"开放科学的资金管道是公共基础设施"

你不用在赛道之间二选一，按这个定位写 pitch 即可。`docs/HACKATHON_SUBMISSION.md`
里已经按这个定位写好了草稿。

## ⚠️ 我做不到的事

- ❌ 直接 fork 到你的 GitHub（需要你的登录态）
- ❌ 帮你 `solana-keygen new`（私钥不能离开你的电脑）
- ❌ 帮你跑 `anchor deploy`（需要本机 Solana CLI 和 SOL 余额）
- ❌ 替你提交 Colosseum 表单（需要你登录账号）
- ❌ `npx skills add ColosseumOrg/colosseum-resources` — 这个包目前
  在 npm 上不存在（很可能是占位符），等你拿到真实的安装命令再跑

我把每一步都拆得足够小，你照着 `docs/FORK_GUIDE.md` 一行一行 copy
就行。第一次跑大约 30–45 分钟（取决于 anchor build 和你网络速度）。

## 跑起来卡住怎么办？

把报错粘回来给我，我帮你定位。常见的坑都已经在
`docs/FORK_GUIDE.md` 末尾的 **Troubleshooting** 表里了。

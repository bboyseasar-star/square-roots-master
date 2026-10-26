# 依存関係

|名称|指定方法|用途|ライセンス・配布元・通信先|
|---|---|---|---|
|MathJax|`mathjax@3.2.2`（版を固定）|数式表示|Apache-2.0、[公式配布元](https://github.com/mathjax/MathJax-src)、`cdn.jsdelivr.net`へ接続|
|MathLive|`mathlive@0.101.0`|数式入力|MIT、[公式配布元](https://github.com/arnog/mathlive)、`unpkg.com`へ接続|
|BIZ UDPGothic|Google Fonts|文字表示|OFL-1.1、[公式配布元](https://github.com/googlefonts/morisawa-biz-ud-gothic)、`fonts.googleapis.com`および`fonts.gstatic.com`へ接続|
|Outfit|Google Fonts|文字表示|OFL-1.1、[Google Fonts配布元](https://github.com/google/fonts/tree/main/ofl/outfit)、`fonts.googleapis.com`および`fonts.gstatic.com`へ接続|

CDN読込時には、配信元へIPアドレス、User-Agent、Referer等の通常のアクセス情報が送信されます。学習履歴・答案・手書き内容を送る独自通信はありません。CDNが利用できない場合、数式入力・表示が正常に動作しない可能性があります。追加のnpm依存・画像・音声・外部APIはありません。

## 同梱している自作ファイル

|ファイル|用途|ライセンス|
|---|---|---|
|`grader-core.js`|入力欄の設定・記号選択の採点|MIT（LICENSE。作者が権利を有する独自プログラム）|
|`nyushi-core.js`|数・根号の採点|MIT（同上）|
|`handwriting-overlay.js`|手書きメモ|MIT（同上）|
|`question-layout.js`|問題画面の配置|MIT（同上）|

同梱の `grader-core.js`・`nyushi-core.js`・`handwriting-overlay.js`・`question-layout.js` は作成者による自作のプログラムで、第三者のコードを含みません。上記のMIT Licenseの対象（作者が権利を有する独自プログラム）に含まれます。

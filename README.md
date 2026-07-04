# maru-docs-mcp

MCP server cho phép AI agent đọc/ghi/format Google Docs qua API v1.

---

## 👩‍💼 DÀNH CHO NGƯỜI DÙNG

Bạn không cần biết code. Chỉ cần mở Antigravity 2.0 (hoặc AI coding agent khác), **paste đoạn prompt bên dưới**, rồi làm theo khi AI hỏi.

### Paste prompt này vào Antigravity 2.0:

```
Tôi cần bạn cài đặt MCP server "maru-docs-mcp" để tôi có thể đọc và ghi Google Docs từ đây.

Đọc file README.md trong repo https://github.com/leaddaruma-web/maru-docs-mcp — phần "DÀNH CHO AI CODING AGENT" có hướng dẫn chi tiết từng bước.

Làm hết tất cả các bước giúp tôi — bao gồm cả kiểm tra/cài Node.js nếu máy chưa có.

Hướng dẫn tôi tạo credentials.json trên Google Cloud (theo Bước 2 trong README).

Tôi chỉ cần click "Cho phép" khi trình duyệt mở ra hỏi quyền Gmail.

Bắt đầu.
```

Sau đó AI sẽ tự làm mọi thứ. Bạn chỉ cần:
- **Click "Cho phép"** khi trình duyệt mở ra hỏi quyền Gmail (1 lần duy nhất)
- **Restart Antigravity** sau khi AI báo cấu hình xong (nếu AI yêu cầu)

### Sau khi cài xong, bạn có thể bảo AI:

- *"Đọc nội dung file Google Doc [dán link Doc]"*
- *"Thêm đoạn text này vào cuối Doc [dán link Doc]: ..."*
- *"Format tiêu đề thành Heading 1, in đậm, cỡ 14"*
- *"Chèn logo công ty vào header Doc [dán link Doc]"*
- *"Đặt footer: Maru Education — T2 T2-19 Green Park"*
- *"Tìm chữ 'ABC' thay bằng 'XYZ' trong Doc"*
- *"Tạo bảng 5 hàng 3 cột trong Doc"*

### Lưu ý

- **Doc phải được share cho Gmail bạn** — nếu AI báo "insufficient permission", mở Doc đó → click Share → thêm Gmail của bạn (quyền Editor)
- **Chỉ cần cài 1 lần** — những lần sau mở Antigravity là dùng được luôn

---

## 🤖 DÀNH CHO AI CODING AGENT

> Phần này dành cho AI agent đọc và tự thực hiện. Người dùng không cần đọc phần này.

### Bước 0 — Kiểm tra và cài Node.js (nếu chưa có)

```bash
node --version
```

Nếu lệnh trên báo lỗi hoặc version < 18, cài Node.js:

- **Windows**: tải và chạy installer từ https://nodejs.org/en/download/ (chọn bản LTS, chạy file .msi, chọn tất cả mặc định). Sau khi cài xong cần mở terminal mới để `node` có trong PATH.
- **macOS**: `brew install node` hoặc tải installer từ https://nodejs.org/
- **Linux**: `curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs`

Kiểm tra lại sau khi cài:
```bash
node --version  # phải >= 18
npm --version   # phải có
```

### Bước 1 — Clone repo

```bash
git clone https://github.com/leaddaruma-web/maru-docs-mcp.git
cd maru-docs-mcp
```

Nếu máy chưa có git:
- **Windows**: tải từ https://git-scm.com/download/win, cài mặc định
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt-get install git`

### Bước 2 — Tạo file credentials.json

File này chứa thông tin OAuth client — **không có trong repo** (bảo mật). Người dùng tự tạo trên Google Cloud (miễn phí).

**BÁO CHO NGƯỜI DÙNG:** "Bạn cần tạo credentials trên Google Cloud — miễn phí, chỉ mất 3 phút. Tôi sẽ hướng dẫn từng bước, bạn chỉ cần click theo."

Hướng dẫn người dùng mở trình duyệt và làm theo:

**Bước 2.1. Tạo Google Cloud project:**
- Mở https://console.cloud.google.com/
- Đăng nhập bằng Gmail sẽ dùng để đọc/ghi Doc
- Click menu dropdown project ở thanh trên (cạnh logo Google Cloud) → "New Project"
- Đặt tên project: `maru-docs-mcp` → click "Create"
- Đợi vài giây, chọn project vừa tạo từ dropdown

**Bước 2.2. Bật Google Docs API + Drive API:**
- Mở https://console.cloud.google.com/apis/library/docs.googleapis.com
- Click "Enable" (Bật)
- Mở thêm https://console.cloud.google.com/apis/library/drive.googleapis.com
- Click "Enable" (Bật)

**Bước 2.3. Cấu hình OAuth consent screen:**
- Mở https://console.cloud.google.com/apis/credentials/consent
- Chọn "External" → click "Create"
- Điền:
  - App name: `maru-docs-mcp`
  - User support email: chọn Gmail của bạn
  - Developer contact: nhập Gmail của bạn
- Click "Save and Continue" qua các bước còn lại (Scopes, Test users) → click "Back to Dashboard"
- Ở trang Consent screen, click "Publish App" nếu muốn dùng lâu dài (nếu chỉ test thì bỏ qua)

**Bước 2.4. Tạo OAuth Client ID:**
- Mở https://console.cloud.google.com/apis/credentials
- Click "+ Create Credentials" → "OAuth client ID"
- Application type: chọn **"Desktop app"**
- Name: `maru-docs-mcp`
- Click "Create"
- **MÀN HÌNH HIỆN RA CLIENT ID VÀ CLIENT SECRET** — copy cả 2 giá trị này

**Bước 2.5. Tạo file credentials.json:**

Tạo file `credentials.json` ở thư mục gốc repo (`maru-docs-mcp/credentials.json`) với nội dung:

```json
{
  "installed": {
    "client_id": "THAY_CLIENT_ID_VAO_DAY",
    "project_id": "maru-docs-mcp",
    "client_secret": "THAY_CLIENT_SECRET_VAO_DAY",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "redirect_uris": ["http://localhost:4572/oauth2callback"]
  }
}
```

Thay `THAY_CLIENT_ID_VAO_DAY` và `THAY_CLIENT_SECRET_VAO_DAY` bằng giá trị vừa copy ở Bước 2.4.

**BÁO CHO NGƯỜI DÙNG:** "Xong bước tạo credentials! Tiếp tục cài đặt nhé."

### Bước 3 — Cài dependencies

```bash
npm install
```

### Bước 4 — Xác thực Gmail (chỉ 1 lần)

```bash
npm run auth
```

Lệnh này sẽ:
1. Mở trình duyệt tại URL xác thực Google
2. Người dùng đăng nhập Gmail và click "Cho phép" / "Allow"
3. Trình duyệt chuyển hướng về localhost:4572 → file `token.json` được tạo tự động

**BÁO CHO NGƯỜI DÙNG:** "Trình duyệt sẽ mở ra — bạn đăng nhập Gmail rồi click Cho phép nhé."

Đợi cho đến khi terminal hiện `✓ Đã lưu token.json` rồi tiếp tục.

### Bước 5 — Cấu hình MCP server

Ghi nhớ đường dẫn tuyệt đối tới thư mục `maru-docs-mcp` vừa clone (ví dụ `D:\Projects\maru-docs-mcp` hoặc `/Users/ten/maru-docs-mcp`).

Thêm vào file cấu hình MCP của tool đang dùng:

**Claude Code** — file `claude_desktop_config.json` hoặc `.claude.json`:
```json
{
  "mcpServers": {
    "maru-docs": {
      "command": "node",
      "args": ["src/docs-server.js"],
      "cwd": "<đường-dẫn-tuyệt-đối-tới-thư-mục-maru-docs-mcp>"
    }
  }
}
```

**Antigravity 2.0** — vào Settings → MCP Servers → thêm server mới:
- Name: `maru-docs`
- Command: `node`
- Arguments: `src/docs-server.js`
- Working directory: `<đường-dẫn-tuyệt-đối-tới-thư-mục-maru-docs-mcp>`

**Tool khác** — tương tự, trỏ command `node`, args `src/docs-server.js`, cwd là thư mục chứa repo.

### Bước 6 — Kiểm tra

Sau khi cấu hình, restart tool (hoặc reload MCP) rồi thử:
- Gọi tool `read_document` với `documentId` bất kỳ mà Gmail đã auth có quyền truy cập
- Nếu trả về nội dung doc → **thành công**

**BÁO CHO NGƯỜI DÙNG:** "Đã cài xong! Bạn có thể restart Antigravity rồi thử bảo tôi đọc/ghi Doc."

### Các tool có sẵn sau khi cài

| Tool | Mô tả | Tham số chính |
|------|--------|---------------|
| `read_document` | Đọc nội dung doc (text + heading + bảng + ảnh) | documentId |
| `create_document` | Tạo doc mới | title, folderId (tuỳ chọn) |
| `insert_text` | Chèn text vào vị trí | documentId, text, index |
| `replace_text` | Tìm & thay thế | documentId, find, replaceWith |
| `format_text` | Bold/italic/font/size/màu | documentId, startIndex, endIndex, bold, fontFamily, fontSize, colorHex |
| `set_paragraph_style` | Heading/alignment/spacing/indent | documentId, startIndex, endIndex, namedStyleType, alignment |
| `insert_table` | Chèn bảng | documentId, rows, columns |
| `insert_image` | Chèn ảnh vào body | documentId, imageUrl, widthPt, heightPt |
| `set_header` | Đặt header (text + logo thương hiệu) | documentId, text, imageUrl, imageWidthPt |
| `set_footer` | Đặt footer | documentId, text |
| `set_page_margins` | Đặt margin trang (mm) | documentId, topMm, bottomMm, leftMm, rightMm |
| `delete_content` | Xoá nội dung vùng | documentId, startIndex, endIndex |
| `batch_update` | Gửi nhiều request cùng lúc (nâng cao) | documentId, requests |

### Lưu ý kỹ thuật

- `documentId` lấy từ URL: `https://docs.google.com/document/d/{documentId}/edit`
- Google Docs API dùng index-based: mỗi ký tự có 1 index, bắt đầu từ 1. Dùng `read_document` để xem cấu trúc trước khi format.
- `set_header` hỗ trợ chèn logo thương hiệu: truyền URL ảnh public (hoặc ảnh trên Google Drive có quyền truy cập)
- Muốn truy cập Doc của người khác → người đó phải share (Viewer/Editor) cho Gmail đã auth
- `insert_image` chỉ nhận URL public hoặc Google Drive URL có quyền

### Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `Chưa có token.json` | Chưa chạy auth | `npm run auth` |
| `insufficient permission` | Doc chưa share cho Gmail | Mở Doc → Share → thêm Gmail |
| `node: command not found` | Chưa cài Node.js | Cài Node.js theo Bước 0 |
| `git: command not found` | Chưa cài Git | Cài Git theo Bước 1 |
| `ECONNREFUSED` / `invalid_grant` | Token hết hạn | Xoá `token.json`, chạy lại `npm run auth` |
| `Invalid index` | Index ngoài phạm vi doc | Dùng `read_document` xem lại cấu trúc |

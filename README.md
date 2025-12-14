# Google Drive Shortcut Organizer (Apps Script)

Script này giúp bạn:

1. **Liệt kê toàn bộ file trong 1 folder nguồn** ra Google Sheet.
2. Bạn **gán “Danh mục” (Category)** cho từng file ngay trên sheet.
3. Script sẽ **tự tạo folder con theo Danh mục** và **tạo Shortcut** của từng file vào đúng folder con.
4. Có tool **xóa shortcut/file trùng tên** trong các folder con.
5. Có tool **đếm tổng file theo từng folder con**.

> Script phù hợp khi bạn muốn “phân loại” nhanh một kho file lớn bằng cách tạo shortcut (không di chuyển file gốc).

---

## Demo

Video demo: https://www.tiktok.com/@trungpq.0114/video/7583340865469369618?is_from_webapp=1&sender_device=pc&web_id=7392262522143294983

---

## Yêu cầu

- Google Spreadsheet (để làm UI nhập danh mục).
- Google Apps Script (gắn vào spreadsheet).
- **Bật Advanced Google Services**: *Drive API* (vì có dùng `Drive.Files.get()` và `Drive.Files.create()`).

### Bật Drive API trong Apps Script

1. Mở Apps Script Editor
2. **Services (Dịch vụ)** → **Add a service**
3. Chọn **Drive API** → Add
4. Vào **Google Cloud Console** (nếu được hỏi) và bật **Google Drive API** cho project.

---

## Cấu trúc Sheet

Script dùng sheet tên: **`files`**

| Cột | Ý nghĩa |
|---|---|
| A | Tên file |
| B | File ID |
| C | Link |
| D | Ngày tạo |
| E | Danh mục (bạn tự điền) |
| F | Ghi chú (script tự ghi trạng thái) |

> Bạn chỉ cần điền cột **E (Danh mục)** sau khi đã list file.

---

## Cấu hình bắt buộc

Trong code có các chỗ cần thay:

- `folderId` ở hàm `listFilesInFolderToSheet()`: **Folder nguồn** chứa danh sách file cần phân loại.
- `parentFolderId` ở các hàm batch/remove/count: **Folder cha** nơi sẽ tạo các folder con theo danh mục và đặt shortcut vào đó.

Ví dụ:
- Folder nguồn: `SOURCE_FOLDER_ID`
- Folder cha đích: `DEST_PARENT_FOLDER_ID`

---

## Quy trình sử dụng chuẩn

### Bước 1 — List file ra sheet

Mở Apps Script → chạy:

- `listFilesInFolderToSheet()`

Kết quả: sheet `files` sẽ được tạo (hoặc clear) và đổ danh sách file vào.

---

### Bước 2 — Phân loại thủ công trên sheet

Vào sheet `files`, điền **Danh mục** ở cột **E** cho từng dòng.

Ví dụ:

- `Hóa đơn`
- `Hợp đồng`
- `Ảnh sản phẩm`
- `Chứng từ`

---

### Bước 3 — Chạy batch tạo Shortcut

Có 2 cách:

#### Cách A (khuyến nghị) — chạy nhiều lần tự động

Chạy:
- `runBatchManyTimes()`

Hàm này sẽ gọi `syncFilesToFolders_BATCH(parentFolderId)` lặp nhiều lần (mặc định 60) và nghỉ 3 giây giữa mỗi lần để tránh quota/time limit.

> Apps Script thường chạy tối đa ~6 phút / lần. Batch giúp chia nhỏ ra.

#### Cách B — chạy 1 lần batch

Chạy trực tiếp:
- `syncFilesToFolders_BATCH(parentFolderId)`

Mỗi lần chạy xử lý **BATCH_SIZE = 50** dòng (có thể chỉnh trong code).

---

### Bước 3.1 — Nếu cần chạy lại từ đầu

Chạy:
- `resetBatch()`

Nó sẽ xóa trạng thái `LAST_ROW` để batch chạy lại từ đầu.

---

### Bước 4 — Xóa shortcut/file trùng tên trong từng folder con

Chạy:
- `removeDuplicateImagesInFolders()`

Script sẽ duyệt từng folder con trong folder cha, nếu trong folder có **2 file cùng tên**, nó sẽ **move to trash** file trùng.

> Lưu ý: logic hiện tại dựa theo **tên file**, không theo file ID. Nếu bạn có các file khác nhau nhưng trùng tên, script cũng sẽ xóa bớt.

---

### Bước 5 — Đếm tổng file theo từng folder con

Chạy:
- `countTotalFilesInSubfolders(parentFolderId)`

Kết quả:
- Log ra tổng số file
- Ghi thống kê vào sheet **`File count`**: `[Tên folder, Số file]`

---

## Trạng thái/Log trong cột “Ghi chú” (cột F)

Script sẽ ghi các trạng thái như:

- `✅ Đã tạo shortcut`
- `⏭ Bỏ qua (thiếu File ID hoặc Danh mục)`
- `❌ <lỗi chi tiết>`

Ví dụ lỗi hay gặp:
- File là shortcut nhưng không có `shortcutDetails.targetId`
- Loại mimeType không hỗ trợ làm shortcut target

---

## Ghi chú kỹ thuật

- Script dùng `PropertiesService.getScriptProperties()` để lưu `LAST_ROW`, nhằm **tiếp tục chạy batch từ dòng trước đó**.
- Khi gặp file đã là shortcut (`application/vnd.google-apps.shortcut`), script sẽ lấy `targetId` thật để tránh “shortcut trỏ vào shortcut”.
- Script dùng Drive API v3 qua Advanced Service (`Drive.Files.get/create`) vì `DriveApp` không hỗ trợ tạo shortcut theo cách này.

---

## Tuỳ biến nhanh

- **Tăng/giảm số dòng xử lý mỗi lượt**: sửa `BATCH_SIZE` trong `syncFilesToFolders_BATCH`.
- **Tăng/giảm số lần chạy lặp**: sửa `TIMES` trong `runBatchManyTimes()`.
- Nếu muốn thay vì skip file “không hỗ trợ shortcut”, bạn có thể chỉnh logic để `makeCopy()` sang My Drive trước rồi tạo shortcut (hiện code đang chọn **SKIP** để dễ kiểm soát).

---

## Cảnh báo & An toàn dữ liệu

- Hàm `removeDuplicateImagesInFolders()` sẽ **trash** file trùng (không xóa vĩnh viễn), bạn có thể phục hồi trong Trash.
- Nên test với 1 folder nhỏ trước khi chạy với dữ liệu lớn.
- Nếu folder của bạn thuộc Shared Drive, bạn có thể cần đảm bảo quyền và `supportsAllDrives: true` (script đã set trong Drive API calls).

---

## License

Tùy bạn (MIT/Apache-2.0/Private). Nếu chưa cần public, bạn có thể để “Private/Internal use”.

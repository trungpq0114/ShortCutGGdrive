// Bước 1: Liệt kê các file trong folder, hãy sửa folderId thành folder nguồn của bạn
function listFilesInFolderToSheet() {
    const folderId = "Thay thế bằng folderId chứa danh sách file của bạn"; // 👈 thay folderId
    const sheetName = "files";
  
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
  
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
  
    // Tạo sheet nếu chưa có
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
  
    const rows = [
      [
        "Tên file",
        "File ID",
        "Link",
        "Ngày tạo",
        "Danh mục",
        "Ghi chú"
      ]
    ];
  
    while (files.hasNext()) {
      const file = files.next();
      rows.push([
        file.getName(),
        file.getId(),
        file.getUrl(),
        file.getDateCreated(),
        "", // Danh mục
        ""  // Ghi chú
      ]);
    }
  
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  
    Logger.log(`✅ Đã list ${rows.length - 1} file`);
  }
  
  ;
  // Bước 2: Bạn cần quay về sheet và chia các ảnh vào folder theo cột 'Danh mục' sheet 'files'
  // Bước 3: Bạn chạy hàm sau để tiến hành tạo shortCut vào các folder. 
  // Thường thì chỉ chạy được khoảng 5-7 phút nên nếu lỗi thì bạn cho chạy lại nhé. Nó sẽ cắt nhỏ sheet thành nhiều lần chạy cho đến khi lỗi :))
  
  function runBatchManyTimes() {
    const TIMES = 60; // đổi số lần bạn muốn chạy
    parentFolderId = "Thay thế bằng folderId chứa các folder con chứa các file của bạn";
    for (let i = 0; i < TIMES; i++) {
      Logger.log(`🔄 Lần chạy: ${i + 1}`);
      syncFilesToFolders_BATCH(parentFolderId);
      Utilities.sleep(3000); // nghỉ 3s giữa mỗi lần (tránh bị limit)
    }
  }
  
  ;
  // Ghi chú: Nếu cần chạy lại từ đầu thì bạn chạy function này
  
  function resetBatch() {
    PropertiesService.getScriptProperties().deleteProperty("LAST_ROW");
  }
  ;
  
  
  function syncFilesToFolders_BATCH(parentFolderId) {
    const sheetName = "files";
    const BATCH_SIZE = 50;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
  
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const props = PropertiesService.getScriptProperties();
    let lastRow = parseInt(props.getProperty("LAST_ROW") || "1", 10);
  
    // Load folder hiện có
    const folderMap = {};
    const folders = parentFolder.getFolders();
    while (folders.hasNext()) {
      const f = folders.next();
      folderMap[f.getName().trim()] = f;
    }
  
    const start = lastRow;
    const end = Math.min(start + BATCH_SIZE, data.length);
    const logs = [];
  
    for (let i = start; i < end; i++) {
      const fileId = data[i][1];    // ✅ cột B
      const category = data[i][4]; // ✅ cột E (Danh mục)
      let note = "";
  
      if (!fileId || !category) {
        note = "⏭ Bỏ qua (thiếu File ID hoặc Danh mục)";
      } else {
        try {
          let folder = folderMap[category.trim()];
          if (!folder) {
            folder = parentFolder.createFolder(category.trim());
            folderMap[category.trim()] = folder;
          }
  
          const file = DriveApp.getFileById(fileId);
  
          // Lấy metadata để biết file có phải shortcut / có hỗ trợ hay không
          const meta = Drive.Files.get(fileId, {
            fields: "id,name,mimeType,shortcutDetails",
            supportsAllDrives: true
          });
  
          let targetId = fileId;
  
          // (1) Nếu bản thân nó là shortcut -> lấy targetId thật (Drive không cho shortcut -> shortcut)
          if (meta.mimeType === "application/vnd.google-apps.shortcut") {
            if (!meta.shortcutDetails || !meta.shortcutDetails.targetId) {
              throw new Error("File là shortcut nhưng không có shortcutDetails.targetId");
            }
            targetId = meta.shortcutDetails.targetId;
          }
  
          // (2) Nếu vẫn gặp loại không cho làm đích shortcut (hay gặp là file từ Computers/Backup & Sync)
          // -> chọn 1 trong 2: skip hoặc copy trước
          // Ở đây mình chọn SKIP để bạn nhìn rõ file nào bị loại
          // (Bạn có thể đổi sang makeCopy nếu muốn)
          const NOT_ALLOWED = new Set([
            "application/vnd.google-apps.drive-sdk" // third-party shortcut / app file (thường không dùng làm target)
          ]);
          if (NOT_ALLOWED.has(meta.mimeType)) {
            throw new Error("Loại file không hỗ trợ làm shortcut target: " + meta.mimeType);
          }
  
          const resource = {
            name: meta.name, // dùng tên từ API cho chắc
            mimeType: "application/vnd.google-apps.shortcut",
            shortcutDetails: { targetId },
            parents: [folder.getId()]
          };
  
          Drive.Files.create(resource, null, { supportsAllDrives: true });
          note = "✅ Đã tạo shortcut";
  
        } catch (e) {
          note = "❌ " + e.message;
        }
      }
  
      logs.push([note]);
    }
  
    // ghi vào cột F (Ghi chú)
    sheet.getRange(start + 1, 6, logs.length, 1).setValues(logs);
  
    props.setProperty("LAST_ROW", end.toString());
    Logger.log(`✅ Xong: dòng ${start + 1} → ${end}`);
  }
  ;
  //  Bước 4: Chạy folder này để xóa các shortCut bị duplicate
  function removeDuplicateImagesInFolders() {
    parentFolderId = "Thay thế bằng folderId chứa các folder con chứa các file của bạn";
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const folders = parentFolder.getFolders();
  
    let deletedCount = 0;
  
    while (folders.hasNext()) {
      const folder = folders.next();
      const folderName = folder.getName();
      Logger.log("📂 Đang kiểm tra: " + folderName);
  
      const fileMap = {};
      const files = folder.getFiles();
  
      while (files.hasNext()) {
        const file = files.next();
        const name = file.getName();
  
        if (fileMap[name]) {
          // ✅ File trùng => xóa
          file.setTrashed(true);
          deletedCount++;
          Logger.log("🗑️ Xóa: " + name + " trong " + folderName);
        } else {
          fileMap[name] = true;
        }
      }
    }
  
    Logger.log("✅ Xong! Đã xóa " + deletedCount + " file trùng");
  }
  ;
  
  function countTotalFilesInSubfolders(parentFolderId) {
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const folders = parentFolder.getFolders();
  
    let totalFiles = 0;
    let detail = [];
  
    while (folders.hasNext()) {
      const folder = folders.next();
      const files = folder.getFiles();
      let count = 0;
  
      while (files.hasNext()) {
        files.next();
        count++;
        totalFiles++;
      }
  
      detail.push([folder.getName(), count]);
    }
  
    // Hiển thị log
    Logger.log("✅ Tổng số file: " + totalFiles);
  
    // Ghi ra sheet mới
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("File count");
  
    if (!sheet) {
      sheet = ss.insertSheet("File count");
    } else {
      sheet.clear();
    }
  
    sheet.getRange(1, 1, detail.length, 2).setValues(detail);
  }
  
